/** Hour (0-23) on the wall clock in `timeZone`. Falls back to Vietnam time for unknown zones. */
export function localHour(now: Date, timeZone: string): number {
  const hourIn = (tz: string) =>
    Number(new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', hourCycle: 'h23' }).format(now));
  try {
    return hourIn(timeZone);
  } catch {
    return hourIn('Asia/Ho_Chi_Minh');
  }
}
