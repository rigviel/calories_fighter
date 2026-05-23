import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { getSession, getWeeklyMonster, getWeeklyResults } from '@/lib/local-store';
import { TrendingUp, Trophy, Target, Zap } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

export default function StatsScreen() {
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [monster, setMonster] = useState<any>(null);
  const [weeklyResults, setWeeklyResults] = useState<any[]>([]);
  const [totalWins, setTotalWins] = useState(0);
  const [currentStreak, setCurrentStreak] = useState(0);
  const router = useRouter();

  useFocusEffect(
    useCallback(() => {
      const init = async () => {
        const session = await getSession();
        if (session?.user?.id) {
          setUserId(session.user.id);
          await loadStats(session.user.id);
        } else {
          setLoading(false);
        }
      };
      init();
    }, [])
  );

  const loadStats = async (uid: string) => {
    const { start } = getWeekDates();

    const monsterData = await getWeeklyMonster(uid, start);

    setMonster(monsterData);

    const results = await getWeeklyResults(uid, 10);

    setWeeklyResults(results);

    if (results && results.length > 0) {
      const wins = results.filter((r: any) => r.outcome === 'win').length;
      setTotalWins(wins);

      let streak = 0;
      for (const r of results) {
        if (r.outcome === 'win') streak++;
        else break;
      }
      setCurrentStreak(streak);
    }

    setLoading(false);
  };

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

  if (loading) {
    return (
      <LinearGradient colors={['#0F172A', '#111827']} style={styles.centered}>
        <ActivityIndicator color="#FBBF24" size="large" />
      </LinearGradient>
    );
  }

  const hpPercent = monster ? (monster.current_hp / monster.initial_hp) * 100 : 0;
  const weeklyCaloriesUsed = monster ? monster.initial_hp - monster.current_hp : 0;

  return (
    <LinearGradient colors={['#0F172A', '#111827']} style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <Text style={styles.title}>Battle Stats</Text>
          <Text style={styles.subtitle}>Your fighting progress</Text>
        </View>

        <View style={styles.streakCard}>
          <LinearGradient colors={['#1F2937', '#1A2535']} style={styles.streakGradient}>
            <Zap color="#FBBF24" size={32} />
            <Text style={styles.streakValue}>{currentStreak}</Text>
            <Text style={styles.streakLabel}>Week Win Streak</Text>
          </LinearGradient>
        </View>

        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Trophy color="#FBBF24" size={24} />
            <Text style={styles.statValue}>{totalWins}</Text>
            <Text style={styles.statLabel}>Total Wins</Text>
          </View>
          <View style={styles.statCard}>
            <Target color="#22C55E" size={24} />
            <Text style={styles.statValue}>{weeklyResults.length}</Text>
            <Text style={styles.statLabel}>Battles</Text>
          </View>
        </View>

        {monster && (
          <View style={styles.weeklyCard}>
            <Text style={styles.cardTitle}>This Week's Battle</Text>
            <View style={styles.weeklyProgress}>
              <View style={styles.weeklyBar}>
                <View
                  style={[
                    styles.weeklyBarFill,
                    {
                      width: `${hpPercent}%`,
                      backgroundColor: hpPercent > 50 ? '#22C55E' : hpPercent > 25 ? '#FBBF24' : '#EF4444',
                    },
                  ]}
                />
              </View>
              <Text style={styles.weeklyText}>
                {Math.round(monster.current_hp)} / {Math.round(monster.initial_hp)} HP remaining
              </Text>
            </View>
            <Text style={styles.weeklyCal}>
              {Math.round(weeklyCaloriesUsed)} calories consumed this week
            </Text>
          </View>
        )}

        {weeklyResults.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Battle History</Text>
            {weeklyResults.map((result: any, idx: number) => (
              <View key={result.id || idx} style={styles.resultCard}>
                <View style={styles.resultMain}>
                  <Text style={styles.resultDate}>
                    {new Date(result.week_start).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </Text>
                  <View style={[styles.outcomeBadge, { backgroundColor: getOutcomeColor(result.outcome) }]}>
                    <Text style={styles.outcomeText}>{result.outcome.toUpperCase()}</Text>
                  </View>
                </View>
                <View style={styles.resultStats}>
                  <Text style={styles.resultCal}>
                    {Math.round(result.total_calories)} / {Math.round(result.target_calories)} kcal
                  </Text>
                  {result.badge_earned && (
                    <Text style={styles.resultBadge}>🏅 {result.badge_earned}</Text>
                  )}
                </View>
              </View>
            ))}
          </>
        )}

        {weeklyResults.length === 0 && (
          <View style={styles.emptyResults}>
            <TrendingUp color="#374151" size={48} />
            <Text style={styles.emptyText}>Complete your first week to see results</Text>
          </View>
        )}
      </ScrollView>
    </LinearGradient>
  );
}

function getOutcomeColor(outcome: string): string {
  if (outcome === 'win') return '#22C55E';
  if (outcome === 'partial') return '#FBBF24';
  return '#EF4444';
}

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
    color: '#9CA3AF',
    fontSize: 14,
    marginTop: 4,
  },
  streakCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 16,
    overflow: 'hidden',
  },
  streakGradient: {
    paddingVertical: 24,
    alignItems: 'center',
    gap: 8,
  },
  streakValue: {
    fontSize: 48,
    fontWeight: '700',
    color: '#FBBF24',
  },
  streakLabel: {
    fontSize: 14,
    color: '#9CA3AF',
  },
  statsGrid: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 12,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#1F2937',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    gap: 8,
  },
  statValue: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  statLabel: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  weeklyCard: {
    marginHorizontal: 16,
    backgroundColor: '#1F2937',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  weeklyProgress: {
    marginBottom: 12,
  },
  weeklyBar: {
    height: 8,
    backgroundColor: '#374151',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  weeklyBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  weeklyText: {
    fontSize: 13,
    color: '#D1D5DB',
    textAlign: 'center',
  },
  weeklyCal: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'center',
  },
  sectionTitle: {
    color: '#F9FAFB',
    fontSize: 18,
    fontWeight: '700',
    paddingHorizontal: 24,
    marginTop: 16,
    marginBottom: 12,
  },
  resultCard: {
    marginHorizontal: 16,
    backgroundColor: '#1F2937',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  resultMain: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  resultDate: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  outcomeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  outcomeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  resultStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  resultCal: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  resultBadge: {
    fontSize: 12,
    color: '#FBBF24',
  },
  emptyResults: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    gap: 12,
  },
  emptyText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
});
