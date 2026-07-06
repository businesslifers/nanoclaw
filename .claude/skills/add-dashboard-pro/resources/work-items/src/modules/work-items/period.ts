/**
 * Date/period helpers for work items — timezone-pinned day and ISO-week math
 * shared by the sweep (tier cascade, cadence RAG) and the complete handler
 * (cadence period stamping). Ports the deterministic date logic from LPG's
 * dependency-cascade.mjs / cadence-health.mjs unchanged.
 */

/** YYYY-MM-DD for "today" in the given IANA timezone (en-CA gives ISO order). */
export function todayInTz(tz: string, now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(now);
}

function ymdParts(ymd: string): { y: number; m: number; d: number } {
  const [y, m, d] = ymd.split('-').map(Number);
  return { y, m, d };
}

/** Parse a YYYY-MM-DD as UTC midnight so day-diffs are whole-day and DST-safe. */
export function utcMidnight(ymd: string): number {
  const { y, m, d } = ymdParts(ymd);
  return Date.UTC(y, m - 1, d);
}

/** Whole days from `fromYmd` to `toYmd` (positive = future). */
export function daysBetween(fromYmd: string, toYmd: string): number {
  return Math.round((utcMidnight(toYmd) - utcMidnight(fromYmd)) / 86_400_000);
}

/** ISO weekday 1=Mon .. 7=Sun for a YYYY-MM-DD. */
export function isoDow(ymd: string): number {
  const { y, m, d } = ymdParts(ymd);
  return ((new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7) + 1;
}

/** ISO week label (e.g. "2026-W26") for a YYYY-MM-DD. */
export function isoWeek(ymd: string): string {
  const { y, m, d } = ymdParts(ymd);
  const date = new Date(Date.UTC(y, m - 1, d));
  const dayNum = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - dayNum + 3); // Thursday of this week
  const firstThu = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
  const firstDayNum = (firstThu.getUTCDay() + 6) % 7;
  firstThu.setUTCDate(firstThu.getUTCDate() - firstDayNum + 3);
  const week = 1 + Math.round((date.getTime() - firstThu.getTime()) / (7 * 86_400_000));
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

/**
 * Normalize a due/follow-up value to YYYY-MM-DD in the given timezone.
 * Accepts date-only strings as-is; full ISO timestamps are converted to the
 * calendar day they fall on in that timezone. Returns null when unparseable.
 */
export function toLocalYmd(value: string | null | undefined, tz: string): string | null {
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return todayInTz(tz, parsed);
}
