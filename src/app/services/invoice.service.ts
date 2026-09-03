import { Injectable, inject } from '@angular/core';
import { Firestore, collection, collectionData, doc, docData, addDoc, updateDoc, query, orderBy, where, getDoc, getDocs } from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { INVOICES } from './firestore-collections.const';
import { Invoice, InvoiceLineItem } from '../models/invoice.model';
import { TimeEntry } from '../models/time-entry.model';
import { TimeEntryService } from './time-entry.service';

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
