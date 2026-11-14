import type { WeekRecord } from "./types";

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function computeCyclePool(carriedOverLocked: number, depositAmount: number): number {
  return round2(carriedOverLocked + depositAmount);
}

export function computeWeeklyUnlockAmount(cyclePool: number, durationWeeks: number): number {
  if (durationWeeks <= 0) return 0;
  return round2(cyclePool / durationWeeks);
}

/**
 * A week settles once its verified minutes meet the target. The unlock amount
 * moves from locked to claimable; a missed week's share simply stays locked
 * (no third party ever receives it).
 */
export function settleWeek(
  week: WeekRecord,
  weeklyUnlockAmount: number
): { met: boolean; unlockedAmount: number } {
  const met = week.verifiedMinutes >= week.target_minutes;
  return { met, unlockedAmount: met ? weeklyUnlockAmount : 0 };
}

/** Total sessions ever completed for this goal, used to index the next book chunk. */
export function totalCompletedSessions(weeks: WeekRecord[]): number {
  return weeks.reduce((sum, w) => sum + w.verifiedSessions, 0);
}

export function computeCurrentStreak(weeks: WeekRecord[]): number {
  let streak = 0;
  for (let i = weeks.length - 1; i >= 0; i--) {
    const w = weeks[i];
    if (!w.settled) continue;
    if (w.unlockedAmount > 0) {
      streak++;
    } else {
      break;
    }
  }
  return streak;
}
