export type OverheatState = 'cool' | 'warm' | 'hot' | 'overheat';

const EMOTION_TEXT: Record<OverheatState, string[]> = {
  cool: ['Calm', 'Good', 'Stable'],
  warm: ['OK', 'Careful', 'Not bad'],
  hot: ['Warning', 'Focus', 'Too much'],
  overheat: ['STOP', 'Danger', 'Overload'],
};

const MONSTER_EXPRESSION: Record<OverheatState, { emoji: string; label: string }> = {
  cool: { emoji: '😊', label: 'Happy' },
  warm: { emoji: '😐', label: 'Alert' },
  hot: { emoji: '😰', label: 'Stressed' },
  overheat: { emoji: '🤯', label: 'Panic' },
};

/** dailyTarget = weeklyBudget / 7 */
export function getDailyTarget(weeklyBudget: number): number {
  return weeklyBudget / 7;
}

export function getTodayIntake(logs: { calories: number }[]): number {
  return logs.reduce((sum, log) => sum + log.calories, 0);
}

/** usagePercent as decimal (0.8 = 80% of daily target). */
export function getUsagePercent(todayIntake: number, dailyTarget: number): number {
  if (dailyTarget <= 0) return 0;
  return todayIntake / dailyTarget;
}

/** Display percent for bar label (0–100+). */
export function getUsagePercentDisplay(usagePercent: number): number {
  return usagePercent * 100;
}

export function computeOverheatState(usagePercent: number): OverheatState {
  if (usagePercent < 0.8) return 'cool';
  if (usagePercent < 0.85) return 'warm';
  if (usagePercent <= 1.0) return 'hot';
  return 'overheat';
}

/** True when intake crossed into a new threshold band. */
export function hasCrossedThreshold(
  currentState: OverheatState,
  usagePercent: number
): boolean {
  return computeOverheatState(usagePercent) !== currentState;
}

export function pickEmotionText(state: OverheatState, logCount: number): string {
  const options = EMOTION_TEXT[state];
  return options[logCount % options.length];
}

export function getMonsterExpression(state: OverheatState) {
  return MONSTER_EXPRESSION[state];
}

export function getBarFillWidth(usagePercent: number): number {
  return Math.max(0, Math.min(usagePercent * 100, 100));
}

export function isOverheatGlow(state: OverheatState): boolean {
  return state === 'overheat';
}

export function shouldShake(state: OverheatState): 'none' | 'slight' | 'strong' {
  if (state === 'hot') return 'slight';
  if (state === 'overheat') return 'strong';
  return 'none';
}
