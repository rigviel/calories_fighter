/** Successful on-target days in one calendar week required for the bonus hit. */
export const WEEKLY_CONSISTENCY_BONUS_THRESHOLD = 4;

export interface WeeklyConsistencyState {
  weekly_success_count: number;
  weekly_bonus_granted: boolean;
  pending_hits: number;
}

export interface DailyHitAwardRecord {
  user_id: string;
  date: string;
  awarded: boolean;
}

export function countSuccessfulDaysInWeek(
  records: DailyHitAwardRecord[],
  userId: string,
  weekStart: string,
  weekEnd: string
): number {
  return records.filter(
    (r) =>
      r.user_id === userId &&
      r.awarded &&
      r.date >= weekStart &&
      r.date <= weekEnd
  ).length;
}

/** Sync success counter from persisted daily hit rows (migration / idempotent refresh). */
export function reconcileWeeklySuccessCount(
  monster: WeeklyConsistencyState & { week_start: string; week_end: string },
  records: DailyHitAwardRecord[],
  userId: string
): void {
  monster.weekly_success_count = countSuccessfulDaysInWeek(
    records,
    userId,
    monster.week_start,
    monster.week_end
  );
}

/** Call after a newly evaluated successful day (counter already reconciled for prior days). */
export function incrementWeeklySuccessCount(monster: WeeklyConsistencyState): void {
  monster.weekly_success_count = (monster.weekly_success_count ?? 0) + 1;
  tryGrantWeeklyConsistencyBonus(monster);
}

/**
 * Award exactly one bonus pending hit when the week reaches the success threshold.
 * @returns true if the bonus was granted this call
 */
export function tryGrantWeeklyConsistencyBonus(monster: WeeklyConsistencyState): boolean {
  if (
    (monster.weekly_success_count ?? 0) >= WEEKLY_CONSISTENCY_BONUS_THRESHOLD &&
    !monster.weekly_bonus_granted
  ) {
    monster.pending_hits = (monster.pending_hits ?? 0) + 1;
    monster.weekly_bonus_granted = true;
    return true;
  }
  return false;
}

export function initialWeeklyConsistencyState(): Pick<
  WeeklyConsistencyState,
  'weekly_success_count' | 'weekly_bonus_granted'
> {
  return {
    weekly_success_count: 0,
    weekly_bonus_granted: false,
  };
}
