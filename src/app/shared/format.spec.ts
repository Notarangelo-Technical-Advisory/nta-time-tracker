import { formatDate, formatTime } from './format';

describe('formatDate', () => {
  it('shows a date as month, day and year', () => {
    expect(formatDate('2026-11-11')).toBe('11/11/2026');
  });

  it('keeps the leading zero on a single-digit month and day', () => {
    expect(formatDate('2026-03-05')).toBe('03/05/2026');
  });

  it('shows a dash for an empty date', () => {
    expect(formatDate('')).toBe('—');
  });

  it('shows a dash for a missing date', () => {
    expect(formatDate(null)).toBe('—');
    expect(formatDate(undefined)).toBe('—');
  });
});

describe('formatTime', () => {
  it('shows just after midnight as 12:05 AM', () => {
    expect(formatTime('00:05')).toBe('12:05 AM');
  });

  it('shows a morning time without a leading zero', () => {
    expect(formatTime('09:00')).toBe('9:00 AM');
  });

  it('shows noon as 12:00 PM', () => {
    expect(formatTime('12:00')).toBe('12:00 PM');
  });

  it('shows an afternoon time on the 12-hour clock', () => {
    expect(formatTime('13:30')).toBe('1:30 PM');
  });
});
