import { addDays, listDatesInclusive } from '@/lib/dates';
import { getUsagePercent } from '@/lib/overheat';

/** True when intake stayed strictly below 100% of the daily target (no HOT-at-100% or OVERHEAT). */
export function isDailyTargetSuccess(usagePercent: number): boolean {
  return usagePercent < 1.0;
}

export function computeDailyUsage(intake: number, dailyTarget: number): number {
  return getUsagePercent(intake, dailyTarget);
}

/** Completed calendar days in [weekStart, weekEnd] that are strictly before today. */
export function listEvaluableDates(weekStart: string, weekEnd: string, today: string): string[] {
  const lastComplete = addDays(today, -1);
  if (lastComplete < weekStart) return [];
  const end = lastComplete < weekEnd ? lastComplete : weekEnd;
  return listDatesInclusive(weekStart, end);
}
