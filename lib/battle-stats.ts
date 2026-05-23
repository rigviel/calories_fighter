import { addDays, listDatesInclusive } from '@/lib/dates';
import { computeOverheatState, getDailyTarget, getTodayIntake, type OverheatState } from '@/lib/overheat';

export interface BattleCareerStats {
  weekWinStreak: number;
  monstersDefeated: number;
  weeksPlayed: number;
  winRatePercent: number;
  currentCoolStreak: number;
  bestCoolStreak: number;
  coolDaysThisWeek: number;
  daysTrackedThisWeek: number;
  lastWeekOutcome: 'victory' | 'defeat' | null;
  overheatDaysThisWeek: number;
}

interface WeeklyResultLike {
  week_start: string;
  outcome: string;
}

interface DailyLogLike {
  log_date: string;
  calories: number;
}

interface WeekMonsterLike {
  week_start: string;
  week_end: string;
  initial_hp: number;
}

function resolveDayState(
  date: string,
  history: Record<string, OverheatState>,
  logs: DailyLogLike[],
  monster: WeekMonsterLike | null
): OverheatState | null {
  if (history[date]) return history[date];
  if (!monster) return null;

  const dayLogs = logs.filter((log) => log.log_date === date);
  if (dayLogs.length === 0) return null;

  const intake = getTodayIntake(dayLogs);
  const dailyTarget = getDailyTarget(monster.initial_hp);
  if (dailyTarget <= 0) return null;
  return computeOverheatState(intake / dailyTarget);
}

function computeBestCoolStreak(coolByDate: Record<string, boolean>): number {
  const dates = Object.keys(coolByDate)
    .filter((d) => coolByDate[d])
    .sort();
  if (dates.length === 0) return 0;

  let best = 1;
  let run = 1;
  for (let i = 1; i < dates.length; i++) {
    const prev = dates[i - 1];
    const curr = dates[i];
    if (addDays(prev, 1) === curr) {
      run++;
      best = Math.max(best, run);
    } else {
      run = 1;
    }
  }
  return best;
}

/** Consecutive weekly victories, most recent finished weeks first. */
function computeWeekWinStreak(weeklyResults: WeeklyResultLike[]): number {
  const sorted = [...weeklyResults].sort((a, b) => b.week_start.localeCompare(a.week_start));
  let streak = 0;
  for (const result of sorted) {
    if (result.outcome === 'victory') streak++;
    else break;
  }
  return streak;
}

function computeCurrentCoolStreak(coolByDate: Record<string, boolean>, fromDate: string): number {
  let streak = 0;
  let cursor = fromDate;
  const maxLookback = 400;

  for (let i = 0; i < maxLookback; i++) {
    if (!coolByDate[cursor]) break;
    streak++;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

export function buildBattleCareerStats(input: {
  today: string;
  weekStart: string;
  weekEnd: string;
  weeklyResults: WeeklyResultLike[];
  overheatHistory: Record<string, OverheatState>;
  logs: DailyLogLike[];
  weekMonster: WeekMonsterLike | null;
  previousWeekMonster: WeekMonsterLike | null;
}): BattleCareerStats {
  const victories = input.weeklyResults.filter((r) => r.outcome === 'victory');
  const monstersDefeated = victories.length;
  const weeksPlayed = input.weeklyResults.length;
  const winRatePercent =
    weeksPlayed > 0 ? Math.round((monstersDefeated / weeksPlayed) * 100) : 0;

  const coolByDate: Record<string, boolean> = {};
  const allDates = new Set<string>([
    ...Object.keys(input.overheatHistory),
    ...input.logs.map((l) => l.log_date),
  ]);

  for (const date of allDates) {
    const monster =
      input.weekMonster &&
      date >= input.weekMonster.week_start &&
      date <= input.weekMonster.week_end
        ? input.weekMonster
        : input.previousWeekMonster &&
            date >= input.previousWeekMonster.week_start &&
            date <= input.previousWeekMonster.week_end
          ? input.previousWeekMonster
          : input.weekMonster ?? input.previousWeekMonster;

    const state = resolveDayState(date, input.overheatHistory, input.logs, monster);
    if (state) {
      coolByDate[date] = state === 'cool';
    }
  }

  const weekDates = listDatesInclusive(input.weekStart, input.weekEnd).filter(
    (d) => d <= input.today
  );
  let coolDaysThisWeek = 0;
  let daysTrackedThisWeek = 0;
  let overheatDaysThisWeek = 0;

  for (const date of weekDates) {
    const state = resolveDayState(
      date,
      input.overheatHistory,
      input.logs,
      input.weekMonster
    );
    if (!state) continue;
    daysTrackedThisWeek++;
    if (state === 'cool') coolDaysThisWeek++;
    if (state === 'overheat') overheatDaysThisWeek++;
  }

  const lastWeekResult = input.weeklyResults
    .filter((r) => r.week_start < input.weekStart)
    .sort((a, b) => b.week_start.localeCompare(a.week_start))[0];

  const lastWeekOutcome =
    lastWeekResult?.outcome === 'victory'
      ? 'victory'
      : lastWeekResult?.outcome === 'defeat'
        ? 'defeat'
        : null;

  const currentCoolStreak = computeCurrentCoolStreak(coolByDate, input.today);
  const bestCoolStreak = Math.max(computeBestCoolStreak(coolByDate), currentCoolStreak);

  return {
    weekWinStreak: computeWeekWinStreak(input.weeklyResults),
    monstersDefeated,
    weeksPlayed,
    winRatePercent,
    currentCoolStreak,
    bestCoolStreak,
    coolDaysThisWeek,
    daysTrackedThisWeek,
    lastWeekOutcome,
    overheatDaysThisWeek,
  };
}
