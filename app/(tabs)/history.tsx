import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { History, Trash2 } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

interface DailyLog {
  id: string;
  food_description: string;
  calories: number;
  log_date: string;
  created_at: string;
}

export default function LogScreen() {
  const [allLogs, setAllLogs] = useState<DailyLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  const fetchLogs = async (uid: string) => {
    const { data } = await supabase
      .from('daily_logs')
      .select('*')
      .eq('user_id', uid)
      .order('created_at', { ascending: false })
      .limit(100);

    setAllLogs(data || []);
    setLoading(false);
    setRefreshing(false);
  };

  useFocusEffect(
    useCallback(() => {
      const init = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user?.id) {
          setUserId(session.user.id);
          await fetchLogs(session.user.id);
        }
      };
      init();
    }, [])
  );

  const onRefresh = () => {
    setRefreshing(true);
    if (userId) fetchLogs(userId);
  };

  const handleDelete = async (logId: string) => {
    try {
      await supabase.from('daily_logs').delete().eq('id', logId);
      setAllLogs(allLogs.filter((l) => l.id !== logId));
    } catch (err) {
      console.error('Error deleting log:', err);
    }
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const today = new Date().toISOString().split('T')[0];
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  if (loading) {
    return (
      <LinearGradient colors={['#0F172A', '#111827']} style={styles.centered}>
        <ActivityIndicator color="#FBBF24" size="large" />
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={['#0F172A', '#111827']} style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Food Log</Text>
        <Text style={styles.subtitle}>{allLogs.length} entries</Text>
      </View>

      {allLogs.length === 0 ? (
        <View style={styles.empty}>
          <History color="#374151" size={64} />
          <Text style={styles.emptyTitle}>No food logged yet</Text>
          <Text style={styles.emptyText}>Start logging meals in the Battle tab</Text>
        </View>
      ) : (
        <FlatList
          data={allLogs}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#FBBF24"
            />
          }
          renderItem={({ item }) => (
            <View style={styles.logCard}>
              <View style={styles.logContent}>
                <Text style={styles.logFood}>{item.food_description}</Text>
                <Text style={styles.logDate}>{formatDate(item.log_date)}</Text>
              </View>
              <View style={styles.logRight}>
                <Text style={styles.logCalories}>{Math.round(item.calories)}</Text>
                <Text style={styles.logKcal}>kcal</Text>
              </View>
              <TouchableOpacity onPress={() => handleDelete(item.id)}>
                <Trash2 color="#EF4444" size={18} />
              </TouchableOpacity>
            </View>
          )}
        />
      )}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    paddingTop: 60,
    paddingHorizontal: 24,
    paddingBottom: 16,
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
  list: {
    paddingHorizontal: 16,
    paddingBottom: 32,
    gap: 8,
  },
  logCard: {
    backgroundColor: '#1F2937',
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    justifyContent: 'space-between',
  },
  logContent: {
    flex: 1,
  },
  logFood: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },
  logDate: {
    color: '#9CA3AF',
    fontSize: 12,
    marginTop: 4,
  },
  logRight: {
    alignItems: 'flex-end',
    marginRight: 12,
  },
  logCalories: {
    color: '#FBBF24',
    fontSize: 16,
    fontWeight: '600',
  },
  logKcal: {
    color: '#9CA3AF',
    fontSize: 10,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingBottom: 80,
  },
  emptyTitle: {
    color: '#9CA3AF',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 8,
  },
  emptyText: {
    color: '#6B7280',
    fontSize: 14,
  },
});
