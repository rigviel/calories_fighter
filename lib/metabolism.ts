export type Sex = 'male' | 'female';
export type CalorieClassId = 'casual' | 'balanced' | 'warrior' | 'berserker';

/** Shared moderate-activity baseline for TDEE (class only changes deficit %). */
export const TDEE_ACTIVITY_MULTIPLIER = 1.55;

export interface CalorieClass {
  id: CalorieClassId;
  label: string;
  emoji: string;
  /** Shown in UI — describes cut intensity, not a separate activity tier. */
  cutLabel: string;
  deficitPercentage: number;
}

export const CALORIE_CLASSES: Record<CalorieClassId, CalorieClass> = {
  casual: {
    id: 'casual',
    label: 'Casual',
    emoji: '🟢',
    cutLabel: 'Gentle cut',
    deficitPercentage: 10,
  },
  balanced: {
    id: 'balanced',
    label: 'Balanced',
    emoji: '🟡',
    cutLabel: 'Moderate cut',
    deficitPercentage: 15,
  },
  warrior: {
    id: 'warrior',
    label: 'Warrior',
    emoji: '🟠',
    cutLabel: 'Strong cut',
    deficitPercentage: 20,
  },
  berserker: {
    id: 'berserker',
    label: 'Berserker',
    emoji: '🔴',
    cutLabel: 'Aggressive cut',
    deficitPercentage: 25,
  },
};

export type ProfileField = 'name' | 'sex' | 'age' | 'weight' | 'height' | 'class';

export interface ProfileFields {
  display_name: string | null;
  sex: Sex | null;
  age: number | null;
  weight_kg: number | null;
  height_cm: number | null;
  calorie_class_id: CalorieClassId | null;
}

export const PROFILE_FIELD_LABELS: Record<ProfileField, string> = {
  name: 'Name',
  sex: 'Sex',
  age: 'Age',
  weight: 'Weight',
  height: 'Height',
  class: 'Calorie class',
};

export function getMissingProfileFields(profile: ProfileFields): ProfileField[] {
  const missing: ProfileField[] = [];
  if (!profile.display_name?.trim()) missing.push('name');
  if (!profile.sex) missing.push('sex');
  if (profile.age == null || profile.age < 13 || profile.age > 120) missing.push('age');
  if (profile.weight_kg == null || profile.weight_kg < 40 || profile.weight_kg > 300) {
    missing.push('weight');
  }
  if (profile.height_cm == null || profile.height_cm < 100 || profile.height_cm > 250) {
    missing.push('height');
  }
  if (!profile.calorie_class_id) missing.push('class');
  return missing;
}

export function isProfileComplete(profile: ProfileFields): boolean {
  return getMissingProfileFields(profile).length === 0;
}

export function formatMissingProfileHint(missing: ProfileField[]): string {
  if (missing.length === 0) return '';
  const labels = missing.map((f) => PROFILE_FIELD_LABELS[f]);
  return `Please enter: ${labels.join(', ')}.`;
}

/** Mifflin–St Jeor BMR (kcal/day). */
export function computeBMR(
  weightKg: number,
  heightCm: number,
  age: number,
  sex: Sex
): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  return Math.round(sex === 'male' ? base + 5 : base - 161);
}

export function computeTDEE(bmr: number, activityMultiplier: number): number {
  return Math.round(bmr * activityMultiplier);
}

export function computeWeeklyMonsterHp(tdee: number, deficitPercentage: number): number {
  const deficit = deficitPercentage / 100;
  return Math.round(tdee * 7 * (1 - deficit));
}

export function computeTdeeFromProfile(
  weightKg: number,
  heightCm: number,
  age: number,
  sex: Sex
): number {
  return computeTDEE(computeBMR(weightKg, heightCm, age, sex), TDEE_ACTIVITY_MULTIPLIER);
}

export function getCalorieClass(classId: string | null | undefined): CalorieClass {
  if (classId && classId in CALORIE_CLASSES) {
    return CALORIE_CLASSES[classId as CalorieClassId];
  }
  return CALORIE_CLASSES.balanced;
}

/** Map legacy difficulty ids from older builds. */
export function migrateLegacyDifficultyId(legacyId: string | null | undefined): CalorieClassId {
  switch (legacyId) {
    case 'beginner':
      return 'casual';
    case 'warrior':
      return 'warrior';
    case 'elite':
      return 'berserker';
    case 'maintenance':
      return 'balanced';
    case 'casual':
    case 'balanced':
    case 'berserker':
      return legacyId;
    default:
      return 'balanced';
  }
}

export function generateMonsterName(userId: string): string {
  const suffix = userId.slice(-4).toUpperCase() || '0000';
  const names = ['Gloom', 'Munch', 'Belly', 'Crave', 'Nom'];
  const pick = names[userId.length % names.length];
  return `${pick}-${suffix}`;
}

export type MonsterSheetState = 'stable' | 'tired' | 'overheated';

export function mapOverheatToMonsterState(
  overheat: 'cool' | 'warm' | 'hot' | 'overheat' | null
): MonsterSheetState {
  switch (overheat) {
    case 'hot':
      return 'tired';
    case 'overheat':
      return 'overheated';
    default:
      return 'stable';
  }
}
