/** Turns YYYY-MM-DD into MM/DD/YYYY. An empty or missing date shows an em dash. */
export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  const [year, month, day] = dateStr.split('-');
  return `${month}/${day}/${year}`;
}

/** Turns HH:MM (24-hour) into h:MM AM or h:MM PM. */
export function formatTime(time24: string): string {
  const [h, m] = time24.split(':').map(Number);
  const period = h < 12 ? 'AM' : 'PM';
  const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${hour12}:${String(m).padStart(2, '0')} ${period}`;
}
