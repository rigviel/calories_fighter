import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, { Circle, Ellipse, Path, Rect } from 'react-native-svg';
import type { OverheatState } from '@/lib/overheat';
import { FOOD_THROW_DURATION_MS } from '@/components/FoodThrowEffect';

const SPRITE_SIZE = 120;
const PATROL_RANGE = 26;

type EmotionStyle = {
  body: string;
  belly: string;
  cheek: string;
  eye: string;
  mouth: string;
  leftEye: { cx: number; cy: number; type: 'dot' | 'worry' | 'spiral' };
  rightEye: { cx: number; cy: number; type: 'dot' | 'worry' | 'spiral' };
  mouthPath: string;
};

const EMOTION_BY_STATE: Record<OverheatState, EmotionStyle> = {
  cool: {
    body: '#4ADE80',
    belly: '#BBF7D0',
    cheek: '#86EFAC',
    eye: '#0F172A',
    mouth: '#166534',
    leftEye: { cx: 44, cy: 46, type: 'dot' },
    rightEye: { cx: 76, cy: 46, type: 'dot' },
    mouthPath: 'M 48 62 Q 60 70 72 62',
  },
  warm: {
    body: '#FBBF24',
    belly: '#FEF3C7',
    cheek: '#FDE68A',
    eye: '#0F172A',
    mouth: '#92400E',
    leftEye: { cx: 44, cy: 47, type: 'dot' },
    rightEye: { cx: 76, cy: 47, type: 'dot' },
    mouthPath: 'M 50 64 L 70 64',
  },
  hot: {
    body: '#FB923C',
    belly: '#FFEDD5',
    cheek: '#FDBA74',
    eye: '#0F172A',
    mouth: '#9A3412',
    leftEye: { cx: 42, cy: 44, type: 'worry' },
    rightEye: { cx: 78, cy: 44, type: 'worry' },
    mouthPath: 'M 52 66 Q 60 60 68 66',
  },
  overheat: {
    body: '#EF4444',
    belly: '#FECACA',
    cheek: '#FCA5A5',
    eye: '#7F1D1D',
    mouth: '#7F1D1D',
    leftEye: { cx: 44, cy: 46, type: 'spiral' },
    rightEye: { cx: 76, cy: 46, type: 'spiral' },
    mouthPath: 'M 48 64 Q 60 74 72 64 Q 60 68 48 64',
  },
};

function Eye({
  cx,
  cy,
  type,
  color,
}: {
  cx: number;
  cy: number;
  type: EmotionStyle['leftEye']['type'];
  color: string;
}) {
  if (type === 'dot') {
    return <Circle cx={cx} cy={cy} r={5} fill={color} />;
  }
  if (type === 'worry') {
    return (
      <>
        <Ellipse cx={cx} cy={cy} rx={6} ry={7} fill="#FFFFFF" />
        <Circle cx={cx} cy={cy + 1} r={3.5} fill={color} />
      </>
    );
  }
  return (
    <>
      <Circle cx={cx} cy={cy} r={7} fill="#FFFFFF" />
      <Path
        d={`M ${cx - 4} ${cy - 2} Q ${cx} ${cy + 5} ${cx + 4} ${cy - 2} Q ${cx} ${cy - 6} ${cx - 4} ${cy - 2}`}
        fill={color}
      />
    </>
  );
}

export function BattleMonsterSprite({
  state,
  feedPulse = 0,
}: {
  state: OverheatState;
  feedPulse?: number;
}) {
  const patrolX = useRef(new Animated.Value(0)).current;
  const facing = useRef(new Animated.Value(1)).current;
  const breathAnim = useRef(new Animated.Value(0)).current;
  const hopAnim = useRef(new Animated.Value(0)).current;
  const chompAnim = useRef(new Animated.Value(0)).current;
  const [isMunching, setIsMunching] = useState(false);

  const look = EMOTION_BY_STATE[state];

  useEffect(() => {
    if (feedPulse === 0) return;

    setIsMunching(true);
    chompAnim.setValue(0);

    const munch = Animated.sequence([
      Animated.timing(chompAnim, { toValue: 1, duration: 90, useNativeDriver: true }),
      Animated.timing(chompAnim, { toValue: 0, duration: 90, useNativeDriver: true }),
      Animated.timing(chompAnim, { toValue: 1, duration: 90, useNativeDriver: true }),
      Animated.timing(chompAnim, { toValue: 0, duration: 90, useNativeDriver: true }),
      Animated.timing(chompAnim, { toValue: 1, duration: 90, useNativeDriver: true }),
      Animated.timing(chompAnim, { toValue: 0, duration: 90, useNativeDriver: true }),
    ]);

    const startTimer = setTimeout(() => {
      munch.start(({ finished }) => {
        if (finished) setIsMunching(false);
      });
    }, Math.round(FOOD_THROW_DURATION_MS * 0.78));

    return () => {
      clearTimeout(startTimer);
      munch.stop();
      chompAnim.setValue(0);
      setIsMunching(false);
    };
  }, [feedPulse, chompAnim]);

  useEffect(() => {
    const hopLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(hopAnim, { toValue: 1, duration: 260, useNativeDriver: true }),
        Animated.timing(hopAnim, { toValue: 0, duration: 260, useNativeDriver: true }),
      ])
    );

    const walkLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(facing, { toValue: 1, duration: 1, useNativeDriver: true }),
        Animated.timing(patrolX, {
          toValue: 1,
          duration: 2200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(facing, { toValue: -1, duration: 1, useNativeDriver: true }),
        Animated.timing(patrolX, {
          toValue: 0,
          duration: 2200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );

    const breathLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(breathAnim, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(breathAnim, {
          toValue: 0,
          duration: 900,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );

    hopLoop.start();
    walkLoop.start();
    breathLoop.start();
    return () => {
      hopLoop.stop();
      walkLoop.stop();
      breathLoop.stop();
    };
  }, [patrolX, facing, breathAnim, hopAnim]);

  const translateX = useMemo(
    () =>
      patrolX.interpolate({
        inputRange: [0, 1],
        outputRange: [-PATROL_RANGE, PATROL_RANGE],
      }),
    [patrolX]
  );

  const translateY = useMemo(
    () =>
      hopAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [0, -5],
      }),
    [hopAnim]
  );

  const breathScale = useMemo(
    () =>
      breathAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [1, 1.04],
      }),
    [breathAnim]
  );

  const chompScaleY = useMemo(
    () =>
      chompAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [1, 0.9],
      }),
    [chompAnim]
  );

  const chompScaleX = useMemo(
    () =>
      chompAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [1, 1.08],
      }),
    [chompAnim]
  );

  const facingScaleX = useMemo(
    () =>
      facing.interpolate({
        inputRange: [-1, 1],
        outputRange: [-1, 1],
      }),
    [facing]
  );

  const combinedScaleX = useMemo(
    () => Animated.multiply(facingScaleX, chompScaleX),
    [facingScaleX, chompScaleX]
  );

  const combinedScaleY = useMemo(
    () => Animated.multiply(breathScale, chompScaleY),
    [breathScale, chompScaleY]
  );

  return (
    <View style={styles.stage}>
      <Animated.View
        style={[
          styles.spriteWrap,
          {
            transform: [
              { translateX },
              { translateY },
              { scaleX: combinedScaleX },
              { scaleY: combinedScaleY },
            ],
          },
        ]}
      >
        <Svg width={SPRITE_SIZE} height={SPRITE_SIZE} viewBox="0 0 120 120">
          <Ellipse cx={60} cy={108} rx={28} ry={6} fill="rgba(0,0,0,0.25)" />
          <Ellipse cx={60} cy={72} rx={34} ry={30} fill={look.body} />
          <Ellipse cx={60} cy={78} rx={22} ry={18} fill={look.belly} />
          <Circle cx={34} cy={68} r={6} fill={look.cheek} opacity={0.7} />
          <Circle cx={86} cy={68} r={6} fill={look.cheek} opacity={0.7} />
          <Ellipse cx={60} cy={38} rx={30} ry={26} fill={look.body} />
          <Rect x={46} y={30} width={10} height={8} rx={3} fill={look.body} />
          <Rect x={64} y={30} width={10} height={8} rx={3} fill={look.body} />
          <Eye cx={look.leftEye.cx} cy={look.leftEye.cy} type={look.leftEye.type} color={look.eye} />
          <Eye cx={look.rightEye.cx} cy={look.rightEye.cy} type={look.rightEye.type} color={look.eye} />
          {isMunching ? (
            <>
              <Ellipse cx={60} cy={66} rx={14} ry={9} fill="#1F2937" />
              <Ellipse cx={60} cy={64} rx={11} ry={6} fill="#FFFFFF" opacity={0.9} />
            </>
          ) : (
            <Path d={look.mouthPath} stroke={look.mouth} strokeWidth={3} fill="none" strokeLinecap="round" />
          )}
          {state === 'hot' ? (
            <Path d="M 92 32 Q 96 38 92 44" stroke="#38BDF8" strokeWidth={2} fill="none" />
          ) : null}
          {state === 'overheat' ? (
            <>
              <Path d="M 18 28 L 24 22 M 24 28 L 18 22" stroke="#FDE68A" strokeWidth={2} />
              <Path d="M 96 24 L 102 18 M 102 24 L 96 18" stroke="#FDE68A" strokeWidth={2} />
            </>
          ) : null}
          <Ellipse cx={46} cy={98} rx={10} ry={6} fill={look.body} />
          <Ellipse cx={74} cy={98} rx={10} ry={6} fill={look.body} />
        </Svg>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  stage: {
    width: SPRITE_SIZE + PATROL_RANGE * 2,
    height: SPRITE_SIZE + 8,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  spriteWrap: {
    width: SPRITE_SIZE,
    height: SPRITE_SIZE,
  },
});
