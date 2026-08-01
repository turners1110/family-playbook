/**
 * Timezone-safe calendar date helpers for Before Baby scheduling.
 * All public APIs use YYYY-MM-DD strings and UTC noon math to avoid DST shifts.
 */

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isDateOnly(value: string | null | undefined): value is string {
  return Boolean(value && DATE_RE.test(value));
}

/** Parse YYYY-MM-DD as a UTC calendar date (noon UTC). */
export function parseDateOnly(value: string): Date {
  if (!isDateOnly(value)) {
    throw new Error(`Invalid date: ${value}`);
  }
  const [y, m, d] = value.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
}

export function formatDateOnly(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function addDays(dateOnly: string, days: number): string {
  const date = parseDateOnly(dateOnly);
  date.setUTCDate(date.getUTCDate() + days);
  return formatDateOnly(date);
}

export function diffDays(fromDateOnly: string, toDateOnly: string): number {
  const from = parseDateOnly(fromDateOnly).getTime();
  const to = parseDateOnly(toDateOnly).getTime();
  return Math.round((to - from) / 86_400_000);
}

export function todayDateOnly(now = new Date()): string {
  return formatDateOnly(
    new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 12)),
  );
}

export function dayOfWeek(dateOnly: string): number {
  // 0 = Sunday … 6 = Saturday (UTC)
  return parseDateOnly(dateOnly).getUTCDay();
}

export function startOfWeekMonday(dateOnly: string): string {
  const dow = dayOfWeek(dateOnly); // 0 Sun
  const offset = dow === 0 ? -6 : 1 - dow;
  return addDays(dateOnly, offset);
}

export function endOfWeekSunday(dateOnly: string): string {
  const monday = startOfWeekMonday(dateOnly);
  return addDays(monday, 6);
}

export function formatShortDate(dateOnly: string): string {
  const date = parseDateOnly(dateOnly);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

/** Standard pregnancy assumption: 40 weeks (280 days) before due date = conception week 0. */
export const PREGNANCY_LENGTH_DAYS = 280;

export type PregnancyProgress = {
  due_date: string;
  days_remaining: number;
  /** Approximate completed pregnancy week (0–40+). Date math only — not medical advice. */
  pregnancy_week: number;
  trimester: 1 | 2 | 3 | null;
  label: string;
};

export function computePregnancyProgress(
  dueDate: string,
  today = todayDateOnly(),
): PregnancyProgress {
  const daysRemaining = diffDays(today, dueDate);
  const daysPregnant = PREGNANCY_LENGTH_DAYS - daysRemaining;
  const pregnancyWeek = Math.max(
    0,
    Math.min(45, Math.floor(daysPregnant / 7)),
  );
  let trimester: 1 | 2 | 3 | null = null;
  if (daysPregnant >= 0 && daysPregnant < 98) trimester = 1;
  else if (daysPregnant >= 98 && daysPregnant < 196) trimester = 2;
  else if (daysPregnant >= 196) trimester = 3;

  return {
    due_date: dueDate,
    days_remaining: daysRemaining,
    pregnancy_week: pregnancyWeek,
    trimester,
    label:
      daysRemaining >= 0
        ? `${daysRemaining} day${daysRemaining === 1 ? "" : "s"} remaining · ~week ${pregnancyWeek}`
        : `${Math.abs(daysRemaining)} day${Math.abs(daysRemaining) === 1 ? "" : "s"} past due date`,
  };
}
