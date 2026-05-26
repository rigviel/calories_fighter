import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { OverheatFire3D } from '@/components/OverheatFire3D';
import type { OverheatState } from '@/lib/overheat';
import { getUsagePercentDisplay, isOverheatGlow } from '@/lib/overheat';

interface OverheatBarProps {
  usagePercent: number;
  state: OverheatState;
  todayIntake: number;
  dailyTarget: number;
}

const SEGMENT_COUNT = 10;
const SEGMENT_GAP = 3;
const TRACK_HEIGHT = 32;
const SKEW_DEG = '-11deg';

const SEGMENT_COLORS: Record<OverheatState, [string, string, string]> = {
  cool: ['#FDE68A', '#FBBF24', '#F59E0B'],
  warm: ['#FDBA74', '#FB923C', '#EA580C'],
  hot: ['#FB923C', '#F97316', '#EA580C'],
  overheat: ['#F97316', '#EF4444', '#DC2626'],
};

const PERCENT_COLORS: Record<OverheatState, string> = {
  cool: '#FBBF24',
  warm: '#FB923C',
  hot: '#F97316',
  overheat: '#EF4444',
};

function filledSegmentCount(usagePercent: number, total: number): number {
  if (total <= 0) return 0;
  const ratio = Math.max(0, usagePercent);
  return Math.min(total, Math.round(ratio * total));
}

export function OverheatBar({
  usagePercent,
  state,
  todayIntake,
  dailyTarget,
}: OverheatBarProps) {
  const displayPercent = getUsagePercentDisplay(usagePercent);
  const showGlow = isOverheatGlow(state);
  const showFill = state !== 'cool' || usagePercent > 0;
  const filled = showFill ? filledSegmentCount(usagePercent, SEGMENT_COUNT) : 0;
  const segmentColors = SEGMENT_COLORS[state];
  const overflow = displayPercent > 100;

  return (
    <View style={styles.wrapper}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>🟠 Daily Overheat</Text>
        <Text style={[styles.percentText, { color: PERCENT_COLORS[state] }]}>
          {Math.round(displayPercent)}%
        </Text>
      </View>

      <View style={styles.barRow}>
        <View style={styles.fireAssembly}>
          <OverheatFire3D height={TRACK_HEIGHT + 6} />
        </View>

        <View style={[styles.barStack, { height: TRACK_HEIGHT }]}>
          <View
            style={[styles.shadowTail, { transform: [{ skewX: SKEW_DEG }] }]}
          />
          <View
            style={[
              styles.track,
              { height: TRACK_HEIGHT, transform: [{ skewX: SKEW_DEG }] },
              showGlow && styles.trackGlow,
            ]}
          >
            {showGlow && <View style={styles.glowOverlay} />}
            <View style={styles.segmentsRow}>
              {Array.from({ length: SEGMENT_COUNT }, (_, index) => {
                const isFilled = index < filled;
                return (
                  <View
                    key={index}
                    style={[
                      styles.segmentSlot,
                      index > 0 && { marginLeft: SEGMENT_GAP },
                    ]}
                  >
                    {isFilled ? (
                      <LinearGradient
                        colors={segmentColors}
                        locations={[0, 0.42, 1]}
                        style={styles.segmentFill}
                      />
                    ) : null}
                  </View>
                );
              })}
            </View>
            {overflow && (
              <View style={styles.overflowBadge}>
                <Text style={styles.overflowText}>
                  +{Math.round(displayPercent - 100)}%
                </Text>
              </View>
            )}
          </View>
        </View>
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
    paddingHorizontal: 16,
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
  },
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    width: '100%',
    height: TRACK_HEIGHT,
  },
  fireAssembly: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  barStack: {
    position: 'relative',
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
  },
  shadowTail: {
    position: 'absolute',
    right: -6,
    top: 6,
    bottom: 4,
    width: '38%',
    backgroundColor: 'rgba(45, 27, 77, 0.55)',
    borderRadius: 4,
    zIndex: 0,
  },
  track: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 5,
    paddingVertical: 4,
    justifyContent: 'center',
    zIndex: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 3,
    elevation: 3,
  },
  trackGlow: {
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
    zIndex: 2,
  },
  segmentsRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'stretch',
    height: '100%',
    zIndex: 1,
  },
  segmentSlot: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 4,
  },
  segmentFill: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 4,
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.35)',
  },
  overflowBadge: {
    position: 'absolute',
    right: 6,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    zIndex: 3,
  },
  overflowText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FEE2E2',
  },
  intakeText: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 10,
    textAlign: 'center',
  },
});
