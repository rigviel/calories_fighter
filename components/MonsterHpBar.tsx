import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, {
  Circle,
  Defs,
  Ellipse,
  G,
  LinearGradient as SvgGradient,
  Path,
  RadialGradient,
  Stop,
} from 'react-native-svg';

const TEAL_TOP = '#6FF9E8';
const TEAL_MID = '#2EE8D6';
const TEAL_BOTTOM = '#00B4A0';

const SEGMENT_GAP = 3;
const DEFAULT_SEGMENTS = 10;
const COMPACT_SEGMENTS = 8;

interface MonsterHpBarProps {
  currentHp: number;
  initialHp: number;
  variant?: 'default' | 'compact';
  showLabel?: boolean;
}

function filledSegmentCount(currentHp: number, initialHp: number, total: number): number {
  if (initialHp <= 0 || total <= 0) return 0;
  const ratio = Math.max(0, Math.min(1, currentHp / initialHp));
  return Math.round(ratio * total);
}

/** 3D heart icon (no pedestal) */
function HpBarHeart3D({ compact, height }: { compact: boolean; height: number }) {
  const width = compact ? Math.round(height * 1.05) : Math.round(height * 1.08);
  const id = compact ? 'hpHeartC' : 'hpHeart';

  return (
    <Svg
      width={width}
      height={height}
      viewBox="6 5 44 36"
      preserveAspectRatio="xMidYMid meet"
    >
      <Defs>
        <SvgGradient id={`${id}Body`} x1="0.35" y1="0" x2="0.65" y2="1">
          <Stop offset="0" stopColor="#B8FFF8" />
          <Stop offset="0.35" stopColor="#4AEFD8" />
          <Stop offset="0.72" stopColor="#1AD4BE" />
          <Stop offset="1" stopColor="#009E8C" />
        </SvgGradient>
        <SvgGradient id={`${id}Rim`} x1="0" y1="0.5" x2="1" y2="1">
          <Stop offset="0" stopColor="#00A896" stopOpacity="0" />
          <Stop offset="0.55" stopColor="#007A6E" stopOpacity="0.35" />
          <Stop offset="1" stopColor="#005C52" stopOpacity="0.65" />
        </SvgGradient>
        <RadialGradient id={`${id}Gloss`} cx="0.32" cy="0.28" rx="0.42" ry="0.38">
          <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.95" />
          <Stop offset="0.45" stopColor="#FFFFFF" stopOpacity="0.25" />
          <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
        </RadialGradient>
      </Defs>

      <G transform="translate(27 22) rotate(-10) translate(-27 -20)">
        {/* Extruded depth (bottom-right) */}
        <Path
          d="M27 36 C27 36 9 27 9 17.5 C9 12.2 14.2 8 19.5 8 C23.2 8 25.8 10.2 27 13.5 C28.2 10.2 30.8 8 34.5 8 C39.8 8 45 12.2 45 17.5 C45 27 27 36 27 36 Z"
          fill="#00796C"
          transform="translate(2.2 2.6)"
        />
        {/* Main heart body */}
        <Path
          d="M27 36 C27 36 9 27 9 17.5 C9 12.2 14.2 8 19.5 8 C23.2 8 25.8 10.2 27 13.5 C28.2 10.2 30.8 8 34.5 8 C39.8 8 45 12.2 45 17.5 C45 27 27 36 27 36 Z"
          fill={`url(#${id}Body)`}
        />
        {/* Bottom-right shading for 3D thickness */}
        <Path
          d="M27 36 C27 36 9 27 9 17.5 C9 12.2 14.2 8 19.5 8 C23.2 8 25.8 10.2 27 13.5 C28.2 10.2 30.8 8 34.5 8 C39.8 8 45 12.2 45 17.5 C45 27 27 36 27 36 Z"
          fill={`url(#${id}Rim)`}
        />
        {/* Soft gloss wash */}
        <Ellipse cx="20" cy="14" rx="14" ry="11" fill={`url(#${id}Gloss)`} />
        {/* Specular highlight — upper-left lobe */}
        <Circle cx="18.5" cy="13.5" r="4.2" fill="#FFFFFF" opacity={0.92} />
        <Circle cx="20.5" cy="12" r="1.6" fill="#FFFFFF" opacity={0.55} />
        {/* Tiny secondary glint */}
        <Circle cx="33" cy="15" r="1.1" fill="#FFFFFF" opacity={0.35} />
      </G>
    </Svg>
  );
}

export function MonsterHpBar({
  currentHp,
  initialHp,
  variant = 'default',
  showLabel = true,
}: MonsterHpBarProps) {
  const compact = variant === 'compact';
  const segmentCount = compact ? COMPACT_SEGMENTS : DEFAULT_SEGMENTS;
  const filled = filledSegmentCount(currentHp, initialHp, segmentCount);
  const skewDeg = compact ? '-9deg' : '-11deg';
  const trackHeight = compact ? 24 : 32;

  return (
    <View style={styles.root}>
      <View style={[styles.barRow, { height: trackHeight }]}>
        <View style={[styles.heartAssembly, compact && styles.heartAssemblyCompact]}>
          <HpBarHeart3D compact={compact} height={trackHeight} />
        </View>

        <View style={[styles.barStack, { height: trackHeight }]}>
          <View
            style={[
              styles.shadowTail,
              compact && styles.shadowTailCompact,
              { transform: [{ skewX: skewDeg }] },
            ]}
          />
          <View
            style={[
              styles.track,
              compact && styles.trackCompact,
              { height: trackHeight, transform: [{ skewX: skewDeg }] },
            ]}
          >
            <View style={[styles.segmentsRow, compact && styles.segmentsRowCompact]}>
              {Array.from({ length: segmentCount }, (_, index) => {
                const isFilled = index < filled;
                return (
                  <View
                    key={index}
                    style={[
                      styles.segmentSlot,
                      compact && styles.segmentSlotCompact,
                      index > 0 && { marginLeft: SEGMENT_GAP },
                    ]}
                  >
                    {isFilled ? (
                      <LinearGradient
                        colors={[TEAL_TOP, TEAL_MID, TEAL_BOTTOM]}
                        locations={[0, 0.42, 1]}
                        style={[styles.segmentFill, compact && styles.segmentFillCompact]}
                      />
                    ) : null}
                  </View>
                );
              })}
            </View>
          </View>
        </View>
      </View>

      {showLabel ? (
        <Text style={[styles.label, compact && styles.labelCompact]}>
          {Math.round(currentHp).toLocaleString()} / {Math.round(initialHp).toLocaleString()} HP
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    width: '100%',
  },
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    width: '100%',
  },
  heartAssembly: {
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#0F172A',
    shadowOffset: { width: 1, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 5,
  },
  heartAssemblyCompact: {
    gap: 0,
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
  shadowTailCompact: {
    right: -4,
    top: 4,
    bottom: 3,
    width: '34%',
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 3,
    elevation: 3,
  },
  trackCompact: {
    borderRadius: 6,
    paddingHorizontal: 4,
    paddingVertical: 3,
  },
  segmentsRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'stretch',
    height: '100%',
  },
  segmentsRowCompact: {
    height: '100%',
  },
  segmentSlot: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 4,
    backgroundColor: 'transparent',
  },
  segmentSlotCompact: {
    borderRadius: 3,
  },
  segmentFill: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 4,
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.4)',
  },
  segmentFillCompact: {
    borderRadius: 3,
  },
  label: {
    width: '100%',
    marginTop: 10,
    fontSize: 14,
    color: '#D1D5DB',
    textAlign: 'center',
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  labelCompact: {
    marginTop: 6,
    fontSize: 11,
    color: '#9CA3AF',
  },
});
