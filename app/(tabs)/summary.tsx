import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { supabase, Meal } from '@/lib/supabase';
import { Flame, Beef, Wheat, Droplets, TrendingUp, Target } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

const DAILY_GOALS = {
  calories: 2000,
  protein: 150,
  carbs: 250,
  fat: 65,
};

export default function SummaryScreen() {
  const [meals, setMeals] = useState<Meal[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      fetchTodayMeals();
    }, [])
  );

  const fetchTodayMeals = async () => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const { data, error } = await supabase
      .from('meals')
      .select('*')
      .gte('logged_at', todayStart.toISOString())
      .order('logged_at', { ascending: false });

    if (!error && data) setMeals(data as Meal[]);
    setLoading(false);
  };

  const totals = meals.reduce(
    (acc, m) => ({
      calories: acc.calories + (m.calories ?? 0),
      protein: acc.protein + Number(m.protein_g ?? 0),
      carbs: acc.carbs + Number(m.carbs_g ?? 0),
      fat: acc.fat + Number(m.fat_g ?? 0),
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );

  const pct = (val: number, goal: number) => Math.min(Math.round((val / goal) * 100), 100);

  const getProgressColor = (p: number) => {
    if (p < 50) return '#22C55E';
    if (p < 85) return '#F59E0B';
    return '#EF4444';
  };

  if (loading) {
    return (
      <LinearGradient colors={['#0F172A', '#111827']} style={styles.centered}>
        <ActivityIndicator color="#22C55E" size="large" />
      </LinearGradient>
    );
  }

  const calPct = pct(totals.calories, DAILY_GOALS.calories);

  return (
    <LinearGradient colors={['#0F172A', '#111827']} style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <Text style={styles.title}>Today's Summary</Text>
          <Text style={styles.subtitle}>{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</Text>
        </View>

        {/* Calorie Ring Card */}
        <View style={styles.heroCard}>
          <View style={styles.ringContainer}>
            <View style={[styles.ring, { borderColor: getProgressColor(calPct) }]}>
              <Flame color={getProgressColor(calPct)} size={28} />
              <Text style={[styles.ringValue, { color: getProgressColor(calPct) }]}>
                {totals.calories}
              </Text>
              <Text style={styles.ringLabel}>kcal eaten</Text>
            </View>
          </View>
          <View style={styles.heroStats}>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatValue}>{DAILY_GOALS.calories - totals.calories}</Text>
              <Text style={styles.heroStatLabel}>Remaining</Text>
            </View>
            <View style={styles.heroDivider} />
            <View style={styles.heroStat}>
              <Text style={styles.heroStatValue}>{DAILY_GOALS.calories}</Text>
              <Text style={styles.heroStatLabel}>Daily Goal</Text>
            </View>
            <View style={styles.heroDivider} />
            <View style={styles.heroStat}>
              <Text style={styles.heroStatValue}>{meals.length}</Text>
              <Text style={styles.heroStatLabel}>Meals</Text>
            </View>
          </View>
          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${calPct}%` as any,
                  backgroundColor: getProgressColor(calPct),
                },
              ]}
            />
          </View>
          <Text style={styles.progressText}>{calPct}% of daily goal</Text>
        </View>

        {/* Macros */}
        <Text style={styles.sectionTitle}>Macronutrients</Text>
        <View style={styles.macroGrid}>
          <MacroCard
            icon={<Beef color="#60A5FA" size={20} />}
            label="Protein"
            value={Math.round(totals.protein)}
            goal={DAILY_GOALS.protein}
            unit="g"
            color="#60A5FA"
          />
          <MacroCard
            icon={<Wheat color="#FBBF24" size={20} />}
            label="Carbs"
            value={Math.round(totals.carbs)}
            goal={DAILY_GOALS.carbs}
            unit="g"
            color="#FBBF24"
          />
          <MacroCard
            icon={<Droplets color="#F472B6" size={20} />}
            label="Fat"
            value={Math.round(totals.fat)}
            goal={DAILY_GOALS.fat}
            unit="g"
            color="#F472B6"
          />
        </View>

        {/* Recent meals */}
        {meals.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Today's Meals</Text>
            <View style={styles.mealList}>
              {meals.map((m) => (
                <View key={m.id} style={styles.mealRow}>
                  <View style={styles.mealDot} />
                  <Text style={styles.mealRowName} numberOfLines={1}>
                    {m.name}
                  </Text>
                  <Text style={styles.mealRowCal}>{m.calories} kcal</Text>
                </View>
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </LinearGradient>
  );
}

function MacroCard({
  icon,
  label,
  value,
  goal,
  unit,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  goal: number;
  unit: string;
  color: string;
}) {
  const p = Math.min(Math.round((value / goal) * 100), 100);
  return (
    <View style={macroStyles.card}>
      <View style={macroStyles.top}>
        {icon}
        <Text style={macroStyles.label}>{label}</Text>
      </View>
      <Text style={[macroStyles.value, { color }]}>
        {value}
        <Text style={macroStyles.unit}>{unit}</Text>
      </Text>
      <View style={macroStyles.bar}>
        <View style={[macroStyles.barFill, { width: `${p}%` as any, backgroundColor: color }]} />
      </View>
      <Text style={macroStyles.goal}>
        {p}% of {goal}
        {unit}
      </Text>
    </View>
  );
}

const macroStyles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: '#1F2937',
    borderRadius: 16,
    padding: 14,
    gap: 6,
  },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  label: {
    color: '#9CA3AF',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  value: {
    fontSize: 24,
    fontWeight: '700',
  },
  unit: {
    fontSize: 13,
    fontWeight: '400',
    color: '#6B7280',
  },
  bar: {
    height: 4,
    backgroundColor: '#374151',
    borderRadius: 2,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 2,
  },
  goal: {
    color: '#6B7280',
    fontSize: 10,
  },
});

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: {
    paddingBottom: 40,
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: 24,
    paddingBottom: 20,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '700',
  },
  subtitle: {
    color: '#6B7280',
    fontSize: 14,
    marginTop: 4,
  },
  heroCard: {
    marginHorizontal: 16,
    backgroundColor: '#1F2937',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    gap: 16,
  },
  ringContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    width: 130,
    height: 130,
    borderRadius: 65,
    borderWidth: 6,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  ringValue: {
    fontSize: 28,
    fontWeight: '700',
  },
  ringLabel: {
    color: '#6B7280',
    fontSize: 11,
  },
  heroStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  heroStat: {
    alignItems: 'center',
  },
  heroStatValue: {
    color: '#F9FAFB',
    fontSize: 18,
    fontWeight: '700',
  },
  heroStatLabel: {
    color: '#6B7280',
    fontSize: 11,
    marginTop: 2,
  },
  heroDivider: {
    width: 1,
    height: 32,
    backgroundColor: '#374151',
  },
  progressBar: {
    width: '100%',
    height: 8,
    backgroundColor: '#374151',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressText: {
    color: '#6B7280',
    fontSize: 12,
  },
  sectionTitle: {
    color: '#F9FAFB',
    fontSize: 18,
    fontWeight: '700',
    paddingHorizontal: 24,
    marginTop: 24,
    marginBottom: 12,
  },
  macroGrid: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 10,
  },
  mealList: {
    marginHorizontal: 16,
    backgroundColor: '#1F2937',
    borderRadius: 16,
    overflow: 'hidden',
  },
  mealRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
    gap: 10,
  },
  mealDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#22C55E',
  },
  mealRowName: {
    flex: 1,
    color: '#E5E7EB',
    fontSize: 14,
  },
  mealRowCal: {
    color: '#9CA3AF',
    fontSize: 13,
    fontWeight: '600',
  },
});
