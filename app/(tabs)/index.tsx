import { View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { useFocusEffect } from 'expo-router';
import {
  createWeeklyMonster,
  deleteDailyLogAndRestoreHp,
  ensureAnonymousSession,
  getDailyLogs,
  getDailyOverheatState,
  getDifficultyById,
  getSession,
  getUser,
  getWeeklyMonster,
  logFoodAndUpdateMonster,
  setDailyOverheatState,
  upsertFoodMemory,
  type WeeklyMonster,
} from '@/lib/local-store';
import {
  computeOverheatState,
  getDailyTarget,
  getMonsterExpression,
  getTodayIntake,
  getUsagePercent,
  hasCrossedThreshold,
  pickEmotionText,
  shouldShake,
  type OverheatState,
} from '@/lib/overheat';
import { OverheatBar } from '@/components/OverheatBar';
import { Plus, Trash2 } from 'lucide-react-native';

function getWeekDates() {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
  const monday = new Date(now.getFullYear(), now.getMonth(), diff);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return {
    start: monday.toISOString().split('T')[0],
    end: sunday.toISOString().split('T')[0],
  };
}

function getTodayDate() {
  return new Date().toISOString().split('T')[0];
}

function parseCalories(value: string): number | null {
  const parsed = Number.parseInt(value.trim(), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
}

interface DailyLog {
  id: string;
  food_description: string;
  calories: number;
  log_date: string;
}

export default function BattleScreen() {
  const [monster, setMonster] = useState<WeeklyMonster | null>(null);
  const [todayLogs, setTodayLogs] = useState<DailyLog[]>([]);
  const [foodInput, setFoodInput] = useState('');
  const [caloriesInput, setCaloriesInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [dailyTarget, setDailyTarget] = useState(1444);
  const [overheatState, setOverheatState] = useState<OverheatState>('cool');
  const [emotionText, setEmotionText] = useState('Calm');
  const [error, setError] = useState('');
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const trackedDateRef = useRef(getTodayDate());

  const loadWeeklyMonster = useCallback(async (uid: string): Promise<WeeklyMonster | null> => {
    const { start, end } = getWeekDates();
    const userData = await getUser(uid);
    const diffData = await getDifficultyById(userData?.current_difficulty_id ?? null);

    const deficitPct = diffData?.deficit_percentage ?? 17.5;
    const deficit = deficitPct / 100;
    const tdee = userData?.tdee || 1750;
    const weeklyBudget = tdee * 7 * (1 - deficit);

    const existingMonster = await getWeeklyMonster(uid, start);

    const activeMonster =
      existingMonster ??
      (await createWeeklyMonster(
        uid,
        start,
        end,
        weeklyBudget,
        userData?.current_difficulty_id ?? null
      ));

    setMonster(activeMonster);
    setDailyTarget(getDailyTarget(activeMonster.initial_hp));

    const today = getTodayDate();
    const logs = await getDailyLogs(uid, {
      monsterId: activeMonster.id,
      logDate: today,
    });
    setTodayLogs(logs);

    const intake = getTodayIntake(logs);
    const usage = getUsagePercent(intake, getDailyTarget(activeMonster.initial_hp));
    const computed = computeOverheatState(usage);
    trackedDateRef.current = today;

    const stored = await getDailyOverheatState(uid, today);
    let state: OverheatState = stored?.state ?? computed;
    if (stored && hasCrossedThreshold(stored.state, usage)) {
      state = computed;
      await setDailyOverheatState(uid, today, state);
    } else if (!stored) {
      await setDailyOverheatState(uid, today, state);
    }

    setOverheatState(state);
    setEmotionText(pickEmotionText(state, logs.length));

    return activeMonster;
  }, []);

  useFocusEffect(
    useCallback(() => {
      const init = async () => {
        setError('');
        const session = await getSession();
        const uid = session?.user?.id ?? (await ensureAnonymousSession()).user.id;
        setUserId(uid);
        await loadWeeklyMonster(uid);
      };
      init();
    }, [loadWeeklyMonster])
  );

  const handleLogFood = async () => {
    const calories = parseCalories(caloriesInput);
    if (!foodInput.trim() || calories === null || !userId) {
      setError('Enter a food name and valid calories.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      let activeMonster = monster;
      if (!activeMonster) {
        activeMonster = await loadWeeklyMonster(userId);
      }
      if (!activeMonster) {
        setError('Could not load your weekly monster. Try again.');
        return;
      }

      const { log, monster: updatedMonster } = await logFoodAndUpdateMonster(
        userId,
        activeMonster.id,
        foodInput,
        calories,
        getTodayDate()
      );

      await upsertFoodMemory(userId, foodInput, calories);

      setMonster(updatedMonster);
      setTodayLogs((prev) => [log, ...prev]);
      setFoodInput('');
      setCaloriesInput('');

      Animated.sequence([
        Animated.spring(scaleAnim, { toValue: 1.1, useNativeDriver: true }),
        Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true }),
      ]).start();
    } catch (err) {
      console.error('Error logging food:', err);
      setError('Failed to log food. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteLog = async (logId: string) => {
    if (!userId) return;
    try {
      const updatedMonster = await deleteDailyLogAndRestoreHp(logId);
      if (updatedMonster) {
        setMonster(updatedMonster);
      }
      setTodayLogs((prev) => prev.filter((l) => l.id !== logId));
    } catch (err) {
      console.error('Error deleting log:', err);
    }
  };

  const canLog =
    foodInput.trim().length > 0 && parseCalories(caloriesInput) !== null && !loading;

  const todayIntake = useMemo(() => getTodayIntake(todayLogs), [todayLogs]);
  const usagePercent = useMemo(
    () => getUsagePercent(todayIntake, dailyTarget),
    [todayIntake, dailyTarget]
  );
  const monsterExpression = useMemo(
    () => getMonsterExpression(overheatState),
    [overheatState]
  );
  const hpPercent = monster ? (monster.current_hp / monster.initial_hp) * 100 : 100;
  const shakeLevel = shouldShake(overheatState);

  useEffect(() => {
    if (!userId || dailyTarget <= 0) return;

    const today = getTodayDate();
    const usage = getUsagePercent(todayIntake, dailyTarget);
    const computed = computeOverheatState(usage);

    if (today !== trackedDateRef.current) {
      trackedDateRef.current = today;
      setOverheatState('cool');
      setEmotionText(pickEmotionText('cool', 0));
      void setDailyOverheatState(userId, today, 'cool');
      return;
    }

    if (hasCrossedThreshold(overheatState, usage)) {
      setOverheatState(computed);
      setEmotionText(pickEmotionText(computed, todayLogs.length));
      void setDailyOverheatState(userId, today, computed);
    }
  }, [todayIntake, dailyTarget, userId, todayLogs.length, overheatState]);

  useEffect(() => {
    if (shakeLevel === 'none') {
      shakeAnim.setValue(0);
      return;
    }

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(shakeAnim, { toValue: 1, duration: 80, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: -1, duration: 80, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 0, duration: 80, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [shakeLevel, shakeAnim]);

  const shakeTranslate = useMemo(
    () =>
      shakeAnim.interpolate({
        inputRange: [-1, 1],
        outputRange: shakeLevel === 'slight' ? [-2, 2] : [-5, 5],
      }),
    [shakeAnim, shakeLevel]
  );

  return (
    <LinearGradient colors={['#0F172A', '#111827']} style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>Weekly Battle</Text>
          <Text style={styles.subtitle}>Defeat the monster this week</Text>
        </View>

        <Animated.View
          style={[
            styles.monsterCard,
            {
              transform: [
                { scale: scaleAnim },
                { translateX: shakeLevel !== 'none' ? shakeTranslate : 0 },
              ],
            },
          ]}
        >
          <LinearGradient
            colors={
              overheatState === 'overheat'
                ? ['#3B1F1F', '#1A2535']
                : ['#1F2937', '#1A2535']
            }
            style={styles.monsterGradient}
          >
            <Text style={styles.monsterEmoji}>{monsterExpression.emoji}</Text>
            <Text
              style={[
                styles.emotionText,
                overheatState === 'cool' && styles.emotionCool,
                overheatState === 'warm' && styles.emotionWarm,
                overheatState === 'hot' && styles.emotionHot,
                overheatState === 'overheat' && styles.emotionOverheat,
              ]}
            >
              {emotionText}
            </Text>
            <OverheatBar
              usagePercent={usagePercent}
              state={overheatState}
              todayIntake={todayIntake}
              dailyTarget={dailyTarget}
            />

            <View style={styles.hpContainer}>
              <View style={styles.hpBarBg}>
                <View
                  style={[
                    styles.hpBar,
                    {
                      width: `${hpPercent}%`,
                      backgroundColor: hpPercent > 70 ? '#22C55E' : hpPercent > 30 ? '#FBBF24' : '#EF4444',
                    },
                  ]}
                />
              </View>
              <Text style={styles.hpText}>
                {Math.round(monster?.current_hp || 0)} / {Math.round(monster?.initial_hp || 0)} HP
              </Text>
            </View>
          </LinearGradient>
        </Animated.View>

        <View style={styles.foodForm}>
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              placeholder="What did you eat?"
              placeholderTextColor="#6B7280"
              value={foodInput}
              onChangeText={setFoodInput}
              editable={!loading}
            />
            <TextInput
              style={styles.caloriesInput}
              placeholder="kcal"
              placeholderTextColor="#6B7280"
              keyboardType="number-pad"
              value={caloriesInput}
              onChangeText={setCaloriesInput}
              editable={!loading}
            />
            <TouchableOpacity
              style={[styles.logButton, !canLog && styles.buttonDisabled]}
              onPress={handleLogFood}
              disabled={!canLog}
            >
              <Plus color="#0F172A" size={20} />
            </TouchableOpacity>
          </View>
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
        </View>

        {todayLogs.length > 0 && (
          <View style={styles.logsSection}>
            <Text style={styles.logsTitle}>Today's Meals</Text>
            {todayLogs.map((log) => (
              <View key={log.id} style={styles.logItem}>
                <View style={styles.logContent}>
                  <Text style={styles.logFood}>{log.food_description}</Text>
                  <Text style={styles.logCals}>{Math.round(log.calories)} kcal</Text>
                </View>
                <TouchableOpacity onPress={() => handleDeleteLog(log.id)}>
                  <Trash2 color="#EF4444" size={18} />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingVertical: 20,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  subtitle: {
    fontSize: 14,
    color: '#9CA3AF',
    marginTop: 4,
  },
  monsterCard: {
    marginBottom: 24,
    borderRadius: 16,
    overflow: 'hidden',
  },
  monsterGradient: {
    paddingVertical: 32,
    alignItems: 'center',
  },
  monsterEmoji: {
    fontSize: 64,
    marginBottom: 8,
  },
  emotionText: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 16,
    letterSpacing: 0.5,
  },
  emotionCool: { color: '#4ADE80' },
  emotionWarm: { color: '#FBBF24' },
  emotionHot: { color: '#FB923C' },
  emotionOverheat: { color: '#EF4444' },
  hpContainer: {
    width: '100%',
    paddingHorizontal: 24,
  },
  hpBarBg: {
    height: 12,
    backgroundColor: '#374151',
    borderRadius: 6,
    overflow: 'hidden',
    marginBottom: 12,
  },
  hpBar: {
    height: '100%',
    borderRadius: 6,
  },
  hpText: {
    fontSize: 14,
    color: '#D1D5DB',
    textAlign: 'center',
  },
  foodForm: {
    marginBottom: 24,
  },
  inputContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  input: {
    flex: 1,
    backgroundColor: '#1F2937',
    borderWidth: 1,
    borderColor: '#374151',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
    color: '#FFFFFF',
  },
  caloriesInput: {
    width: 72,
    backgroundColor: '#1F2937',
    borderWidth: 1,
    borderColor: '#374151',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 14,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  errorText: {
    color: '#EF4444',
    fontSize: 13,
    marginTop: 8,
    paddingHorizontal: 4,
  },
  logButton: {
    backgroundColor: '#FBBF24',
    borderRadius: 12,
    width: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  logsSection: {
    marginBottom: 24,
  },
  logsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  logItem: {
    backgroundColor: '#1F2937',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  logContent: {
    flex: 1,
  },
  logFood: {
    fontSize: 14,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  logCals: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 4,
  },
});
