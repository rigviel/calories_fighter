import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Image, StyleSheet, View } from 'react-native';
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

function CuteSkullEye({ cx, cy }: { cx: number; cy: number }) {
  // Droopy rounded eye blob (matches the reference skull).
  return (
    <Path
      d={[
        `M ${cx - 11} ${cy - 6}`,
        `C ${cx - 14} ${cy - 1} ${cx - 12} ${cy + 8} ${cx - 4} ${cy + 10}`,
        `C ${cx + 2} ${cy + 12} ${cx + 10} ${cy + 9} ${cx + 12} ${cy + 2}`,
        `C ${cx + 14} ${cy - 6} ${cx + 8} ${cy - 12} ${cx} ${cy - 11}`,
        `C ${cx - 6} ${cy - 10} ${cx - 9} ${cy - 9} ${cx - 11} ${cy - 6}`,
        'Z',
      ].join(' ')}
      fill="#0B1220"
    />
  );
}

export function BattleMonsterSprite({
  state,
  feedPulse = 0,
  hitPulse = 0,
  defeated = false,
  defeatedStyle = 'cute',
}: {
  state: OverheatState;
  feedPulse?: number;
  /** Increment to play a brief damage recoil (boss hit). */
  hitPulse?: number;
  defeated?: boolean;
  defeatedStyle?: 'image' | 'cute' | 'classic';
}) {
  const patrolX = useRef(new Animated.Value(0)).current;
  const facing = useRef(new Animated.Value(1)).current;
  const breathAnim = useRef(new Animated.Value(0)).current;
  const hopAnim = useRef(new Animated.Value(0)).current;
  const chompAnim = useRef(new Animated.Value(0)).current;
  const hitRecoil = useRef(new Animated.Value(0)).current;
  const defeatedBob = useRef(new Animated.Value(0)).current;
  const [isMunching, setIsMunching] = useState(false);

  const look = EMOTION_BY_STATE[state];

  useEffect(() => {
    if (defeated) return;
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
  }, [feedPulse, chompAnim, defeated]);

  useEffect(() => {
    if (defeated) return;
    if (hitPulse === 0) return;

    hitRecoil.setValue(0);
    const recoil = Animated.sequence([
      Animated.timing(hitRecoil, { toValue: 1, duration: 70, useNativeDriver: true }),
      Animated.spring(hitRecoil, {
        toValue: 0,
        useNativeDriver: true,
        speed: 28,
        bounciness: 10,
      }),
    ]);
    recoil.start();
    return () => {
      recoil.stop();
      hitRecoil.setValue(0);
    };
  }, [hitPulse, hitRecoil, defeated]);

  useEffect(() => {
    if (!defeated || defeatedStyle !== 'image') {
      defeatedBob.stopAnimation();
      defeatedBob.setValue(0);
      return;
    }

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(defeatedBob, {
          toValue: 1,
          duration: 620,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(defeatedBob, {
          toValue: 0,
          duration: 620,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );

    loop.start();
    return () => loop.stop();
  }, [defeated, defeatedStyle, defeatedBob]);

  useEffect(() => {
    if (defeated) {
      patrolX.stopAnimation();
      facing.stopAnimation();
      breathAnim.stopAnimation();
      hopAnim.stopAnimation();
      patrolX.setValue(0);
      facing.setValue(1);
      breathAnim.setValue(0);
      hopAnim.setValue(0);
      chompAnim.setValue(0);
      setIsMunching(false);
      return;
    }
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
  }, [patrolX, facing, breathAnim, hopAnim, chompAnim, defeated]);

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

  const hitScale = useMemo(
    () =>
      hitRecoil.interpolate({
        inputRange: [0, 1],
        outputRange: [1, 0.88],
      }),
    [hitRecoil]
  );

  const hitKnockback = useMemo(
    () =>
      hitRecoil.interpolate({
        inputRange: [0, 1],
        outputRange: [0, 8],
      }),
    [hitRecoil]
  );

  const combinedScaleX = useMemo(
    () => Animated.multiply(Animated.multiply(facingScaleX, chompScaleX), hitScale),
    [facingScaleX, chompScaleX, hitScale]
  );

  const combinedScaleY = useMemo(
    () => Animated.multiply(Animated.multiply(breathScale, chompScaleY), hitScale),
    [breathScale, chompScaleY, hitScale]
  );

  const defeatedLook = useMemo(() => {
    if (!defeated) return null;
    return {
      skullFill: '#F8FAFC',
      skullStroke: '#0B1220',
      shadow: 'rgba(0,0,0,0.30)',
      eye: '#0B1220',
    };
  }, [defeated]);

  if (defeated && defeatedStyle === 'image') {
    const bobTranslateY = defeatedBob.interpolate({
      inputRange: [0, 1],
      outputRange: [0, -7],
    });
    return (
      <View style={styles.stage}>
        <Animated.View style={[styles.spriteWrap, { transform: [{ translateY: bobTranslateY }] }]}>
          <Svg width={SPRITE_SIZE} height={SPRITE_SIZE} viewBox="0 0 120 120">
            <Ellipse cx={60} cy={110} rx={26} ry={6} fill="rgba(0,0,0,0.30)" />
          </Svg>
          <Image
            source={require('../assets/monster/defeated-skull.v6.png')}
            style={styles.defeatedImage}
            resizeMode="contain"
          />
        </Animated.View>
      </View>
    );
  }

  return (
    <View style={styles.stage}>
      <Animated.View
        style={[
          styles.spriteWrap,
          {
            transform: [
              { translateX: defeated ? 0 : translateX },
              {
                translateY: defeated
                  ? 0
                  : Animated.add(translateY, hitKnockback),
              },
              { scaleX: defeated ? 1 : combinedScaleX },
              { scaleY: defeated ? 1 : combinedScaleY },
            ],
          },
        ]}
      >
        <Svg width={SPRITE_SIZE} height={SPRITE_SIZE} viewBox="0 0 120 120">
          {defeated && defeatedLook ? (
            <>
              {defeatedStyle === 'cute' ? (
                <>
                  {/* Transparent background: no Rect fill */}
                  <Ellipse cx={60} cy={110} rx={26} ry={6} fill={defeatedLook.shadow} />

                  {/* Cute skull silhouette (closer to reference) */}
                  <Path
                    d={[
                      'M 26 54',
                      'C 26 34 42 20 60 20',
                      'C 78 20 94 34 94 54',
                      'C 94 70 84 80 72 84',
                      // Jaw bumps (scallops)
                      'C 71 92 68 100 60 102',
                      'C 52 100 49 92 48 84',
                      'C 36 80 26 70 26 54',
                      'Z',
                    ].join(' ')}
                    fill={defeatedLook.skullFill}
                    stroke={defeatedLook.skullStroke}
                    strokeWidth={5}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                  />

                  {/* Bottom scallops (like the cute skull jaw) */}
                  <Path
                    d="M 36 82 C 40 86 46 86 50 82 C 54 88 58 88 60 86 C 62 88 66 88 70 82 C 74 86 80 86 84 82"
                    fill="none"
                    stroke={defeatedLook.skullStroke}
                    strokeWidth={5}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />

                  {/* Eyes: droopy blobs */}
                  <CuteSkullEye cx={46} cy={56} />
                  <CuteSkullEye cx={74} cy={56} />

                  {/* Tiny nose */}
                  <Path
                    d="M 60 66 C 57 69 58 74 60 75 C 62 74 63 69 60 66 Z"
                    fill={defeatedLook.eye}
                    opacity={0.92}
                  />
                </>
              ) : (
                <>
                  {/* Transparent background: no Rect fill */}
                  <Ellipse cx={60} cy={110} rx={26} ry={6} fill={defeatedLook.shadow} />
                  {/* Classic skull */}
                  <Path
                    d="M 34 54
                       C 34 40 45 30 60 30
                       C 75 30 86 40 86 54
                       C 86 67 79 72 74 74
                       C 73 76 73 79 73 82
                       C 73 90 67 96 60 96
                       C 53 96 47 90 47 82
                       C 47 79 47 76 46 74
                       C 41 72 34 67 34 54 Z"
                    fill={defeatedLook.skullFill}
                    stroke={defeatedLook.skullStroke}
                    strokeWidth={3}
                    strokeLinejoin="round"
                  />
                  {/* Eye sockets */}
                  <Circle cx={49} cy={56} r={11} fill={defeatedLook.skullStroke} opacity={0.92} />
                  <Circle cx={71} cy={56} r={11} fill={defeatedLook.skullStroke} opacity={0.92} />
                  {/* Nose */}
                  <Path
                    d="M 60 62
                       C 56 66 56 72 60 74
                       C 64 72 64 66 60 62 Z"
                    fill={defeatedLook.skullStroke}
                    opacity={0.9}
                  />
                  {/* Teeth */}
                  <Path
                    d="M 49 84 H 71"
                    stroke={defeatedLook.skullStroke}
                    strokeWidth={3}
                    strokeLinecap="round"
                    opacity={0.85}
                  />
                  <Path
                    d="M 53 84 V 92 M 60 84 V 92 M 67 84 V 92"
                    stroke={defeatedLook.skullStroke}
                    strokeWidth={2.5}
                    strokeLinecap="round"
                    opacity={0.85}
                  />
                  {/* Cracks */}
                  <Path
                    d="M 60 30 L 58 40 L 64 46 L 61 52"
                    stroke={defeatedLook.skullStroke}
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    opacity={0.7}
                  />
                  <Path
                    d="M 74 42 L 78 48 L 74 54"
                    stroke={defeatedLook.skullStroke}
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    opacity={0.65}
                  />
                </>
              )}
            </>
          ) : (
            <>
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
                <Path
                  d={look.mouthPath}
                  stroke={look.mouth}
                  strokeWidth={3}
                  fill="none"
                  strokeLinecap="round"
                />
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
            </>
          )}
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
  defeatedImage: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: SPRITE_SIZE,
    height: SPRITE_SIZE,
  },
});
