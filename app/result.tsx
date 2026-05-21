import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Flame, Beef, Wheat, Droplets, ChevronLeft, CircleCheck as CheckCircle, Info, ShieldCheck, ShieldAlert } from 'lucide-react-native';

export default function ResultScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    name: string;
    calories: string;
    protein: string;
    carbs: string;
    fat: string;
    serving: string;
    notes: string;
    ingredients: string;
    confidence: string;
    imageUri: string;
  }>();

  const calories = parseInt(params.calories ?? '0', 10);
  const protein = parseFloat(params.protein ?? '0');
  const carbs = parseFloat(params.carbs ?? '0');
  const fat = parseFloat(params.fat ?? '0');
  const ingredients: string[] = JSON.parse(params.ingredients ?? '[]');
  const confidence = params.confidence ?? 'medium';

  const getCalorieLevel = () => {
    if (calories < 200) return { label: 'Low Calorie', color: '#22C55E' };
    if (calories < 500) return { label: 'Moderate', color: '#F59E0B' };
    return { label: 'High Calorie', color: '#EF4444' };
  };

  const calLevel = getCalorieLevel();

  const totalMacroG = protein + carbs + fat;
  const proteinPct = totalMacroG > 0 ? Math.round((protein / totalMacroG) * 100) : 0;
  const carbsPct = totalMacroG > 0 ? Math.round((carbs / totalMacroG) * 100) : 0;
  const fatPct = totalMacroG > 0 ? Math.round((fat / totalMacroG) * 100) : 0;

  return (
    <LinearGradient colors={['#0F172A', '#111827']} style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
        {/* Image hero */}
        <View style={styles.imageContainer}>
          {params.imageUri ? (
            <Image source={{ uri: params.imageUri }} style={styles.heroImage} />
          ) : (
            <View style={styles.imagePlaceholder}>
              <Flame color="#22C55E" size={48} />
            </View>
          )}
          <LinearGradient
            colors={['rgba(15,23,42,0)', 'rgba(15,23,42,0.7)', '#0F172A']}
            style={styles.imageGradient}
          />
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <ChevronLeft color="#FFFFFF" size={24} />
          </TouchableOpacity>
        </View>

        <View style={styles.content}>
          {/* Name & confidence */}
          <View style={styles.nameRow}>
            <Text style={styles.foodName}>{params.name}</Text>
            <View
              style={[
                styles.confidenceBadge,
                {
                  backgroundColor:
                    confidence === 'high'
                      ? 'rgba(34,197,94,0.15)'
                      : confidence === 'low'
                      ? 'rgba(239,68,68,0.15)'
                      : 'rgba(245,158,11,0.15)',
                },
              ]}
            >
              {confidence === 'high' ? (
                <ShieldCheck
                  color={confidence === 'high' ? '#22C55E' : '#F59E0B'}
                  size={13}
                />
              ) : (
                <ShieldAlert color="#EF4444" size={13} />
              )}
              <Text
                style={[
                  styles.confidenceText,
                  {
                    color:
                      confidence === 'high'
                        ? '#22C55E'
                        : confidence === 'low'
                        ? '#EF4444'
                        : '#F59E0B',
                  },
                ]}
              >
                {confidence} confidence
              </Text>
            </View>
          </View>

          {params.serving ? (
            <Text style={styles.serving}>{params.serving}</Text>
          ) : null}

          {/* Calorie hero */}
          <View style={styles.calorieCard}>
            <LinearGradient
              colors={['#1F2937', '#1A2535']}
              style={styles.calorieGradient}
            >
              <Flame color={calLevel.color} size={32} />
              <Text style={[styles.calorieNumber, { color: calLevel.color }]}>{calories}</Text>
              <Text style={styles.calorieUnit}>Calories</Text>
              <View style={[styles.levelBadge, { backgroundColor: calLevel.color + '22' }]}>
                <Text style={[styles.levelText, { color: calLevel.color }]}>{calLevel.label}</Text>
              </View>
            </LinearGradient>
          </View>

          {/* Macro bar */}
          <View style={styles.macroBarContainer}>
            <View style={styles.macroBar}>
              <View style={[styles.macroBarSegment, { flex: proteinPct, backgroundColor: '#60A5FA' }]} />
              <View style={[styles.macroBarSegment, { flex: carbsPct, backgroundColor: '#FBBF24' }]} />
              <View style={[styles.macroBarSegment, { flex: fatPct, backgroundColor: '#F472B6' }]} />
            </View>
            <View style={styles.macroLegend}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#60A5FA' }]} />
                <Text style={styles.legendText}>Protein {proteinPct}%</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#FBBF24' }]} />
                <Text style={styles.legendText}>Carbs {carbsPct}%</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#F472B6' }]} />
                <Text style={styles.legendText}>Fat {fatPct}%</Text>
              </View>
            </View>
          </View>

          {/* Macro cards */}
          <View style={styles.macroGrid}>
            <View style={styles.macroCard}>
              <Beef color="#60A5FA" size={22} />
              <Text style={[styles.macroValue, { color: '#60A5FA' }]}>{protein.toFixed(1)}g</Text>
              <Text style={styles.macroLabel}>Protein</Text>
            </View>
            <View style={styles.macroCard}>
              <Wheat color="#FBBF24" size={22} />
              <Text style={[styles.macroValue, { color: '#FBBF24' }]}>{carbs.toFixed(1)}g</Text>
              <Text style={styles.macroLabel}>Carbs</Text>
            </View>
            <View style={styles.macroCard}>
              <Droplets color="#F472B6" size={22} />
              <Text style={[styles.macroValue, { color: '#F472B6' }]}>{fat.toFixed(1)}g</Text>
              <Text style={styles.macroLabel}>Fat</Text>
            </View>
          </View>

          {/* Ingredients */}
          {ingredients.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Likely Ingredients</Text>
              <View style={styles.ingredientList}>
                {ingredients.map((ing, i) => (
                  <View key={i} style={styles.ingredientItem}>
                    <CheckCircle color="#22C55E" size={14} />
                    <Text style={styles.ingredientText}>{ing}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Notes */}
          {params.notes ? (
            <View style={styles.notesCard}>
              <View style={styles.notesHeader}>
                <Info color="#60A5FA" size={16} />
                <Text style={styles.notesTitle}>Nutrition Notes</Text>
              </View>
              <Text style={styles.notesText}>{params.notes}</Text>
            </View>
          ) : null}

          {/* Disclaimer */}
          <Text style={styles.disclaimer}>
            Calorie estimates are AI-generated approximations. For precise tracking, consult a
            registered dietitian.
          </Text>

          <TouchableOpacity style={styles.doneBtn} onPress={() => router.back()}>
            <Text style={styles.doneBtnText}>Done</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  imageContainer: {
    height: 300,
    position: 'relative',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  imagePlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#1F2937',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 160,
  },
  backBtn: {
    position: 'absolute',
    top: 52,
    left: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 48,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 4,
  },
  foodName: {
    color: '#F9FAFB',
    fontSize: 26,
    fontWeight: '700',
    flex: 1,
    lineHeight: 32,
  },
  confidenceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginTop: 4,
  },
  confidenceText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  serving: {
    color: '#9CA3AF',
    fontSize: 14,
    marginBottom: 20,
  },
  calorieCard: {
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 20,
  },
  calorieGradient: {
    alignItems: 'center',
    paddingVertical: 28,
    gap: 6,
  },
  calorieNumber: {
    fontSize: 56,
    fontWeight: '800',
    lineHeight: 62,
  },
  calorieUnit: {
    color: '#9CA3AF',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  levelBadge: {
    paddingHorizontal: 14,
    paddingVertical: 4,
    borderRadius: 20,
    marginTop: 4,
  },
  levelText: {
    fontSize: 12,
    fontWeight: '700',
  },
  macroBarContainer: {
    marginBottom: 16,
    gap: 10,
  },
  macroBar: {
    height: 10,
    borderRadius: 5,
    flexDirection: 'row',
    overflow: 'hidden',
    backgroundColor: '#374151',
  },
  macroBarSegment: {
    height: '100%',
  },
  macroLegend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    color: '#9CA3AF',
    fontSize: 11,
  },
  macroGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 24,
  },
  macroCard: {
    flex: 1,
    backgroundColor: '#1F2937',
    borderRadius: 16,
    padding: 14,
    alignItems: 'center',
    gap: 6,
  },
  macroValue: {
    fontSize: 20,
    fontWeight: '700',
  },
  macroLabel: {
    color: '#6B7280',
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    color: '#F9FAFB',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 10,
  },
  ingredientList: {
    backgroundColor: '#1F2937',
    borderRadius: 14,
    padding: 14,
    gap: 8,
  },
  ingredientItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  ingredientText: {
    color: '#D1D5DB',
    fontSize: 14,
    textTransform: 'capitalize',
  },
  notesCard: {
    backgroundColor: 'rgba(96,165,250,0.08)',
    borderRadius: 14,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(96,165,250,0.2)',
    gap: 8,
  },
  notesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  notesTitle: {
    color: '#60A5FA',
    fontSize: 13,
    fontWeight: '700',
  },
  notesText: {
    color: '#D1D5DB',
    fontSize: 13,
    lineHeight: 20,
  },
  disclaimer: {
    color: '#4B5563',
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 16,
    marginBottom: 20,
  },
  doneBtn: {
    backgroundColor: '#22C55E',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  doneBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
