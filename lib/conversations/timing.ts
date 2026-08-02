/** Idle cutoff for active conversation timing (ms). */
export const IDLE_CUTOFF_MS = 5 * 60 * 1000;

export type TimingState = {
  opened_at: string | null;
  answered_at: string | null;
  actual_time_seconds: number;
  paused_duration_seconds: number;
  /** Last activity timestamp ISO — used for idle detection. */
  last_active_at: string | null;
};

/**
 * Compute active seconds between open and answer, excluding idle gaps
 * longer than the cutoff and explicit pause duration.
 */
export function measureActiveSeconds(input: {
  openedAt: string | null;
  answeredAt: string | null;
  pausedDurationSeconds?: number;
  now?: Date;
}): number {
  if (!input.openedAt) return 0;
  const start = Date.parse(input.openedAt);
  const end = Date.parse(input.answeredAt ?? (input.now ?? new Date()).toISOString());
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 0;

  const raw = Math.floor((end - start) / 1000);
  const pause = input.pausedDurationSeconds ?? 0;
  // Cap any single stretch at idle cutoff so abandoned tabs don't inflate time.
  const capped = Math.min(raw, Math.floor(IDLE_CUTOFF_MS / 1000));
  return Math.max(0, capped - pause);
}

export function shouldPauseForIdle(
  lastActiveAt: string | null,
  now = new Date(),
): boolean {
  if (!lastActiveAt) return false;
  const last = Date.parse(lastActiveAt);
  if (!Number.isFinite(last)) return false;
  return now.getTime() - last >= IDLE_CUTOFF_MS;
}

/** Approximate active minutes for session review (never presented as a score). */
export function formatApproximateActiveTime(activeSeconds: number): string {
  if (activeSeconds < 60) return "Under a minute";
  const mins = Math.round(activeSeconds / 60);
  if (mins === 1) return "About 1 minute";
  return `About ${mins} minutes`;
}
