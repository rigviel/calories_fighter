import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { useFocusEffect } from 'expo-router';
import {
  createWeeklyMonster,
  deleteDailyLogAndRestoreHp,
  ensureAnonymousSession,
  getDailyLogs,
  getDailyOverheatState,
  getSession,
  getUser,
  getWeeklyMonster,
  isProfileComplete,
  recalibrateCurrentWeeklyMonster,
  applyPendingHit,
  reduceWeeklyMonsterHp,
  resetWeeklyMonsterHp,
  processWeekRollover,
  processDayHitEvaluation,
  logFoodAndUpdateMonster,
  setDailyOverheatState,
  upsertFoodMemory,
  WEEKLY_BOSS_HP,
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
import { BattleMonsterSprite } from '@/components/BattleMonsterSprite';
import { FoodThrowEffect } from '@/components/FoodThrowEffect';
import { MonsterHpBar } from '@/components/MonsterHpBar';
import { AttackButton } from '@/components/AttackButton';
import { computeWeeklyMonsterHp, getCalorieClass } from '@/lib/metabolism';
import { getTodayDate, getWeekDates } from '@/lib/dates';
import { Plus, Trash2 } from 'lucide-react-native';

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
  const [overheatState, setOverheatState] = useState<OverheatState>('cool');
  const [emotionText, setEmotionText] = useState('Calm');
  const [error, setError] = useState('');
  const [profileIncomplete, setProfileIncomplete] = useState(false);
  const [feedPulse, setFeedPulse] = useState(0);
  const [hitPulse, setHitPulse] = useState(0);
  const [dailyTarget, setDailyTarget] = useState(0);
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const trackedDateRef = useRef(getTodayDate());

  const loadWeeklyMonster = useCallback(async (uid: string): Promise<WeeklyMonster | null> => {
    const { start, end } = getWeekDates();
    const userData = await getUser(uid);
    if (!userData || !isProfileComplete(userData) || userData.tdee == null || !userData.calorie_class_id) {
      setProfileIncomplete(true);
      setMonster(null);
      setTodayLogs([]);
      setDailyTarget(0);
      setError('Complete your Character Stat on the Stats tab before battling.');
      return null;
    }

    setProfileIncomplete(false);
    const calorieClass = getCalorieClass(userData.calorie_class_id);
    const weeklyCalorieBudget = computeWeeklyMonsterHp(userData.tdee, calorieClass.deficitPercentage);
    setDailyTarget(getDailyTarget(weeklyCalorieBudget));

    let existingMonster = await getWeeklyMonster(uid, start);
    if (existingMonster) {
      existingMonster = (await recalibrateCurrentWeeklyMonster(uid)) ?? existingMonster;
    }

    const activeMonster =
      existingMonster ??
      (await createWeeklyMonster(
        uid,
        start,
        end,
        WEEKLY_BOSS_HP,
        userData.calorie_class_id
      ));

    setMonster({ ...activeMonster });

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
        await processWeekRollover(uid);
        await processDayHitEvaluation(uid);
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

      setMonster({ ...updatedMonster });
      setTodayLogs((prev) => [log, ...prev]);
      setFoodInput('');
      setCaloriesInput('');
      setFeedPulse((n) => n + 1);

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
        setMonster({ ...updatedMonster });
      }
      setTodayLogs((prev) => prev.filter((l) => l.id !== logId));
    } catch (err) {
      console.error('Error deleting log:', err);
    }
  };

  const playHitFeedback = (updated: WeeklyMonster) => {
    setMonster(updated);
    setHitPulse((n) => n + 1);
    Animated.sequence([
      Animated.spring(scaleAnim, { toValue: 0.94, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true }),
    ]).start();
  };

  const applyPendingHitWithFeedback = async () => {
    if (!monster || (monster.pending_hits ?? 0) <= 0 || (monster.current_hp ?? 0) <= 0) return;
    try {
      const updated = await applyPendingHit(monster.id);
      if (updated) playHitFeedback(updated);
    } catch (err) {
      console.error('Error applying pending hit:', err);
    }
  };

  const handleAttack = () => {
    void applyPendingHitWithFeedback();
  };

  /** Debug: spend pending hit when available, else −1 HP directly for tuning. */
  const handleApplyHit = async () => {
    if (!monster || (monster.current_hp ?? 0) <= 0) return;
    try {
      const hasPending = (monster.pending_hits ?? 0) > 0;
      const updated = hasPending
        ? await applyPendingHit(monster.id)
        : await reduceWeeklyMonsterHp(monster.id, 1);
      if (updated) playHitFeedback(updated);
    } catch (err) {
      console.error('Error applying hit:', err);
    }
  };

  const handleDebugResetHp = async () => {
    if (!monster) return;
    try {
      const updated = await resetWeeklyMonsterHp(monster.id);
      if (updated) setMonster(updated);
    } catch (err) {
      console.error('Error resetting monster HP:', err);
    }
  };

  const canLog =
    !profileIncomplete &&
    foodInput.trim().length > 0 &&
    parseCalories(caloriesInput) !== null &&
    !loading;

  const todayIntake = useMemo(() => getTodayIntake(todayLogs), [todayLogs]);
  const usagePercent = useMemo(
    () => getUsagePercent(todayIntake, dailyTarget),
    [todayIntake, dailyTarget]
  );
  const monsterExpression = useMemo(
    () => getMonsterExpression(overheatState),
    [overheatState]
  );
  const shakeLevel = shouldShake(overheatState);
  const isMonsterDefeated =
    (monster?.initial_hp ?? 0) > 0 && (monster?.current_hp ?? 0) <= 0;
  const showAttackButton =
    !profileIncomplete && monster != null && (monster.current_hp ?? 0) > 0;

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

        {profileIncomplete ? (
          <View style={styles.profileBanner}>
            <Text style={styles.profileBannerText}>
              Complete your Character Stat on the Stats tab (name, sex, age, weight, height, and
              class) then tap Save.
            </Text>
          </View>
        ) : null}

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
            <View style={styles.monsterArena}>
              <FoodThrowEffect pulse={feedPulse} />
              <BattleMonsterSprite
                state={overheatState}
                feedPulse={feedPulse}
                hitPulse={hitPulse}
                defeated={isMonsterDefeated}
                defeatedStyle="image"
              />
            </View>
            {/* PNG fallback (DO NOT DELETE)
            <Image
              source={require('../../assets/monster/happy.png')}
              style={{ width: 120, height: 120 }}
            />
            */}
            {/* Emoji fallback (DO NOT DELETE)
            <Text style={styles.monsterEmoji}>{monsterExpression.emoji}</Text>
            */}
            {isMonsterDefeated ? (
              <Image
                source={require('../../assets/monster/you-win-victory.v2.png')}
                style={styles.victoryBanner}
                resizeMode="contain"
              />
            ) : (
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
            )}
            {showAttackButton ? (
              <AttackButton
                pendingHits={monster.pending_hits ?? 0}
                onPress={handleAttack}
                disabled={(monster.pending_hits ?? 0) <= 0}
              />
            ) : null}
            <OverheatBar
              usagePercent={usagePercent}
              state={overheatState}
              todayIntake={todayIntake}
              dailyTarget={dailyTarget}
            />

            <View style={styles.hpContainer}>
              <MonsterHpBar
                currentHp={monster?.current_hp ?? 0}
                initialHp={monster?.initial_hp ?? 0}
              />
            </View>
          </LinearGradient>
        </Animated.View>

        <View style={styles.foodForm}>
          <View style={styles.debugButtonsRow}>
            <TouchableOpacity
              style={[styles.debugButton, styles.applyHitButton]}
              onPress={handleApplyHit}
              disabled={!monster || (monster.current_hp ?? 0) <= 0}
            >
              <Text style={styles.debugButtonText}>Apply Hit</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.debugButton}
              onPress={handleDebugResetHp}
              disabled={!monster}
            >
              <Text style={styles.debugButtonText}>Reset HP Full</Text>
            </TouchableOpacity>
          </View>
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
  profileBanner: {
    marginBottom: 16,
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#2D2415',
    borderWidth: 1,
    borderColor: '#FBBF24',
  },
  profileBannerText: {
    color: '#FDE68A',
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },
  monsterCard: {
    marginBottom: 24,
    borderRadius: 16,
    overflow: 'visible',
  },
  monsterGradient: {
    paddingVertical: 32,
    alignItems: 'center',
    overflow: 'visible',
    borderRadius: 16,
  },
  monsterArena: {
    position: 'relative',
    width: '100%',
    minHeight: 148,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  monsterEmoji: {
    fontSize: 64,
    marginBottom: 8,
  },
  emotionText: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 10,
    letterSpacing: 0.5,
  },
  emotionCool: { color: '#4ADE80' },
  emotionWarm: { color: '#FBBF24' },
  emotionHot: { color: '#FB923C' },
  emotionOverheat: { color: '#EF4444' },
  victoryBanner: {
    width: 220,
    height: 102,
    marginBottom: 16,
    alignSelf: 'center',
  },
  hpContainer: {
    width: '100%',
    paddingHorizontal: 16,
    marginTop: 4,
  },
  foodForm: {
    marginBottom: 24,
  },
  debugButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginBottom: 10,
  },
  debugButton: {
    backgroundColor: '#334155',
    borderWidth: 1,
    borderColor: '#64748B',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 10,
  },
  applyHitButton: {
    backgroundColor: '#422006',
    borderColor: '#FBBF24',
  },
  debugButtonText: {
    color: '#E2E8F0',
    fontSize: 12,
    fontWeight: '700',
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
