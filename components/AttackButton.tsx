import { useRef } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Defs, Ellipse, RadialGradient, Stop } from 'react-native-svg';

const BUTTON_SIZE = 88;
const INNER_SIZE = 68;

export interface AttackButtonProps {
  pendingHits: number;
  onPress: () => void;
  disabled?: boolean;
}

export function AttackButton({ pendingHits, onPress, disabled }: AttackButtonProps) {
  const enabled = !disabled && pendingHits > 0;
  const pressAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    if (!enabled) return;
    Animated.spring(pressAnim, {
      toValue: 0.92,
      useNativeDriver: true,
      speed: 50,
      bounciness: 0,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(pressAnim, {
      toValue: 1,
      useNativeDriver: true,
      speed: 40,
      bounciness: 6,
    }).start();
  };

  const counterLabel = `x${Math.max(0, pendingHits)}`;

  return (
    <View style={styles.row}>
      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={!enabled}
        accessibilityRole="button"
        accessibilityLabel={`Attack, ${pendingHits} pending hits`}
        accessibilityState={{ disabled: !enabled }}
      >
        <Animated.View style={[styles.buttonOuter, { transform: [{ scale: pressAnim }] }]}>
          {/* Metallic bezel */}
          <LinearGradient
            colors={
              enabled
                ? ['#F8FAFC', '#CBD5E1', '#94A3B8', '#64748B', '#94A3B8', '#E2E8F0']
                : ['#6B7280', '#4B5563', '#374151', '#4B5563', '#6B7280']
            }
            locations={[0, 0.15, 0.35, 0.55, 0.75, 1]}
            start={{ x: 0.1, y: 0 }}
            end={{ x: 0.9, y: 1 }}
            style={styles.bezel}
          >
            <View style={styles.bezelInner}>
              <View style={styles.redDomeWrap}>
                <Svg width={INNER_SIZE} height={INNER_SIZE} style={styles.domeSvg}>
                  <Defs>
                    <RadialGradient
                      id="attackDomeGrad"
                      cx="35%"
                      cy="28%"
                      rx="55%"
                      ry="55%"
                    >
                      <Stop offset="0" stopColor={enabled ? '#FF8A8A' : '#9CA3AF'} />
                      <Stop offset="0.35" stopColor={enabled ? '#EF4444' : '#6B7280'} />
                      <Stop offset="1" stopColor={enabled ? '#B91C1C' : '#4B5563'} />
                    </RadialGradient>
                  </Defs>
                  <Circle
                    cx={INNER_SIZE / 2}
                    cy={INNER_SIZE / 2}
                    r={INNER_SIZE / 2 - 2}
                    fill="url(#attackDomeGrad)"
                  />
                  {enabled ? (
                    <Ellipse
                      cx={INNER_SIZE * 0.38}
                      cy={INNER_SIZE * 0.28}
                      rx={INNER_SIZE * 0.22}
                      ry={INNER_SIZE * 0.12}
                      fill="#FFFFFF"
                      opacity={0.55}
                    />
                  ) : null}
                </Svg>
                <LinearGradient
                  colors={
                    enabled
                      ? ['rgba(255,255,255,0.15)', 'transparent']
                      : ['rgba(255,255,255,0.06)', 'transparent']
                  }
                  style={styles.domeSheen}
                  pointerEvents="none"
                />
                <View style={styles.labelWrap} pointerEvents="none">
                  <Text style={[styles.labelLine, !enabled && styles.labelDisabled]}>ATT</Text>
                  <Text style={[styles.labelLine, !enabled && styles.labelDisabled]}>ACK</Text>
                </View>
              </View>
            </View>
          </LinearGradient>
          <View style={[styles.dropShadow, !enabled && styles.dropShadowDisabled]} />
        </Animated.View>
      </Pressable>

      <Text
        style={[
          styles.counter,
          enabled ? styles.counterActive : styles.counterDisabled,
        ]}
      >
        {counterLabel}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    marginTop: 0,
    marginBottom: 16,
  },
  buttonOuter: {
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bezel: {
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    borderRadius: BUTTON_SIZE / 2,
    padding: 5,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 8,
  },
  bezelInner: {
    flex: 1,
    width: '100%',
    borderRadius: (BUTTON_SIZE - 10) / 2,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 4,
  },
  redDomeWrap: {
    width: INNER_SIZE,
    height: INNER_SIZE,
    borderRadius: INNER_SIZE / 2,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.25)',
  },
  domeSvg: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  domeSheen: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: INNER_SIZE / 2,
  },
  labelWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  labelLine: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.8,
    lineHeight: 15,
    textShadowColor: 'rgba(0,0,0,0.45)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  labelDisabled: {
    color: '#D1D5DB',
    textShadowColor: 'transparent',
  },
  dropShadow: {
    position: 'absolute',
    bottom: -3,
    right: -2,
    width: BUTTON_SIZE - 8,
    height: BUTTON_SIZE - 8,
    borderRadius: (BUTTON_SIZE - 8) / 2,
    backgroundColor: 'rgba(0,0,0,0.28)',
    zIndex: -1,
  },
  dropShadowDisabled: {
    backgroundColor: 'rgba(0,0,0,0.15)',
  },
  counter: {
    fontSize: 28,
    fontWeight: '800',
    minWidth: 44,
  },
  counterActive: {
    color: '#FBBF24',
  },
  counterDisabled: {
    color: '#6B7280',
  },
});
