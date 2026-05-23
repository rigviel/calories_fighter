import AsyncStorage from '@react-native-async-storage/async-storage';
import { buildBattleCareerStats, type BattleCareerStats } from '@/lib/battle-stats';
import { getTodayDate, getWeekDates, isDateInWeek } from '@/lib/dates';
import {
  computeTdeeFromProfile,
  computeWeeklyMonsterHp,
  generateMonsterName,
  getCalorieClass,
  isProfileComplete,
  migrateLegacyDifficultyId,
  TDEE_ACTIVITY_MULTIPLIER,
  type CalorieClassId,
  type Sex,
} from '@/lib/metabolism';

const STORAGE_KEY = '@calories/local-data';

export interface User {
  id: string;
  display_name: string | null;
  sex: Sex | null;
  age: number | null;
  weight_kg: number | null;
  height_cm: number | null;
  calorie_class_id: CalorieClassId | null;
  monster_name: string | null;
  /** Cached TDEE when profile is complete; otherwise null. */
  tdee: number | null;
  /** @deprecated Legacy field; use calorie_class_id. */
  current_difficulty_id?: string | null;
}

export { isProfileComplete } from '@/lib/metabolism';

interface WeeklyMonster {
  id: string;
  user_id: string;
  week_start: string;
  week_end: string;
  initial_hp: number;
  current_hp: number;
  difficulty_id: string | null;
}

interface DailyLog {
  id: string;
  user_id: string;
  monster_id: string;
  food_description: string;
  calories: number;
  log_date: string;
  created_at: string;
}

interface FoodMemory {
  user_id: string;
  food_name: string;
  calories: number;
  times_logged: number;
  last_used: string;
}

interface WeeklyResult {
  id: string;
  user_id: string;
  week_start: string;
  outcome: string;
  total_calories: number;
  target_calories: number;
  badge_earned?: string;
}

interface DailyOverheatRecord {
  date: string;
  state: 'cool' | 'warm' | 'hot' | 'overheat';
}

interface StoreData {
  userId: string | null;
  users: Record<string, User>;
  weeklyMonsters: WeeklyMonster[];
  dailyLogs: DailyLog[];
  foodMemory: FoodMemory[];
  weeklyResults: WeeklyResult[];
  dailyOverheat: Record<string, DailyOverheatRecord>;
  /** userId → YYYY-MM-DD → end-of-day overheat band */
  dailyOverheatHistory: Record<string, Record<string, DailyOverheatRecord['state']>>;
}

function createId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

function recalculateTdee(user: User): number | null {
  if (!isProfileComplete(user)) return null;
  return computeTdeeFromProfile(
    user.weight_kg!,
    user.height_cm!,
    user.age!,
    user.sex!
  );
}

function parseOptionalString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function parseOptionalIntInRange(value: unknown, min: number, max: number): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  const rounded = Math.round(value);
  if (rounded < min || rounded > max) return null;
  return rounded;
}

function parseOptionalWeight(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  if (value < 40 || value > 300) return null;
  return value;
}

function normalizeUser(raw: Record<string, unknown>, userId: string): User {
  const legacyDifficulty =
    (raw.current_difficulty_id as string | null | undefined) ??
    (raw.calorie_class_id as string | undefined);
  const calorieClassId = raw.calorie_class_id
    ? (raw.calorie_class_id as CalorieClassId)
    : legacyDifficulty
      ? migrateLegacyDifficultyId(legacyDifficulty)
      : null;

  const user: User = {
    id: userId,
    display_name: parseOptionalString(raw.display_name),
    sex: raw.sex === 'male' || raw.sex === 'female' ? raw.sex : null,
    age: parseOptionalIntInRange(raw.age, 13, 120),
    weight_kg: parseOptionalWeight(raw.weight_kg),
    height_cm: parseOptionalIntInRange(raw.height_cm, 100, 250),
    calorie_class_id: calorieClassId,
    monster_name: parseOptionalString(raw.monster_name),
    tdee: null,
    current_difficulty_id: raw.current_difficulty_id as string | null | undefined,
  };

  user.tdee = recalculateTdee(user);
  return user;
}

function createEmptyUser(userId: string): User {
  return {
    id: userId,
    display_name: null,
    sex: null,
    age: null,
    weight_kg: null,
    height_cm: null,
    calorie_class_id: null,
    monster_name: null,
    tdee: null,
  };
}

function normalizeStoreShape(store: StoreData): StoreData {
  if (!store.users) store.users = {};
  if (!store.weeklyMonsters) store.weeklyMonsters = [];
  if (!store.dailyLogs) store.dailyLogs = [];
  if (!store.foodMemory) store.foodMemory = [];
  if (!store.weeklyResults) store.weeklyResults = [];
  if (!store.dailyOverheat) store.dailyOverheat = {};
  if (!store.dailyOverheatHistory) store.dailyOverheatHistory = {};
  return store;
}

function migrateOverheatHistory(store: StoreData): void {
  if (!store.dailyOverheatHistory) store.dailyOverheatHistory = {};
  for (const [userId, record] of Object.entries(store.dailyOverheat ?? {})) {
    if (!record?.date) continue;
    if (!store.dailyOverheatHistory[userId]) store.dailyOverheatHistory[userId] = {};
    store.dailyOverheatHistory[userId][record.date] = record.state;
  }
}

/** Link session userId when profile exists but userId was never saved. */
function repairSessionUserId(store: StoreData): boolean {
  if (store.userId) return false;
  const userKeys = Object.keys(store.users);
  if (userKeys.length >= 1) {
    store.userId = userKeys[0];
    return true;
  }
  return false;
}

async function loadStore(): Promise<StoreData> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return {
      userId: null,
      users: {},
      weeklyMonsters: [],
      dailyLogs: [],
      foodMemory: [],
      weeklyResults: [],
      dailyOverheat: {},
      dailyOverheatHistory: {},
    };
  }
  const store = normalizeStoreShape(JSON.parse(raw) as StoreData);
  migrateOverheatHistory(store);

  for (const [id, user] of Object.entries(store.users)) {
    store.users[id] = normalizeUser(user as unknown as Record<string, unknown>, id);
  }

  if (repairSessionUserId(store)) {
    await saveStore(store);
  }

  return store;
}

async function saveStore(data: StoreData): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export async function getSession(): Promise<{ user: { id: string } } | null> {
  const store = await loadStore();
  if (!store.userId) return null;
  return { user: { id: store.userId } };
}

/**
 * Returns the hunter profile for this session, repairing legacy storage when needed.
 * Creates a default profile if the user has a session but never finished onboarding save.
 */
export async function ensureUserProfile(userId: string): Promise<User> {
  const store = await loadStore();
  normalizeStoreShape(store);

  const existing = store.users[userId];
  if (existing) {
    return { ...existing };
  }

  const userKeys = Object.keys(store.users);
  if (userKeys.length > 0) {
    const sourceKey = userKeys.find((k) => k === store.userId) ?? userKeys[0];
    const migrated = normalizeUser(
      store.users[sourceKey] as unknown as Record<string, unknown>,
      userId
    );
    store.users[userId] = migrated;
    if (sourceKey !== userId) {
      delete store.users[sourceKey];
    }
    store.userId = userId;
    await saveStore(store);
    return migrated;
  }

  const empty = createEmptyUser(userId);
  store.users[userId] = empty;
  await saveStore(store);
  return empty;
}

export async function ensureAnonymousSession(): Promise<{ user: { id: string } }> {
  const store = await loadStore();
  if (!store.userId) {
    store.userId = createId();
    await saveStore(store);
  }
  return { user: { id: store.userId } };
}

export async function isUserOnboarded(userId: string): Promise<boolean> {
  const store = await loadStore();
  if (store.users[userId]) return true;
  return Object.keys(store.users).length > 0;
}

export interface CreateUserInput {
  weightKg: number;
  calorieClassId: CalorieClassId;
}

/** Onboarding: store only weight + class; full profile is completed on Character Stat. */
export async function createUser(userId: string, input: CreateUserInput): Promise<User> {
  const store = await loadStore();
  normalizeStoreShape(store);
  if (!store.userId) {
    store.userId = userId;
  }
  const user: User = {
    ...createEmptyUser(userId),
    weight_kg: input.weightKg,
    calorie_class_id: input.calorieClassId,
  };
  user.tdee = recalculateTdee(user);
  store.users[userId] = user;
  await saveStore(store);
  return user;
}

export type UpdateUserProfileInput = {
  displayName: string;
  sex: Sex;
  age: number;
  weightKg: number;
  heightCm: number;
  calorieClassId: CalorieClassId;
  monsterName?: string | null;
};

export async function updateUserProfile(userId: string, updates: UpdateUserProfileInput): Promise<User> {
  const store = await loadStore();
  const existing = store.users[userId];
  if (!existing) {
    throw new Error('User not found');
  }

  const user: User = {
    ...existing,
    display_name: updates.displayName.trim(),
    sex: updates.sex,
    age: updates.age,
    weight_kg: updates.weightKg,
    height_cm: updates.heightCm,
    calorie_class_id: updates.calorieClassId,
    monster_name:
      updates.monsterName !== undefined ? updates.monsterName?.trim() || null : existing.monster_name,
  };

  if (!isProfileComplete(user)) {
    throw new Error('Profile is incomplete');
  }

  user.tdee = recalculateTdee(user);
  store.users[userId] = user;
  await saveStore(store);
  await recalibrateCurrentWeeklyMonster(userId);
  return user;
}

/** Recompute this week's max HP from profile; keeps calories already logged this week. */
export async function recalibrateCurrentWeeklyMonster(userId: string): Promise<WeeklyMonster | null> {
  const store = await loadStore();
  const user = store.users[userId];
  if (!user) return null;

  const today = getTodayDate();
  const { start, end } = getWeekDates();

  let monster = store.weeklyMonsters.find(
    (m) => m.user_id === userId && isDateInWeek(today, m.week_start, m.week_end)
  );

  if (!monster) {
    monster = store.weeklyMonsters.find((m) => m.user_id === userId && m.week_start === start);
  }

  // Legacy rows saved with UTC-shifted week keys — attach to the current week.
  if (!monster) {
    const legacy = store.weeklyMonsters
      .filter((m) => m.user_id === userId)
      .sort((a, b) => b.week_start.localeCompare(a.week_start))[0];
    if (!legacy) return null;
    legacy.week_start = start;
    legacy.week_end = end;
    monster = legacy;
  }

  if (!isProfileComplete(user) || user.tdee == null || !user.calorie_class_id) {
    return { ...monster };
  }

  const calorieClass = getCalorieClass(user.calorie_class_id);
  const newInitialHp = computeWeeklyMonsterHp(user.tdee, calorieClass.deficitPercentage);
  const consumed = Math.max(0, monster.initial_hp - monster.current_hp);

  monster.initial_hp = newInitialHp;
  monster.current_hp = Math.max(0, newInitialHp - consumed);
  monster.difficulty_id = user.calorie_class_id;

  await saveStore(store);
  return { ...monster };
}

export async function getUser(userId: string): Promise<User | null> {
  const store = await loadStore();
  const user = store.users[userId];
  return user ? { ...user } : null;
}

export async function getCalorieClassForUser(
  userId: string
): Promise<{ deficit_percentage: number; activity_multiplier: number }> {
  const user = await getUser(userId);
  const calorieClass = getCalorieClass(user?.calorie_class_id);
  return {
    deficit_percentage: calorieClass.deficitPercentage,
    activity_multiplier: TDEE_ACTIVITY_MULTIPLIER,
  };
}

/** @deprecated Use getCalorieClassForUser. Kept for battle screen compatibility during transition. */
export async function getDifficultyById(
  difficultyId: string | null
): Promise<{ deficit_percentage: number } | null> {
  const calorieClass = getCalorieClass(migrateLegacyDifficultyId(difficultyId));
  return { deficit_percentage: calorieClass.deficitPercentage };
}

export function resolveMonsterDisplayName(user: User): string {
  return user.monster_name?.trim() || generateMonsterName(user.id);
}

export async function getWeeklyMonster(
  userId: string,
  weekStart: string
): Promise<WeeklyMonster | null> {
  const store = await loadStore();
  return (
    store.weeklyMonsters.find((m) => m.user_id === userId && m.week_start === weekStart) ?? null
  );
}

export async function createWeeklyMonster(
  userId: string,
  weekStart: string,
  weekEnd: string,
  initialHp: number,
  difficultyId: string | null
): Promise<WeeklyMonster> {
  const store = await loadStore();
  const monster: WeeklyMonster = {
    id: createId(),
    user_id: userId,
    week_start: weekStart,
    week_end: weekEnd,
    initial_hp: initialHp,
    current_hp: initialHp,
    difficulty_id: difficultyId,
  };
  store.weeklyMonsters.push(monster);
  await saveStore(store);
  return monster;
}

export async function updateWeeklyMonsterHp(monsterId: string, currentHp: number): Promise<void> {
  const store = await loadStore();
  const monster = store.weeklyMonsters.find((m) => m.id === monsterId);
  if (monster) {
    monster.current_hp = currentHp;
    await saveStore(store);
  }
}

/** Atomically append a food log and reduce monster HP in one write. */
export async function logFoodAndUpdateMonster(
  userId: string,
  monsterId: string,
  foodDescription: string,
  calories: number,
  logDate: string
): Promise<{ log: DailyLog; monster: WeeklyMonster }> {
  const store = await loadStore();
  const monster = store.weeklyMonsters.find((m) => m.id === monsterId);
  if (!monster) {
    throw new Error('Weekly monster not found');
  }

  const log: DailyLog = {
    id: createId(),
    user_id: userId,
    monster_id: monsterId,
    food_description: foodDescription.trim(),
    calories,
    log_date: logDate,
    created_at: new Date().toISOString(),
  };

  monster.current_hp = Math.max(0, monster.current_hp - calories);
  store.dailyLogs.push(log);
  await saveStore(store);

  return { log, monster: { ...monster } };
}

/** Atomically remove a food log and restore monster HP in one write. */
export async function deleteDailyLogAndRestoreHp(
  logId: string
): Promise<WeeklyMonster | null> {
  const store = await loadStore();
  const log = store.dailyLogs.find((l) => l.id === logId);
  if (!log) return null;

  const monster = store.weeklyMonsters.find((m) => m.id === log.monster_id);
  store.dailyLogs = store.dailyLogs.filter((l) => l.id !== logId);

  if (monster) {
    monster.current_hp = Math.min(monster.initial_hp, monster.current_hp + log.calories);
  }

  await saveStore(store);
  return monster ? { ...monster } : null;
}

export async function getDailyLogs(
  userId: string,
  options?: { monsterId?: string; logDate?: string; limit?: number }
): Promise<DailyLog[]> {
  const store = await loadStore();
  let logs = store.dailyLogs.filter((l) => l.user_id === userId);

  if (options?.monsterId) {
    logs = logs.filter((l) => l.monster_id === options.monsterId);
  }
  if (options?.logDate) {
    logs = logs.filter((l) => l.log_date === options.logDate);
  }

  logs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  if (options?.limit) {
    logs = logs.slice(0, options.limit);
  }

  return logs;
}

export async function addDailyLog(
  userId: string,
  monsterId: string,
  foodDescription: string,
  calories: number,
  logDate: string
): Promise<DailyLog> {
  const store = await loadStore();
  const log: DailyLog = {
    id: createId(),
    user_id: userId,
    monster_id: monsterId,
    food_description: foodDescription,
    calories,
    log_date: logDate,
    created_at: new Date().toISOString(),
  };
  store.dailyLogs.push(log);
  await saveStore(store);
  return log;
}

export async function deleteDailyLog(logId: string): Promise<void> {
  const store = await loadStore();
  store.dailyLogs = store.dailyLogs.filter((l) => l.id !== logId);
  await saveStore(store);
}

export async function getFoodMemory(
  userId: string,
  foodName: string
): Promise<FoodMemory | null> {
  const store = await loadStore();
  const normalized = foodName.trim().toLowerCase();
  return (
    store.foodMemory.find(
      (f) => f.user_id === userId && f.food_name.trim().toLowerCase() === normalized
    ) ?? null
  );
}

export async function upsertFoodMemory(
  userId: string,
  foodName: string,
  calories: number
): Promise<void> {
  const store = await loadStore();
  const normalized = foodName.trim().toLowerCase();
  const existing = store.foodMemory.find(
    (f) => f.user_id === userId && f.food_name.trim().toLowerCase() === normalized
  );

  if (existing) {
    existing.times_logged += 1;
    existing.last_used = new Date().toISOString();
    existing.calories = calories;
  } else {
    store.foodMemory.push({
      user_id: userId,
      food_name: foodName,
      calories,
      times_logged: 1,
      last_used: new Date().toISOString(),
    });
  }

  await saveStore(store);
}

export function estimateCaloriesOffline(description: string): number {
  const words = description.toLowerCase().split(/\s+/).length;
  return Math.max(150, Math.min(800, 200 + words * 40));
}

export async function getDailyOverheatState(
  userId: string,
  todayDate: string
): Promise<DailyOverheatRecord | null> {
  const store = await loadStore();
  const record = store.dailyOverheat[userId];
  if (!record || record.date !== todayDate) return null;
  return record;
}

export async function setDailyOverheatState(
  userId: string,
  todayDate: string,
  state: DailyOverheatRecord['state']
): Promise<void> {
  const store = await loadStore();
  store.dailyOverheat[userId] = { date: todayDate, state };
  if (!store.dailyOverheatHistory[userId]) store.dailyOverheatHistory[userId] = {};
  store.dailyOverheatHistory[userId][todayDate] = state;
  await saveStore(store);
}

/** Finalize ended weeks (e.g. after Sunday) into weekly results. */
export async function processWeekRollover(userId: string): Promise<void> {
  const store = await loadStore();
  const today = getTodayDate();
  let changed = false;

  for (const monster of store.weeklyMonsters.filter((m) => m.user_id === userId)) {
    if (monster.week_end >= today) continue;

    const alreadyRecorded = store.weeklyResults.some(
      (r) => r.user_id === userId && r.week_start === monster.week_start
    );
    if (alreadyRecorded) continue;

    const consumed = Math.max(0, monster.initial_hp - monster.current_hp);
    const victory = monster.current_hp > 0;

    store.weeklyResults.push({
      id: createId(),
      user_id: userId,
      week_start: monster.week_start,
      outcome: victory ? 'victory' : 'defeat',
      total_calories: consumed,
      target_calories: monster.initial_hp,
      badge_earned: victory ? 'monster_defeated' : undefined,
    });
    changed = true;
  }

  if (changed) await saveStore(store);
}

export async function getBattleCareerStats(userId: string): Promise<BattleCareerStats> {
  const store = await loadStore();
  migrateOverheatHistory(store);

  const today = getTodayDate();
  const { start, end } = getWeekDates();

  const weekMonster =
    store.weeklyMonsters.find(
      (m) => m.user_id === userId && isDateInWeek(today, m.week_start, m.week_end)
    ) ?? null;

  const previousWeekMonster =
    store.weeklyMonsters
      .filter((m) => m.user_id === userId && m.week_end < start)
      .sort((a, b) => b.week_start.localeCompare(a.week_start))[0] ?? null;

  const history = store.dailyOverheatHistory[userId] ?? {};
  const logs = store.dailyLogs.filter((l) => l.user_id === userId);
  const weeklyResults = store.weeklyResults.filter((r) => r.user_id === userId);

  return buildBattleCareerStats({
    today,
    weekStart: start,
    weekEnd: end,
    weeklyResults,
    overheatHistory: history,
    logs,
    weekMonster,
    previousWeekMonster,
  });
}

export type { BattleCareerStats };

export async function getWeeklyResults(userId: string, limit = 10): Promise<WeeklyResult[]> {
  const store = await loadStore();
  return store.weeklyResults
    .filter((r) => r.user_id === userId)
    .sort((a, b) => new Date(b.week_start).getTime() - new Date(a.week_start).getTime())
    .slice(0, limit);
}

export type { WeeklyMonster, DailyLog, WeeklyResult };
