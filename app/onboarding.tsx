import { View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'expo-router';
import { Zap } from 'lucide-react-native';

export default function OnboardingScreen() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [weight, setWeight] = useState('70');
  const [selectedDifficulty, setSelectedDifficulty] = useState('warrior');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const difficulties = [
    { id: 'beginner', label: 'Beginner Fighter', desc: '~10% deficit', emoji: '🟢' },
    { id: 'warrior', label: 'Warrior Mode', desc: '~17.5% deficit', emoji: '🟡' },
    { id: 'elite', label: 'Elite Fighter', desc: '~22.5% deficit', emoji: '🟠' },
    { id: 'maintenance', label: 'Maintenance Mode', desc: 'No deficit', emoji: '🔵' },
  ];

  const calculateTDEE = (weightKg: number) => {
    return Math.round(weightKg * 25);
  };

  const handleContinue = async () => {
    if (step === 1) {
      if (!weight || parseFloat(weight) < 40 || parseFloat(weight) > 300) {
        setError('Please enter a valid weight (40-300 kg)');
        return;
      }
      setError('');
      setStep(2);
    } else if (step === 2) {
      setLoading(true);
      setError('');
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user?.id) throw new Error('Not authenticated');

        const tdee = calculateTDEE(parseFloat(weight));

        await supabase.from('users').insert({
          id: session.user.id,
          weight_kg: parseFloat(weight),
          tdee,
          current_difficulty_id: null,
        });

        const diffLookup: Record<string, string> = {
          beginner: 'beginner',
          warrior: 'warrior',
          elite: 'elite',
          maintenance: 'maintenance',
        };

        const { data: diffData } = await supabase
          .from('difficulties')
          .select('id')
          .eq('name', diffLookup[selectedDifficulty])
          .maybeSingle();

        if (diffData) {
          await supabase
            .from('users')
            .update({ current_difficulty_id: diffData.id })
            .eq('id', session.user.id);
        }

        router.replace('/(tabs)');
      } catch (err) {
        setError(String(err));
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <LinearGradient colors={['#0F172A', '#111827']} style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Zap color="#FBBF24" size={48} />
          <Text style={styles.title}>Calories Fighter</Text>
          <Text style={styles.subtitle}>Turn eating control into an epic battle</Text>
        </View>

        {step === 1 ? (
          <View style={styles.stepContainer}>
            <Text style={styles.stepTitle}>What's your weight?</Text>
            <View style={styles.inputGroup}>
              <TextInput
                style={styles.input}
                placeholder="Enter weight in kg"
                placeholderTextColor="#6B7280"
                keyboardType="decimal-pad"
                value={weight}
                onChangeText={setWeight}
              />
              <Text style={styles.hint}>Used to calculate your daily calorie budget</Text>
            </View>
          </View>
        ) : (
          <View style={styles.stepContainer}>
            <Text style={styles.stepTitle}>Choose your battle difficulty</Text>
            <View style={styles.difficultiesGrid}>
              {difficulties.map((diff) => (
                <TouchableOpacity
                  key={diff.id}
                  style={[
                    styles.difficultyCard,
                    selectedDifficulty === diff.id && styles.difficultyCardActive,
                  ]}
                  onPress={() => setSelectedDifficulty(diff.id)}
                >
                  <Text style={styles.emoji}>{diff.emoji}</Text>
                  <Text style={styles.diffLabel}>{diff.label}</Text>
                  <Text style={styles.diffDesc}>{diff.desc}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleContinue}
          disabled={loading}
        >
          <Text style={styles.buttonText}>
            {loading ? 'Starting battle...' : step === 1 ? 'Next' : 'Start Fighting'}
          </Text>
        </TouchableOpacity>

        {step === 2 && (
          <TouchableOpacity onPress={() => setStep(1)} style={styles.backButton}>
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
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
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingVertical: 40,
    justifyContent: 'space-between',
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 16,
  },
  subtitle: {
    fontSize: 16,
    color: '#9CA3AF',
    marginTop: 8,
  },
  stepContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 24,
  },
  inputGroup: {
    marginBottom: 24,
  },
  input: {
    backgroundColor: '#1F2937',
    borderWidth: 1,
    borderColor: '#374151',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#FFFFFF',
    marginBottom: 8,
  },
  hint: {
    fontSize: 14,
    color: '#9CA3AF',
    paddingHorizontal: 4,
  },
  difficultiesGrid: {
    gap: 12,
  },
  difficultyCard: {
    backgroundColor: '#1F2937',
    borderWidth: 2,
    borderColor: '#374151',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  difficultyCardActive: {
    borderColor: '#FBBF24',
    backgroundColor: '#2D2415',
  },
  emoji: {
    fontSize: 32,
    marginBottom: 8,
  },
  diffLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  diffDesc: {
    fontSize: 13,
    color: '#9CA3AF',
  },
  button: {
    backgroundColor: '#FBBF24',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 24,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0F172A',
  },
  backButton: {
    marginTop: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  backButtonText: {
    fontSize: 16,
    color: '#9CA3AF',
    fontWeight: '500',
  },
  error: {
    color: '#EF4444',
    fontSize: 14,
    marginBottom: 16,
    textAlign: 'center',
  },
});
