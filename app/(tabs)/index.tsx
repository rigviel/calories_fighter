import { View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { Zap, Plus, Trash2 } from 'lucide-react-native';

interface Monster {
  id: string;
  initial_hp: number;
  current_hp: number;
  week_start: string;
}

interface DailyLog {
  id: string;
  food_description: string;
  calories: number;
  log_date: string;
}

export default function BattleScreen() {
  const [monster, setMonster] = useState<Monster | null>(null);
  const [todayLogs, setTodayLogs] = useState<DailyLog[]>([]);
  const [foodInput, setFoodInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.id) {
        setUserId(session.user.id);
        await loadWeeklyMonster(session.user.id);
      }
    };
    init();
  }, []);

  const getWeekDates = () => {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const diff = today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
    const monday = new Date(today.setDate(diff));
    const sunday = new Date(monday);
    sunday.setDate(sunday.getDate() + 6);
    return {
      start: monday.toISOString().split('T')[0],
      end: sunday.toISOString().split('T')[0],
    };
  };

  const loadWeeklyMonster = async (uid: string) => {
    const { start, end } = getWeekDates();
    const { data: userData } = await supabase
      .from('users')
      .select('tdee, current_difficulty_id')
      .eq('id', uid)
      .maybeSingle();

    const { data: diffData } = await supabase
      .from('difficulties')
      .select('deficit_percentage')
      .eq('id', userData?.current_difficulty_id)
      .maybeSingle();

    const deficit = (diffData?.deficit_percentage || 17.5) / 100;
    const weeklyBudget = (userData?.tdee || 1750) * 7 * (1 - deficit);

    const { data: existingMonster } = await supabase
      .from('weekly_monsters')
      .select('*')
      .eq('user_id', uid)
      .eq('week_start', start)
      .maybeSingle();

    if (existingMonster) {
      setMonster(existingMonster as Monster);
    } else {
      const { data: newMonster } = await supabase
        .from('weekly_monsters')
        .insert({
          user_id: uid,
          week_start: start,
          week_end: end,
          initial_hp: weeklyBudget,
          current_hp: weeklyBudget,
          difficulty_id: userData?.current_difficulty_id,
        })
        .select()
        .maybeSingle();
      setMonster(newMonster as Monster);
    }

    await loadTodayLogs(uid);
  };

  const loadTodayLogs = async (uid: string) => {
    const today = new Date().toISOString().split('T')[0];
    const { start } = getWeekDates();

    const { data: monsterData } = await supabase
      .from('weekly_monsters')
      .select('id')
      .eq('user_id', uid)
      .eq('week_start', start)
      .maybeSingle();

    if (monsterData) {
      const { data: logs } = await supabase
        .from('daily_logs')
        .select('*')
        .eq('user_id', uid)
        .eq('monster_id', monsterData.id)
        .eq('log_date', today)
        .order('created_at', { ascending: false });
      setTodayLogs(logs || []);
    }
  };

  const estimateCalories = async (description: string): Promise<number> => {
    if (!userId) return 0;

    const { data: foodMem } = await supabase
      .from('food_memory')
      .select('calories, times_logged')
      .eq('user_id', userId)
      .ilike('food_name', description)
      .maybeSingle();

    if (foodMem) {
      await supabase
        .from('food_memory')
        .update({ times_logged: foodMem.times_logged + 1, last_used: new Date().toISOString() })
        .ilike('food_name', description)
        .eq('user_id', userId);
      return foodMem.calories;
    }

    try {
      const response = await fetch(`${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/estimate-food`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ food_description: description }),
      });

      if (response.ok) {
        const data = await response.json();
        const calories = data.calories || 300;

        await supabase.from('food_memory').insert({
          user_id: userId,
          food_name: description,
          calories,
          protein_g: data.protein_g,
          carbs_g: data.carbs_g,
          fat_g: data.fat_g,
          serving_size: data.serving_size,
        });

        return calories;
      }
    } catch (err) {
      console.error('AI estimation failed:', err);
    }

    return 250;
  };

  const handleLogFood = async () => {
    if (!foodInput.trim() || !monster || !userId) return;

    setLoading(true);
    try {
      const calories = await estimateCalories(foodInput);

      const { data: newLog } = await supabase
        .from('daily_logs')
        .insert({
          user_id: userId,
          monster_id: monster.id,
          food_description: foodInput,
          calories,
          log_date: new Date().toISOString().split('T')[0],
        })
        .select()
        .maybeSingle();

      const updatedHp = Math.max(0, monster.current_hp - calories);
      await supabase
        .from('weekly_monsters')
        .update({ current_hp: updatedHp })
        .eq('id', monster.id);

      setMonster({ ...monster, current_hp: updatedHp });
      setFoodInput('');
      await loadTodayLogs(userId);

      Animated.sequence([
        Animated.spring(scaleAnim, { toValue: 1.1, useNativeDriver: true }),
        Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true }),
      ]).start();
    } catch (err) {
      console.error('Error logging food:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteLog = async (logId: string, calories: number) => {
    if (!userId || !monster) return;
    try {
      await supabase.from('daily_logs').delete().eq('id', logId);
      const updatedHp = Math.min(monster.initial_hp, monster.current_hp + calories);
      await supabase
        .from('weekly_monsters')
        .update({ current_hp: updatedHp })
        .eq('id', monster.id);
      setMonster({ ...monster, current_hp: updatedHp });
      await loadTodayLogs(userId);
    } catch (err) {
      console.error('Error deleting log:', err);
    }
  };

  const getMonsterReaction = () => {
    if (!monster) return { emoji: '😐', status: 'Neutral' };
    const hpPercent = (monster.current_hp / monster.initial_hp) * 100;
    if (hpPercent > 70) return { emoji: '😊', status: 'Happy' };
    if (hpPercent > 30) return { emoji: '😐', status: 'Neutral' };
    return { emoji: '😠', status: 'Angry' };
  };

  const monsterState = getMonsterReaction();
  const hpPercent = monster ? (monster.current_hp / monster.initial_hp) * 100 : 100;

  return (
    <LinearGradient colors={['#0F172A', '#111827']} style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>Weekly Battle</Text>
          <Text style={styles.subtitle}>Defeat the monster this week</Text>
        </View>

        <Animated.View style={[styles.monsterCard, { transform: [{ scale: scaleAnim }] }]}>
          <LinearGradient colors={['#1F2937', '#1A2535']} style={styles.monsterGradient}>
            <Text style={styles.monsterEmoji}>{monsterState.emoji}</Text>
            <Text style={styles.monsterStatus}>{monsterState.status}</Text>
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
              placeholder="What did you eat? (e.g., curry rice + coffee)"
              placeholderTextColor="#6B7280"
              value={foodInput}
              onChangeText={setFoodInput}
              editable={!loading}
            />
            <TouchableOpacity
              style={[styles.logButton, loading && styles.buttonDisabled]}
              onPress={handleLogFood}
              disabled={loading || !foodInput.trim()}
            >
              <Plus color="#0F172A" size={20} />
            </TouchableOpacity>
          </View>
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
                <TouchableOpacity onPress={() => handleDeleteLog(log.id, log.calories)}>
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
    marginBottom: 12,
  },
  monsterStatus: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 20,
  },
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
