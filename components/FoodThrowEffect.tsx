import { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';

const FOOD_SIZE = 88;
const MEAT_EMOJI = '🍖';
/** Throw flight time — keep munch delay in BattleMonsterSprite roughly in sync (~75%). */
export const FOOD_THROW_DURATION_MS = 820;

/** Visual-only: meat-on-bone arcs toward the monster mouth on each feed pulse. */
export function FoodThrowEffect({ pulse }: { pulse: number }) {
  const fly = useRef(new Animated.Value(0)).current;
  const spin = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (pulse === 0) return;

    fly.setValue(0);
    spin.setValue(0);

    Animated.parallel([
      Animated.timing(fly, {
        toValue: 1,
        duration: FOOD_THROW_DURATION_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(spin, {
        toValue: 1,
        duration: FOOD_THROW_DURATION_MS,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    ]).start();
  }, [pulse, fly, spin]);

  const translateX = useMemo(
    () =>
      fly.interpolate({
        inputRange: [0, 0.45, 1],
        outputRange: [52, 8, 0],
      }),
    [fly]
  );

  const translateY = useMemo(
    () =>
      fly.interpolate({
        inputRange: [0, 0.45, 1],
        outputRange: [92, 12, -8],
      }),
    [fly]
  );

  const foodScale = useMemo(
    () =>
      fly.interpolate({
        inputRange: [0, 0.55, 0.82, 1],
        outputRange: [0.9, 1, 0.6, 0],
      }),
    [fly]
  );

  const opacity = useMemo(
    () =>
      fly.interpolate({
        inputRange: [0, 0.1, 0.85, 1],
        outputRange: [0, 1, 1, 0],
      }),
    [fly]
  );

  const rotate = useMemo(
    () =>
      spin.interpolate({
        inputRange: [0, 1],
        outputRange: ['-35deg', '25deg'],
      }),
    [spin]
  );

  if (pulse === 0) return null;

  return (
    <View style={styles.layer} pointerEvents="none">
      <Animated.View
        style={[
          styles.projectile,
          {
            opacity,
            transform: [{ translateX }, { translateY }, { rotate }, { scale: foodScale }],
          },
        ]}
      >
        <Text style={styles.meatEmoji}>{MEAT_EMOJI}</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  layer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  projectile: {
    position: 'absolute',
    width: FOOD_SIZE,
    height: FOOD_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 6,
  },
  meatEmoji: {
    fontSize: 76,
    lineHeight: 88,
    textAlign: 'center',
    includeFontPadding: false,
  },
});
