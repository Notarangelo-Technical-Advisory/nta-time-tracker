import { TestBed } from '@angular/core/testing';
import { InvoiceService } from './invoice.service';
import { TimeEntryService } from './time-entry.service';
import { TimeEntry } from '../models/time-entry.model';
import {
  EmulatorApp, clearEmulators, createEmulatorApp, listDocuments, provideEmulator, readDocument, seedDocument, signInAs
} from '../../testing/emulator-testing';

// Billing against the Firestore emulator, signed in as an admin, with the real
// security rules: invoicing time, paying, cancelling and reopening.

describe('Invoice billing', () => {
  let emulator: EmulatorApp;
  let invoices: InvoiceService;
  let entries: TimeEntryService;
  const year = new Date().getFullYear();
  const rates = new Map([['proj-1', { name: 'AI Readiness', rate: 225 }]]);

  beforeEach(async () => {
    await clearEmulators();
    emulator = createEmulatorApp();
    await signInAs(emulator, 'admin');
    TestBed.configureTestingModule({ providers: provideEmulator(emulator) });
    invoices = TestBed.inject(InvoiceService);
    entries = TestBed.inject(TimeEntryService);
  });

  afterEach(() => emulator.dispose());

  /** Logs time as the time-entry form does, and returns the stored entry. */
  async function logTime(date: string, hours: number, description?: string): Promise<TimeEntry> {
    const id = await entries.createTimeEntry({
      userId: 'jack', customerId: 'cust-1', projectId: 'proj-1', date,
      startTime: '09:00', endTime: '10:00', durationHours: hours, ...(description ? { description } : {}),
    });
    return { id, ...(await readDocument(`timeEntries/${id}`)) } as TimeEntry;
  }

  async function invoice(...billed: TimeEntry[]): Promise<string> {
    return invoices.generateInvoice('cust-1', 'IHRDC', billed, rates, `${year}-10-01`, `${year}-10-31`);
  }

  it('logs new time as unbilled', async () => {
    const entry = await logTime(`${year}-09-02`, 1.5);
    expect(entry.status).toBe('unbilled');
  });

  it('invoices time at the project rate, one line per entry, and marks the time billed', async () => {
    const a = await logTime(`${year}-09-02`, 1.5, 'Demo prep');
    const b = await logTime(`${year}-09-03`, 2.333);

    const id = await invoice(a, b);

    const stored = await readDocument(`invoices/${id}`);
    expect(stored!['invoiceNumber']).toBe(`INV-${year}-001`);
    expect(stored!['status']).toBe('draft');
    expect(stored!['lineItems'].map((l: { description: string }) => l.description))
      .toEqual([`09/02/${year} — Demo prep`, `09/03/${year}`]);
    expect(stored!['lineItems'].map((l: { amount: number }) => l.amount)).toEqual([337.5, 524.25]);
    expect(stored!['total']).toBe(861.75);
    expect('notes' in stored!).toBeFalse();
    for (const entry of [a, b]) {
      expect(await readDocument(`timeEntries/${entry.id}`)).toEqual(jasmine.objectContaining({ status: 'billed', invoiceId: id }));
    }
  });

  it('numbers invoices in order within the year', async () => {
    await seedDocument('invoices/old', { invoiceNumber: `INV-${year - 1}-007` });
    const first = await invoice(await logTime(`${year}-09-02`, 1));
    const second = await invoice(await logTime(`${year}-09-03`, 1));

    expect((await readDocument(`invoices/${first}`))!['invoiceNumber']).toBe(`INV-${year}-001`);
    expect((await readDocument(`invoices/${second}`))!['invoiceNumber']).toBe(`INV-${year}-002`);
  });

  it('marks the time paid when the invoice is paid', async () => {
    const entry = await logTime(`${year}-09-02`, 1);
    const id = await invoice(entry);

    await invoices.updateInvoiceStatus(id, 'paid');

    expect((await readDocument(`invoices/${id}`))!['status']).toBe('paid');
    expect((await readDocument(`timeEntries/${entry.id}`))!['status']).toBe('paid');
  });

  it('releases the time back to unbilled when the invoice is cancelled', async () => {
    const entry = await logTime(`${year}-09-02`, 1);
    const id = await invoice(entry);

    await invoices.updateInvoiceStatus(id, 'cancelled');

    const released = await readDocument(`timeEntries/${entry.id}`);
    expect(released!['status']).toBe('unbilled');
    expect('invoiceId' in released!).toBeFalse();
  });

  it('reopens a cancelled invoice as a draft and bills its time again', async () => {
    const entry = await logTime(`${year}-09-02`, 1);
    const id = await invoice(entry);
    await invoices.updateInvoiceStatus(id, 'cancelled');

    expect(await invoices.reopenInvoice(id)).toEqual({ ok: true });

    expect((await readDocument(`invoices/${id}`))!['status']).toBe('draft');
    expect(await readDocument(`timeEntries/${entry.id}`)).toEqual(jasmine.objectContaining({ status: 'billed', invoiceId: id }));
  });

  it('refuses to reopen an invoice that is not cancelled', async () => {
    const id = await invoice(await logTime(`${year}-09-02`, 1));
    expect(await invoices.reopenInvoice(id)).toEqual({ ok: false, reason: 'not-cancelled' });
  });

  it('refuses to reopen when the time is on another invoice or deleted, and names both', async () => {
    const moved = await logTime(`${year}-09-02`, 1.5);
    const deleted = await logTime(`${year}-09-03`, 1);
    const cancelled = await invoice(moved, deleted);
    await invoices.updateInvoiceStatus(cancelled, 'cancelled');
    await invoice({ ...moved, status: 'unbilled' });
    await entries.deleteTimeEntry(deleted.id);

    const result = await invoices.reopenInvoice(cancelled);

    expect(result).toEqual({
      ok: false, reason: 'entries-unavailable', blockers: [
        { entryId: moved.id, reason: 'claimed', claimedBy: `INV-${year}-002`, date: `${year}-09-02`, hours: 1.5 },
        { entryId: deleted.id, reason: 'missing' },
      ],
    });
    expect((await readDocument(`invoices/${cancelled}`))!['status']).toBe('cancelled');
  });

  it('a customer cannot change an invoice', async () => {
    const id = await invoice(await logTime(`${year}-09-02`, 1));
    const customer = createEmulatorApp();
    await signInAs(customer, 'customer', 'cust-1');
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: provideEmulator(customer) });

    const error = await TestBed.inject(InvoiceService).updateInvoiceStatus(id, 'paid').catch((e) => e);

    expect(error.code).toBe('permission-denied');
    expect((await listDocuments('invoices'))[0]['status']).toBe('draft');
    await customer.dispose();
  });
});
