import { Injectable, inject } from '@angular/core';
import { Firestore, collection, collectionData, doc, docData, addDoc, updateDoc, query, orderBy, where, getDoc, getDocs } from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { INVOICES } from './firestore-collections.const';
import { Invoice, InvoiceLineItem } from '../models/invoice.model';
import { TimeEntry } from '../models/time-entry.model';
import { TimeEntryService } from './time-entry.service';

/** Why a single time entry can't be pulled back onto a reopening invoice. */
export interface ReopenBlocker {
  entryId: string;
  reason: 'missing' | 'claimed';
  /** Invoice that has since claimed the entry, when we can resolve it. */
  claimedBy?: string;
  /** Set when the entry still exists, so the UI can name it by date. */
  date?: string;
  hours?: number;
}

/**
 * Whether a time entry is free for the given invoice to bill.
 *
 * Cancelling an invoice releases its entries, so a reopen has to re-claim
 * them — but only if nothing else took them in the meantime. An entry still
 * pointing at this invoice counts as free: invoices cancelled before releases
 * existed never let go of theirs, and re-billing those is a no-op.
 */
export function canRebillEntry(
  entry: Pick<TimeEntry, 'status' | 'invoiceId'>,
  invoiceId: string
): boolean {
  return entry.invoiceId === invoiceId || (!entry.invoiceId && entry.status === 'unbilled');
}

export type ReopenResult =
  | { ok: true }
  | { ok: false; reason: 'not-cancelled' }
  | { ok: false; reason: 'entries-unavailable'; blockers: ReopenBlocker[] };

@Injectable({ providedIn: 'root' })
export class InvoiceService {
  private firestore = inject(Firestore);
  private timeEntryService = inject(TimeEntryService);

  getInvoices(): Observable<Invoice[]> {
    const ref = collection(this.firestore, INVOICES);
    const q = query(ref, orderBy('issueDate', 'desc'));
    return collectionData(q, { idField: 'id' }) as Observable<Invoice[]>;
  }

  getInvoicesByCustomer(customerId: string): Observable<Invoice[]> {
    const ref = collection(this.firestore, INVOICES);
    const q = query(ref, where('customerId', '==', customerId), orderBy('issueDate', 'desc'));
    return collectionData(q, { idField: 'id' }) as Observable<Invoice[]>;
  }

  getInvoice(id: string): Observable<Invoice> {
    const ref = doc(this.firestore, INVOICES, id);
    return docData(ref, { idField: 'id' }) as Observable<Invoice>;
  }

  async generateInvoice(
    customerId: string,
    customerName: string,
    entries: TimeEntry[],
    projectRates: Map<string, { name: string; rate: number }>,
    issueDate: string,
    dueDate: string,
    notes?: string
  ): Promise<string> {
    const invoiceNumber = await this.generateInvoiceNumber();

    // One line item per time entry
    const lineItems: InvoiceLineItem[] = [];
    let subtotal = 0;

    for (const entry of entries) {
      const projectInfo = projectRates.get(entry.projectId) || { name: entry.projectId, rate: 0 };
      const hours = Math.round(entry.durationHours * 100) / 100;
      const amount = Math.round(hours * projectInfo.rate * 100) / 100;
      subtotal += amount;

      const lineItem: InvoiceLineItem = {
        projectId: entry.projectId,
        projectName: projectInfo.name,
        hours,
        rate: projectInfo.rate,
        amount
      };
      const [y, m, d] = entry.date.split('-');
      const fmtDate = `${m}/${d}/${y}`;
      lineItem.description = entry.description ? `${fmtDate} — ${entry.description}` : fmtDate;
      lineItems.push(lineItem);
    }

    subtotal = Math.round(subtotal * 100) / 100;

    const now = new Date();
    const ref = collection(this.firestore, INVOICES);
    const invoiceData: Record<string, any> = {
      invoiceNumber,
      customerId,
      customerName,
      issueDate,
      dueDate,
      timeEntryIds: entries.map(e => e.id),
      lineItems,
      subtotal,
      total: subtotal,
      status: 'draft',
      createdAt: now,
      updatedAt: now
    };
    if (notes) invoiceData['notes'] = notes;
    const docRef = await addDoc(ref, invoiceData);

    // Mark time entries as billed
    await this.timeEntryService.markAsBilled(entries.map(e => e.id), docRef.id);

    return docRef.id;
  }

  async updateInvoiceStatus(id: string, status: Invoice['status']): Promise<void> {
    const ref = doc(this.firestore, INVOICES, id);
    const snapshot = await getDoc(ref);
    const entryIds = (snapshot.data()?.['timeEntryIds'] as string[] | undefined) ?? [];

    await updateDoc(ref, {
      status,
      updatedAt: new Date()
    });

    // If paid, also mark time entries as paid
    if (status === 'paid' && entryIds.length) {
      await this.timeEntryService.markAsPaid(entryIds);
    }

    // A cancelled invoice bills nothing, so its entries go back to unbilled —
    // otherwise they stay Locked and can never be put on another invoice.
    if (status === 'cancelled' && entryIds.length) {
      await this.timeEntryService.releaseFromInvoice(entryIds);
    }
  }

  /**
   * Undoes a cancellation, returning the invoice to draft and re-billing its
   * time entries.
   *
   * Cancelling releases entries back to the unbilled pool, so between the
   * cancel and the reopen they may have been deleted or put on a replacement
   * invoice. Re-billing those would double-bill the same hours, so the reopen
   * is refused unless every entry is still free.
   */
  async reopenInvoice(id: string): Promise<ReopenResult> {
    const ref = doc(this.firestore, INVOICES, id);
    const snapshot = await getDoc(ref);
    if (snapshot.data()?.['status'] !== 'cancelled') {
      return { ok: false, reason: 'not-cancelled' };
    }

    const entryIds = (snapshot.data()?.['timeEntryIds'] as string[] | undefined) ?? [];
    const entries = await this.timeEntryService.getEntriesByIds(entryIds);

    const blockers: ReopenBlocker[] = [];
    for (let i = 0; i < entryIds.length; i++) {
      const entry = entries[i];
      if (!entry) {
        blockers.push({ entryId: entryIds[i], reason: 'missing' });
        continue;
      }
      if (!canRebillEntry(entry, id)) {
        blockers.push({
          entryId: entryIds[i],
          reason: 'claimed',
          claimedBy: entry.invoiceId,
          date: entry.date,
          hours: entry.durationHours
        });
      }
    }

    if (blockers.length) {
      await this.resolveBlockerInvoiceNumbers(blockers);
      return { ok: false, reason: 'entries-unavailable', blockers };
    }

    // Re-bill first: a failure here leaves the invoice cancelled, which is the
    // state the entries already agree with.
    if (entryIds.length) {
      await this.timeEntryService.markAsBilled(entryIds, id);
    }
    await updateDoc(ref, { status: 'draft', updatedAt: new Date() });
    return { ok: true };
  }

  /** Swaps blocker invoice ids for human-readable invoice numbers, in place. */
  private async resolveBlockerInvoiceNumbers(blockers: ReopenBlocker[]): Promise<void> {
    const ids = [...new Set(blockers.map(b => b.claimedBy).filter((v): v is string => !!v))];
    const snapshots = await Promise.all(
      ids.map(invoiceId => getDoc(doc(this.firestore, INVOICES, invoiceId)))
    );
    const numbers = new Map<string, string>();
    for (const snap of snapshots) {
      const num = snap.data()?.['invoiceNumber'] as string | undefined;
      if (num) numbers.set(snap.id, num);
    }
    for (const blocker of blockers) {
      if (blocker.claimedBy) {
        blocker.claimedBy = numbers.get(blocker.claimedBy) ?? blocker.claimedBy;
      }
    }
  }

  private async generateInvoiceNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const ref = collection(this.firestore, INVOICES);
    const snapshot = await getDocs(ref);
    const thisYearInvoices = snapshot.docs.filter(d => {
      const num = d.data()['invoiceNumber'] as string;
      return num && num.startsWith(`INV-${year}`);
    });
    const nextNum = thisYearInvoices.length + 1;
    return `INV-${year}-${String(nextNum).padStart(3, '0')}`;
  }
}
