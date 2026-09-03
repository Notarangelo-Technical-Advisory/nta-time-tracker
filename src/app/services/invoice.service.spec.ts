import { canRebillEntry } from './invoice.service';

describe('canRebillEntry', () => {
  const THIS_INVOICE = 'inv-a';
  const OTHER_INVOICE = 'inv-b';

  it('allows an entry the cancel released back to the unbilled pool', () => {
    expect(canRebillEntry({ status: 'unbilled' }, THIS_INVOICE)).toBe(true);
  });

  it('allows an entry still linked to this invoice (cancelled before releases existed)', () => {
    expect(canRebillEntry({ status: 'billed', invoiceId: THIS_INVOICE }, THIS_INVOICE)).toBe(true);
  });

  it('refuses an entry that has since been billed on another invoice', () => {
    expect(canRebillEntry({ status: 'billed', invoiceId: OTHER_INVOICE }, THIS_INVOICE)).toBe(false);
  });

  it('refuses an entry already paid on another invoice', () => {
    expect(canRebillEntry({ status: 'paid', invoiceId: OTHER_INVOICE }, THIS_INVOICE)).toBe(false);
  });

  it('refuses an entry that is no longer unbilled but has no invoice link', () => {
    expect(canRebillEntry({ status: 'paid' }, THIS_INVOICE)).toBe(false);
  });

  it('does not treat an empty-string invoice link as a match', () => {
    expect(canRebillEntry({ status: 'unbilled', invoiceId: '' }, THIS_INVOICE)).toBe(true);
    expect(canRebillEntry({ status: 'billed', invoiceId: '' }, THIS_INVOICE)).toBe(false);
  });
});
