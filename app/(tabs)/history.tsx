import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { supabase, Meal } from '@/lib/supabase';
import { Flame, Beef, Wheat, Droplets, ChevronRight, ClipboardList } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

export default function HistoryScreen() {
  const [meals, setMeals] = useState<Meal[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();

  const fetchMeals = async () => {
    const { data, error } = await supabase
      .from('meals')
      .select('*')
      .order('logged_at', { ascending: false })
      .limit(50);

    if (!error && data) setMeals(data as Meal[]);
    setLoading(false);
    setRefreshing(false);
  };

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchMeals();
    }, [])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchMeals();
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    if (d.toDateString() === today.toDateString()) return 'Today';
    if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const formatTime = (iso: string) => {
    return new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  const getCalorieColor = (cal: number) => {
    if (cal < 300) return '#22C55E';
    if (cal < 600) return '#F59E0B';
    return '#EF4444';
  };

  if (loading) {
    return (
      <LinearGradient colors={['#0F172A', '#111827']} style={styles.centered}>
        <ActivityIndicator color="#22C55E" size="large" />
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={['#0F172A', '#111827']} style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Meal History</Text>
        <Text style={styles.subtitle}>{meals.length} meals logged</Text>
      </View>

      {meals.length === 0 ? (
        <View style={styles.empty}>
          <ClipboardList color="#374151" size={64} />
          <Text style={styles.emptyTitle}>No meals logged yet</Text>
          <Text style={styles.emptyText}>Scan your first meal to get started</Text>
        </View>
      ) : (
        <FlatList
          data={meals}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#22C55E"
            />
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() =>
                router.push({
                  pathname: '/result',
                  params: {
                    name: item.name,
                    calories: String(item.calories),
                    protein: String(item.protein_g ?? 0),
                    carbs: String(item.carbs_g ?? 0),
                    fat: String(item.fat_g ?? 0),
                    serving: item.serving_size ?? '',
                    notes: item.notes ?? '',
                    ingredients: '[]',
                    confidence: 'high',
                    imageUri: item.image_url ?? '',
                  },
                })
              }
            >
              <View style={styles.cardLeft}>
                {item.image_url ? (
                  <Image source={{ uri: item.image_url }} style={styles.thumbnail} />
                ) : (
                  <View style={styles.thumbnailPlaceholder}>
                    <Flame color="#22C55E" size={24} />
                  </View>
                )}
              </View>

              <View style={styles.cardBody}>
                <Text style={styles.mealName} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={styles.mealMeta}>
                  {formatDate(item.logged_at)} · {formatTime(item.logged_at)}
                </Text>
                <View style={styles.macroRow}>
                  <View style={styles.macroItem}>
                    <Beef color="#60A5FA" size={12} />
                    <Text style={styles.macroText}>{item.protein_g ?? 0}g</Text>
                  </View>
                  <View style={styles.macroItem}>
                    <Wheat color="#FBBF24" size={12} />
                    <Text style={styles.macroText}>{item.carbs_g ?? 0}g</Text>
                  </View>
                  <View style={styles.macroItem}>
                    <Droplets color="#F472B6" size={12} />
                    <Text style={styles.macroText}>{item.fat_g ?? 0}g</Text>
                  </View>
                </View>
              </View>

              <View style={styles.cardRight}>
                <Text style={[styles.calories, { color: getCalorieColor(item.calories) }]}>
                  {item.calories}
                </Text>
                <Text style={styles.kcal}>kcal</Text>
                <ChevronRight color="#374151" size={16} style={{ marginTop: 4 }} />
              </View>
            </TouchableOpacity>
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
    color: '#6B7280',
    fontSize: 14,
    marginTop: 4,
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 32,
    gap: 12,
  },
  card: {
    backgroundColor: '#1F2937',
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  cardLeft: {},
  thumbnail: {
    width: 64,
    height: 64,
    borderRadius: 10,
    backgroundColor: '#374151',
  },
  thumbnailPlaceholder: {
    width: 64,
    height: 64,
    borderRadius: 10,
    backgroundColor: '#374151',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: {
    flex: 1,
    gap: 4,
  },
  mealName: {
    color: '#F9FAFB',
    fontSize: 15,
    fontWeight: '600',
  },
  mealMeta: {
    color: '#6B7280',
    fontSize: 12,
  },
  macroRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 2,
  },
  macroItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  macroText: {
    color: '#9CA3AF',
    fontSize: 11,
  },
  cardRight: {
    alignItems: 'center',
  },
  calories: {
    fontSize: 20,
    fontWeight: '700',
  },
  kcal: {
    color: '#6B7280',
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.5,
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
