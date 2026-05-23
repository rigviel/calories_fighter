import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { OverheatState } from '@/lib/overheat';
import { getBarFillWidth, getUsagePercentDisplay, isOverheatGlow } from '@/lib/overheat';

interface OverheatBarProps {
  usagePercent: number;
  state: OverheatState;
  todayIntake: number;
  dailyTarget: number;
}

const FILL_COLORS: Record<OverheatState, [string, string]> = {
  cool: ['#FDE68A', '#FBBF24'],
  warm: ['#FDBA74', '#FB923C'],
  hot: ['#FB923C', '#F97316'],
  overheat: ['#F97316', '#EF4444'],
};

export function OverheatBar({
  usagePercent,
  state,
  todayIntake,
  dailyTarget,
}: OverheatBarProps) {
  const displayPercent = getUsagePercentDisplay(usagePercent);
  const fillWidth = getBarFillWidth(usagePercent);
  const showGlow = isOverheatGlow(state);
  const showFill = state !== 'cool' || usagePercent > 0;

  return (
    <View style={styles.wrapper}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>🟠 Daily Overheat</Text>
        <Text style={styles.percentText}>{Math.round(displayPercent)}%</Text>
      </View>

      <View style={[styles.track, showGlow && styles.trackGlow]}>
        {showGlow && <View style={styles.glowOverlay} />}
        {showFill && (
          <View style={[styles.fillClip, { width: `${fillWidth}%` }]}>
            <LinearGradient
              colors={FILL_COLORS[state]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.fill}
            />
          </View>
        )}
        {displayPercent > 100 && (
          <View style={styles.overflowBadge}>
            <Text style={styles.overflowText}>+{Math.round(displayPercent - 100)}%</Text>
          </View>
        )}
      </View>

      <Text style={styles.intakeText}>
        {Math.round(todayIntake)} / {Math.round(dailyTarget)} kcal today
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
    paddingHorizontal: 24,
    marginBottom: 16,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FB923C',
  },
  percentText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FDBA74',
  },
  track: {
    height: 14,
    backgroundColor: '#374151',
    borderRadius: 7,
    overflow: 'hidden',
    position: 'relative',
  },
  trackGlow: {
    borderWidth: 1,
    borderColor: '#EF4444',
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 10,
    elevation: 8,
  },
  glowOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(239, 68, 68, 0.35)',
    borderRadius: 7,
  },
  fillClip: {
    height: '100%',
    overflow: 'hidden',
    borderRadius: 7,
  },
  fill: {
    flex: 1,
    height: '100%',
    borderRadius: 7,
  },
  overflowBadge: {
    position: 'absolute',
    right: 6,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  overflowText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FEE2E2',
  },
  intakeText: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 6,
    textAlign: 'center',
  },
});
