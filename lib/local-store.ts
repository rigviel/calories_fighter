import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@calories/local-data';

const DIFFICULTIES: Record<string, { id: string; name: string; deficit_percentage: number }> = {
  beginner: { id: 'beginner', name: 'beginner', deficit_percentage: 10 },
  warrior: { id: 'warrior', name: 'warrior', deficit_percentage: 17.5 },
  elite: { id: 'elite', name: 'elite', deficit_percentage: 22.5 },
  maintenance: { id: 'maintenance', name: 'maintenance', deficit_percentage: 0 },
};

interface User {
  id: string;
  weight_kg: number;
  tdee: number;
  current_difficulty_id: string | null;
}

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
}

function createId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
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
    };
  }
  const store = JSON.parse(raw) as StoreData;
  if (!store.dailyOverheat) store.dailyOverheat = {};
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
  return !!store.users[userId];
}

export async function createUser(
  userId: string,
  weightKg: number,
  tdee: number,
  difficultyName: string
): Promise<void> {
  const store = await loadStore();
  const difficulty = DIFFICULTIES[difficultyName];
  store.users[userId] = {
    id: userId,
    weight_kg: weightKg,
    tdee,
    current_difficulty_id: difficulty?.id ?? null,
  };
  await saveStore(store);
}

export async function getUser(userId: string): Promise<User | null> {
  const store = await loadStore();
  return store.users[userId] ?? null;
}

export async function getDifficultyById(
  difficultyId: string | null
): Promise<{ deficit_percentage: number } | null> {
  if (!difficultyId) return null;
  const match = Object.values(DIFFICULTIES).find((d) => d.id === difficultyId);
  return match ?? null;
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
  await saveStore(store);
}

export async function getWeeklyResults(userId: string, limit = 10): Promise<WeeklyResult[]> {
  const store = await loadStore();
  return store.weeklyResults
    .filter((r) => r.user_id === userId)
    .sort((a, b) => new Date(b.week_start).getTime() - new Date(a.week_start).getTime())
    .slice(0, limit);
}

export type { User, WeeklyMonster, DailyLog, WeeklyResult };
