import { Image, StyleSheet, View } from 'react-native';

const FIRE_SOURCE = require('../assets/overheat/fire-3d.png');

interface OverheatFire3DProps {
  height: number;
}

/**
 * 3D fire icon from reference artwork (transparent PNG).
 * Sized to align with the segmented overheat bar track.
 */
export function OverheatFire3D({ height }: OverheatFire3DProps) {
  const width = Math.round(height * 0.88);

  return (
    <View style={[styles.wrap, { width, height }]}>
      <Image
        source={FIRE_SOURCE}
        style={{ width, height }}
        resizeMode="contain"
        accessibilityLabel="Daily overheat"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
});
