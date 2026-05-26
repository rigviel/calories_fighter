import { useState, useCallback, useMemo, type ReactNode } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  TextInput,
  Alert,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { MonsterHpBar } from '@/components/MonsterHpBar';
import { User, Shield, Zap, Trophy, Target, TrendingUp } from 'lucide-react-native';
import {
  ensureAnonymousSession,
  ensureUserProfile,
  getDailyLogs,
  getWeeklyMonster,
  getDailyOverheatState,
  updateUserProfile,
  recalibrateCurrentWeeklyMonster,
  resolveMonsterDisplayName,
  processWeekRollover,
  getBattleCareerStats,
  type BattleCareerStats,
  type User as StoredUser,
} from '@/lib/local-store';
import { getTodayDate, getWeekDates } from '@/lib/dates';
import {
  CALORIE_CLASSES,
  computeBMR,
  computeTdeeFromProfile,
  computeWeeklyMonsterHp,
  getCalorieClass,
  formatMissingProfileHint,
  getMissingProfileFields,
  isProfileComplete,
  TDEE_ACTIVITY_MULTIPLIER,
  mapOverheatToMonsterState,
  type CalorieClassId,
  type ProfileFields,
  type Sex,
} from '@/lib/metabolism';
import { getTodayIntake, getUsagePercentDisplay } from '@/lib/overheat';

function parsePositiveInt(value: string, min: number, max: number): number | null {
  const parsed = Number.parseInt(value.trim(), 10);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) return null;
  return parsed;
}

function parseWeight(value: string): number | null {
  const parsed = Number.parseFloat(value.trim());
  if (!Number.isFinite(parsed) || parsed < 40 || parsed > 300) return null;
  return parsed;
}

const MONSTER_STATE_LABELS = {
  stable: { label: 'Stable', color: '#22C55E' },
  tired: { label: 'Tired', color: '#F97316' },
  overheated: { label: 'Overheated', color: '#EF4444' },
} as const;

type SavedStatSnapshot = {
  displayName: string;
  sex: Sex;
  age: number;
  weightKg: number;
  heightCm: number;
  calorieClassId: CalorieClassId;
  bmr: number;
  tdee: number;
  weeklyHp: number;
};

function buildSavedSnapshot(profile: StoredUser): SavedStatSnapshot | null {
  if (!isProfileComplete(profile)) return null;

  const calorieClass = getCalorieClass(profile.calorie_class_id!);
  const bmr = computeBMR(profile.weight_kg!, profile.height_cm!, profile.age!, profile.sex!);
  const tdee = computeTdeeFromProfile(
    profile.weight_kg!,
    profile.height_cm!,
    profile.age!,
    profile.sex!
  );
  const weeklyHp = computeWeeklyMonsterHp(tdee, calorieClass.deficitPercentage);
  return {
    displayName: profile.display_name!,
    sex: profile.sex!,
    age: profile.age!,
    weightKg: profile.weight_kg!,
    heightCm: profile.height_cm!,
    calorieClassId: profile.calorie_class_id!,
    bmr,
    tdee,
    weeklyHp,
  };
}

function getFormProfileFields(
  displayName: string,
  sex: Sex | null,
  age: string,
  weight: string,
  height: string,
  calorieClassId: CalorieClassId | null
): ProfileFields {
  return {
    display_name: displayName.trim() || null,
    sex,
    age: parsePositiveInt(age, 13, 120),
    weight_kg: parseWeight(weight),
    height_cm: parsePositiveInt(height, 100, 250),
    calorie_class_id: calorieClassId,
  };
}

export default function StatsScreen() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [user, setUser] = useState<StoredUser | null>(null);
  const [monster, setMonster] = useState<{
    current_hp: number;
    initial_hp: number;
  } | null>(null);
  const [monsterState, setMonsterState] = useState<'stable' | 'tired' | 'overheated'>('stable');
  const [todayIntake, setTodayIntake] = useState(0);
  const [careerStats, setCareerStats] = useState<BattleCareerStats | null>(null);

  const [displayName, setDisplayName] = useState('');
  const [sex, setSex] = useState<Sex | null>(null);
  const [age, setAge] = useState('');
  const [weight, setWeight] = useState('');
  const [height, setHeight] = useState('');
  const [calorieClassId, setCalorieClassId] = useState<CalorieClassId | null>(null);
  const [monsterName, setMonsterName] = useState('');
  const [savedSnapshot, setSavedSnapshot] = useState<SavedStatSnapshot | null>(null);

  useFocusEffect(
    useCallback(() => {
      const init = async () => {
        setLoading(true);
        try {
          const session = await ensureAnonymousSession();
          const profile = await ensureUserProfile(session.user.id);
          await loadSheet(profile);
        } catch (err) {
          console.error('Stats load failed:', err);
        } finally {
          setLoading(false);
        }
      };
      init();
    }, [])
  );

  const loadSheet = async (profile: StoredUser) => {
    setUser(profile);
    const uid = profile.id;
    setDisplayName(profile.display_name ?? '');
    setSex(profile.sex);
    setAge(profile.age != null ? String(profile.age) : '');
    setWeight(profile.weight_kg != null ? String(profile.weight_kg) : '');
    setHeight(profile.height_cm != null ? String(profile.height_cm) : '');
    setCalorieClassId(profile.calorie_class_id);
    setMonsterName(profile.monster_name ?? '');
    setSavedSnapshot(buildSavedSnapshot(profile));

    const syncedMonster = await recalibrateCurrentWeeklyMonster(uid);
    const activeMonster =
      syncedMonster ?? (await getWeeklyMonster(uid, getWeekDates().start));
    setMonster(activeMonster);

    const overheat = await getDailyOverheatState(uid, getTodayDate());
    setMonsterState(mapOverheatToMonsterState(overheat?.state ?? null));

    if (activeMonster) {
      const logs = await getDailyLogs(uid, {
        monsterId: activeMonster.id,
        logDate: getTodayDate(),
      });
      setTodayIntake(getTodayIntake(logs));
    } else {
      setTodayIntake(0);
    }

    await processWeekRollover(uid);
    setCareerStats(await getBattleCareerStats(uid));
  };

  const handleSave = async () => {
    if (!user) return;

    const formProfile = getFormProfileFields(
      displayName,
      sex,
      age,
      weight,
      height,
      calorieClassId
    );
    const missing = getMissingProfileFields(formProfile);
    if (missing.length > 0) {
      Alert.alert('Incomplete profile', formatMissingProfileHint(missing));
      return;
    }

    const parsedAge = formProfile.age!;
    const parsedHeight = formProfile.height_cm!;
    const parsedWeight = formProfile.weight_kg!;

    setSaving(true);
    try {
      const updated = await updateUserProfile(user.id, {
        displayName: displayName.trim(),
        sex: sex!,
        age: parsedAge,
        weightKg: parsedWeight,
        heightCm: parsedHeight,
        calorieClassId: calorieClassId!,
        monsterName: monsterName.trim() || null,
      });
      setUser(updated);
      setSavedSnapshot(buildSavedSnapshot(updated));

      const syncedMonster = await recalibrateCurrentWeeklyMonster(user.id);
      const activeMonster =
        syncedMonster ?? (await getWeeklyMonster(user.id, getWeekDates().start));
      setMonster(activeMonster);

      if (activeMonster) {
        const logs = await getDailyLogs(user.id, {
          monsterId: activeMonster.id,
          logDate: getTodayDate(),
        });
        setTodayIntake(getTodayIntake(logs));
      }

      await processWeekRollover(user.id);
      setCareerStats(await getBattleCareerStats(user.id));

      Alert.alert('Saved', 'Your stats and battle budgets are updated.');
    } catch (err) {
      Alert.alert('Save failed', String(err));
    } finally {
      setSaving(false);
    }
  };

  const formProfile = useMemo(
    () => getFormProfileFields(displayName, sex, age, weight, height, calorieClassId),
    [displayName, sex, age, weight, height, calorieClassId]
  );

  const missingFormFields = useMemo(
    () => getMissingProfileFields(formProfile),
    [formProfile]
  );

  const formComplete = missingFormFields.length === 0;

  const hasUnsavedChanges = useMemo(() => {
    if (!user) return false;

    const nameDraft = displayName.trim();
    const nameSaved = user.display_name?.trim() ?? '';

    return (
      nameDraft !== nameSaved ||
      sex !== user.sex ||
      formProfile.age !== user.age ||
      formProfile.weight_kg !== user.weight_kg ||
      formProfile.height_cm !== user.height_cm ||
      calorieClassId !== user.calorie_class_id ||
      (monsterName.trim() || '') !== (user.monster_name?.trim() || '')
    );
  }, [user, displayName, sex, formProfile, calorieClassId, monsterName]);

  if (loading) {
    return (
      <LinearGradient colors={['#0F172A', '#111827']} style={styles.centered}>
        <ActivityIndicator color="#FBBF24" size="large" />
      </LinearGradient>
    );
  }

  if (!user) {
    return (
      <LinearGradient colors={['#0F172A', '#111827']} style={styles.centered}>
        <Text style={styles.emptyText}>Complete onboarding to open Character Stat.</Text>
      </LinearGradient>
    );
  }

  const resolvedMonsterName = monsterName.trim() || resolveMonsterDisplayName(user);
  const canSave = hasUnsavedChanges && formComplete && !saving;

  return (
    <LinearGradient colors={['#0F172A', '#111827']} style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <Shield color="#FBBF24" size={28} />
          <View>
            <Text style={styles.title}>Character Stat</Text>
            <Text style={styles.subtitle}>Edit profile, class & view saved totals</Text>
          </View>
        </View>

        {!formComplete ? (
          <View style={styles.validationBanner}>
            <Text style={styles.validationText}>{formatMissingProfileHint(missingFormFields)}</Text>
          </View>
        ) : null}

        <Section title="Player Identity" icon={<User color="#9CA3AF" size={18} />}>
          <Field label="Name" hint="Required">
            <TextInput
              style={styles.input}
              value={displayName}
              onChangeText={setDisplayName}
              placeholder="Your name"
              placeholderTextColor="#6B7280"
            />
          </Field>
          <Field label="Sex" hint="Required">
            <View style={styles.segmentRow}>
              {(['male', 'female'] as Sex[]).map((option) => (
                <TouchableOpacity
                  key={option}
                  style={[styles.segment, sex === option && styles.segmentActive]}
                  onPress={() => setSex(option)}
                >
                  <Text style={[styles.segmentText, sex === option && styles.segmentTextActive]}>
                    {option === 'male' ? 'Male' : 'Female'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </Field>
          <Field label="Age (years)" hint="Required · 13–120">
            <TextInput
              style={styles.input}
              value={age}
              onChangeText={setAge}
              keyboardType="number-pad"
              placeholder="Age"
              placeholderTextColor="#6B7280"
            />
          </Field>
        </Section>

        <Section title="Body Stats">
          <Field label="Weight (kg)" hint="Required · 40–300 kg">
            <TextInput
              style={styles.input}
              value={weight}
              onChangeText={setWeight}
              keyboardType="decimal-pad"
              placeholder="Weight"
              placeholderTextColor="#6B7280"
            />
          </Field>
          <Field label="Height (cm)" hint="Required · 100–250 cm">
            <TextInput
              style={styles.input}
              value={height}
              onChangeText={setHeight}
              keyboardType="number-pad"
              placeholder="Height"
              placeholderTextColor="#6B7280"
            />
          </Field>
        </Section>

        <Section title="Calorie Class" hint="Required · higher class = deeper deficit">
          <View style={styles.classGrid}>
            {(Object.keys(CALORIE_CLASSES) as CalorieClassId[]).map((id) => {
              const cls = CALORIE_CLASSES[id];
              const active = calorieClassId === id;
              return (
                <TouchableOpacity
                  key={id}
                  style={[styles.classCard, active && styles.classCardActive]}
                  onPress={() => setCalorieClassId(id)}
                >
                  <Text style={styles.classEmoji}>{cls.emoji}</Text>
                  <Text style={styles.classLabel}>{cls.label}</Text>
                  <Text style={styles.classMeta}>
                    {cls.cutLabel} · −{cls.deficitPercentage}%
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </Section>

        <Section title="Monster" hint="Optional · leave blank for auto name">
          <Field label="Monster name">
            <TextInput
              style={styles.input}
              value={monsterName}
              onChangeText={setMonsterName}
              placeholder={resolvedMonsterName}
              placeholderTextColor="#6B7280"
            />
          </Field>
        </Section>

        <TouchableOpacity
          style={[
            styles.saveButton,
            canSave && styles.saveButtonActive,
            !canSave && styles.saveButtonInactive,
          ]}
          onPress={handleSave}
          disabled={!canSave}
        >
          <Text
            style={[styles.saveButtonText, !canSave && styles.saveButtonTextInactive]}
          >
            {saving ? 'Saving…' : 'Save'}
          </Text>
        </TouchableOpacity>

        {savedSnapshot ? (
          <>
            <SavedStatsTable snapshot={savedSnapshot} />
            <MonsterStatsTable
              monsterDisplayName={
                user.monster_name?.trim() || resolveMonsterDisplayName(user)
              }
              monsterState={monsterState}
              monster={monster}
              todayIntake={todayIntake}
              weeklyHpBudget={savedSnapshot.weeklyHp}
            />
            {careerStats ? <BattleCareerStatsCards stats={careerStats} /> : null}
          </>
        ) : (
          <View style={styles.savedTablePlaceholder}>
            <Text style={styles.savedTablePlaceholderText}>
              Save to see your current stats summary.
            </Text>
          </View>
        )}
      </ScrollView>
    </LinearGradient>
  );
}

function Section({
  title,
  hint,
  icon,
  children,
}: {
  title: string;
  hint?: string;
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        {icon}
        <View style={styles.sectionHeaderText}>
          <Text style={styles.sectionTitle}>{title}</Text>
          {hint ? <Text style={styles.sectionHint}>{hint}</Text> : null}
        </View>
      </View>
      {children}
    </View>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {hint ? <Text style={styles.fieldHint}>{hint}</Text> : null}
      {children}
    </View>
  );
}

function SavedStatsTable({ snapshot }: { snapshot: SavedStatSnapshot }) {
  const calorieClass = getCalorieClass(snapshot.calorieClassId);
  const dailyTarget = Math.round(snapshot.weeklyHp / 7);

  const profileRows: { label: string; value: string }[] = [
    { label: 'Name', value: snapshot.displayName },
    { label: 'Sex', value: snapshot.sex === 'male' ? 'Male' : 'Female' },
    { label: 'Age', value: `${snapshot.age} years` },
    { label: 'Weight', value: `${snapshot.weightKg} kg` },
    { label: 'Height', value: `${snapshot.heightCm} cm` },
    {
      label: 'Class',
      value: `${calorieClass.emoji} ${calorieClass.label} (−${calorieClass.deficitPercentage}%)`,
    },
  ];

  const metabolismRows: { label: string; value: string; sub?: string }[] = [
    { label: 'BMR', value: `${snapshot.bmr} kcal/day`, sub: 'Mifflin–St Jeor' },
    {
      label: 'TDEE',
      value: `${snapshot.tdee} kcal/day`,
      sub: `Moderate baseline (×${TDEE_ACTIVITY_MULTIPLIER})`,
    },
    {
      label: 'Weekly Monster HP',
      value: `${snapshot.weeklyHp.toLocaleString()} kcal`,
      sub: `TDEE × 7 × (1 − ${calorieClass.deficitPercentage}%)`,
    },
    {
      label: 'Daily target',
      value: `${dailyTarget.toLocaleString()} kcal/day`,
      sub: 'Weekly HP ÷ 7 · drives overheat bar on Battle',
    },
  ];

  return (
    <View style={styles.savedTableSection}>
      <Text style={styles.savedTableTitle}>Current Stats</Text>
      <Text style={styles.savedTableHint}>Last saved profile & metabolism</Text>
      <View style={styles.savedTable}>
        <Text style={styles.savedTableGroup}>Profile</Text>
        {profileRows.map((row) => (
          <TableRow key={row.label} label={row.label} value={row.value} />
        ))}
        <View style={styles.savedTableDivider} />
        <Text style={styles.savedTableGroup}>Metabolism</Text>
        {metabolismRows.map((row) => (
          <TableRow key={row.label} label={row.label} value={row.value} sub={row.sub} />
        ))}
      </View>
    </View>
  );
}

function MonsterStatsTable({
  monsterDisplayName,
  monsterState,
  monster,
  todayIntake,
  weeklyHpBudget,
}: {
  monsterDisplayName: string;
  monsterState: 'stable' | 'tired' | 'overheated';
  monster: { current_hp: number; initial_hp: number } | null;
  todayIntake: number;
  weeklyHpBudget: number;
}) {
  const stateInfo = MONSTER_STATE_LABELS[monsterState];
  const dailyTarget = Math.round(weeklyHpBudget / 7);
  const usageDisplay =
    dailyTarget > 0 ? Math.round(getUsagePercentDisplay(todayIntake / dailyTarget)) : 0;
  const hpPercent = monster ? (monster.current_hp / monster.initial_hp) * 100 : 0;

  const rows: { label: string; value: string; sub?: string; valueColor?: string }[] = [
    { label: 'Monster', value: monsterDisplayName },
    { label: 'State', value: stateInfo.label, valueColor: stateInfo.color },
    {
      label: 'Weekly HP',
      value: monster
        ? `${Math.round(monster.current_hp).toLocaleString()} / ${Math.round(monster.initial_hp).toLocaleString()} kcal`
        : '—',
      sub: monster ? `${Math.round(hpPercent)}% remaining this week` : 'Starts after first save',
    },
    {
      label: 'Daily target',
      value: `${dailyTarget.toLocaleString()} kcal/day`,
      sub: 'Overheat bar limit on Battle tab',
    },
    {
      label: 'Today\'s intake',
      value: `${Math.round(todayIntake).toLocaleString()} kcal`,
      sub: `${usageDisplay}% of daily target`,
    },
  ];

  return (
    <View style={[styles.savedTableSection, styles.battleTableSection]}>
      <Text style={styles.savedTableTitle}>Monster Stat</Text>
      <Text style={styles.savedTableHint}>Live monster & this week's battle progress</Text>
      <View style={[styles.savedTable, styles.battleTable]}>
        {rows.map((row) => (
          <TableRow
            key={row.label}
            label={row.label}
            value={row.value}
            sub={row.sub}
            valueColor={row.valueColor}
          />
        ))}
        {monster ? (
          <View style={styles.battleHpBarWrap}>
            <MonsterHpBar
              currentHp={monster.current_hp}
              initialHp={monster.initial_hp}
              variant="compact"
              showLabel={false}
            />
          </View>
        ) : null}
      </View>
    </View>
  );
}

function BattleCareerStatsCards({ stats }: { stats: BattleCareerStats }) {
  const hasFinishedWeek = stats.weeksPlayed > 0;

  return (
    <View style={styles.battleStatsSection}>
      <Text style={styles.battleStatsTitle}>Battle Stats</Text>
      <Text style={styles.battleStatsSubtitle}>Your fighting progress</Text>

      <View style={styles.battleStatCardWide}>
        <Zap color="#FBBF24" size={22} />
        <Text style={styles.battleStatValueAccent}>{stats.weekWinStreak}</Text>
        <Text style={styles.battleStatLabel}>Week Win Streak</Text>
      </View>

      <View style={styles.battleStatRow}>
        <View style={styles.battleStatCardHalf}>
          <Trophy color="#FBBF24" size={22} />
          <Text style={styles.battleStatValue}>{stats.monstersDefeated}</Text>
          <Text style={styles.battleStatLabel}>Total Wins</Text>
        </View>
        <View style={styles.battleStatCardHalf}>
          <Target color="#22C55E" size={22} />
          <Text style={styles.battleStatValue}>{stats.weeksPlayed}</Text>
          <Text style={styles.battleStatLabel}>Battles</Text>
        </View>
      </View>

      {!hasFinishedWeek ? (
        <View style={styles.battleStatsEmpty}>
          <TrendingUp color="#4B5563" size={28} />
          <Text style={styles.battleStatsEmptyText}>Complete your first week to see results</Text>
        </View>
      ) : (
        <View style={styles.battleStatsExtra}>
          <Text style={styles.battleStatsExtraText}>
            COOL streak: {stats.currentCoolStreak} day{stats.currentCoolStreak === 1 ? '' : 's'} ·
            Best {stats.bestCoolStreak} · This week {stats.coolDaysThisWeek}/
            {stats.daysTrackedThisWeek} COOL days
            {stats.lastWeekOutcome
              ? ` · Last week: ${stats.lastWeekOutcome === 'victory' ? 'Victory' : 'Defeat'}`
              : ''}
          </Text>
        </View>
      )}
    </View>
  );
}

function TableRow({
  label,
  value,
  sub,
  valueColor,
}: {
  label: string;
  value: string;
  sub?: string;
  valueColor?: string;
}) {
  return (
    <View style={styles.tableRow}>
      <Text style={styles.tableLabel}>{label}</Text>
      <View style={styles.tableValueCol}>
        <Text style={[styles.tableValue, valueColor ? { color: valueColor } : null]}>{value}</Text>
        {sub ? <Text style={styles.tableSub}>{sub}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  scroll: { paddingBottom: 48 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingTop: 60,
    paddingHorizontal: 24,
    paddingBottom: 8,
  },
  title: { color: '#FFFFFF', fontSize: 26, fontWeight: '700' },
  subtitle: { color: '#9CA3AF', fontSize: 13, marginTop: 2 },
  section: {
    marginHorizontal: 16,
    marginTop: 16,
    backgroundColor: '#1F2937',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#374151',
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 12 },
  sectionHeaderText: { flex: 1 },
  sectionTitle: { color: '#F9FAFB', fontSize: 16, fontWeight: '700' },
  sectionHint: { color: '#6B7280', fontSize: 12, marginTop: 2 },
  field: { marginBottom: 14 },
  fieldLabel: { color: '#D1D5DB', fontSize: 13, fontWeight: '600', marginBottom: 4 },
  fieldHint: { color: '#6B7280', fontSize: 11, marginBottom: 6 },
  input: {
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#374151',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 16,
    color: '#FFFFFF',
  },
  segmentRow: { flexDirection: 'row', gap: 8 },
  segment: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#374151',
    alignItems: 'center',
    backgroundColor: '#111827',
  },
  segmentActive: { borderColor: '#FBBF24', backgroundColor: '#2D2415' },
  segmentText: { color: '#9CA3AF', fontWeight: '600', fontSize: 14 },
  segmentTextActive: { color: '#FBBF24' },
  classGrid: { gap: 8 },
  classCard: {
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#374151',
    padding: 12,
    backgroundColor: '#111827',
  },
  classCardActive: { borderColor: '#FBBF24', backgroundColor: '#2D2415' },
  classEmoji: { fontSize: 22, marginBottom: 4 },
  classLabel: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  classMeta: { color: '#9CA3AF', fontSize: 12, marginTop: 2 },
  savedTableSection: {
    marginHorizontal: 16,
    marginTop: 20,
    marginBottom: 8,
  },
  battleTableSection: { marginTop: 12 },
  battleTable: { borderColor: '#374151' },
  battleHpBarWrap: { marginTop: 8 },
  battleStatsSection: {
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
  },
  battleStatsTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '700' },
  battleStatsSubtitle: { color: '#9CA3AF', fontSize: 13, marginTop: 4, marginBottom: 14 },
  battleStatCardWide: {
    backgroundColor: '#1F2937',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#374151',
    paddingVertical: 18,
    paddingHorizontal: 16,
    alignItems: 'center',
    marginBottom: 10,
  },
  battleStatRow: { flexDirection: 'row', gap: 10 },
  battleStatCardHalf: {
    flex: 1,
    backgroundColor: '#1F2937',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#374151',
    paddingVertical: 18,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  battleStatValueAccent: {
    color: '#FBBF24',
    fontSize: 36,
    fontWeight: '700',
    marginTop: 8,
    marginBottom: 4,
  },
  battleStatValue: {
    color: '#FFFFFF',
    fontSize: 36,
    fontWeight: '700',
    marginTop: 8,
    marginBottom: 4,
  },
  battleStatLabel: { color: '#9CA3AF', fontSize: 12, fontWeight: '500' },
  battleStatsEmpty: {
    alignItems: 'center',
    marginTop: 20,
    paddingVertical: 8,
    gap: 8,
  },
  battleStatsEmptyText: { color: '#6B7280', fontSize: 13, textAlign: 'center' },
  battleStatsExtra: {
    marginTop: 14,
    paddingHorizontal: 4,
  },
  battleStatsExtraText: { color: '#6B7280', fontSize: 11, lineHeight: 16, textAlign: 'center' },
  savedTableTitle: { color: '#F9FAFB', fontSize: 16, fontWeight: '700' },
  savedTableHint: { color: '#6B7280', fontSize: 12, marginTop: 4, marginBottom: 10 },
  savedTable: {
    backgroundColor: '#1F2937',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#FBBF24',
  },
  savedTableGroup: {
    color: '#FBBF24',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 8,
    marginTop: 4,
  },
  savedTableDivider: {
    height: 1,
    backgroundColor: '#374151',
    marginVertical: 12,
  },
  tableRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 6,
    gap: 12,
  },
  tableLabel: { color: '#9CA3AF', fontSize: 13, fontWeight: '600', flex: 1 },
  tableValueCol: { flex: 1.2, alignItems: 'flex-end' },
  tableValue: { color: '#FFFFFF', fontSize: 14, fontWeight: '700', textAlign: 'right' },
  tableSub: { color: '#6B7280', fontSize: 10, marginTop: 2, textAlign: 'right' },
  savedTablePlaceholder: {
    marginHorizontal: 16,
    marginTop: 20,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#374151',
    borderStyle: 'dashed',
  },
  savedTablePlaceholderText: { color: '#6B7280', fontSize: 13, textAlign: 'center' },
  saveButton: {
    marginHorizontal: 16,
    marginTop: 24,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#374151',
  },
  saveButtonActive: {
    backgroundColor: '#FBBF24',
    borderColor: '#FBBF24',
  },
  saveButtonInactive: {
    backgroundColor: '#1F2937',
  },
  saveButtonText: { color: '#0F172A', fontSize: 16, fontWeight: '700' },
  saveButtonTextInactive: { color: '#6B7280' },
  validationBanner: {
    marginHorizontal: 16,
    marginTop: 8,
    padding: 12,
    borderRadius: 10,
    backgroundColor: '#2D1F1F',
    borderWidth: 1,
    borderColor: '#7F1D1D',
  },
  validationText: { color: '#FCA5A5', fontSize: 13, lineHeight: 18 },
  emptyText: { color: '#9CA3AF', fontSize: 14, textAlign: 'center' },
});
