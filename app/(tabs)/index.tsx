import { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
} from 'react-native';
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import { Camera, FlipHorizontal, Zap } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '@/lib/supabase';

export default function ScanScreen() {
  const [facing, setFacing] = useState<CameraType>('back');
  const [permission, requestPermission] = useCameraPermissions();
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cameraRef = useRef<CameraView>(null);
  const capturedImageRef = useRef<string | null>(null);
  const router = useRouter();

  const analyzeImage = async (base64: string) => {
    setError(null);
    try {
      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
      const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

      const response = await fetch(`${supabaseUrl}/functions/v1/analyze-food`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${anonKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ imageBase64: base64 }),
      });

      const data = await response.json();

      if (!response.ok || data.error) {
        throw new Error(data.error ?? 'Analysis failed');
      }

      const sessionId = `session_${Date.now()}`;
      const { error: dbError } = await supabase.from('meals').insert({
        user_session_id: sessionId,
        name: data.name,
        calories: Math.round(data.calories),
        protein_g: data.protein_g,
        carbs_g: data.carbs_g,
        fat_g: data.fat_g,
        serving_size: data.serving_size,
        meal_type: 'snack',
        notes: data.notes,
        image_url: capturedImageRef.current ?? '',
        logged_at: new Date().toISOString(),
      });

      if (dbError) {
        console.warn('DB save error:', dbError.message);
      }

      router.push({
        pathname: '/result',
        params: {
          name: data.name,
          calories: String(Math.round(data.calories)),
          protein: String(data.protein_g ?? 0),
          carbs: String(data.carbs_g ?? 0),
          fat: String(data.fat_g ?? 0),
          serving: data.serving_size ?? '',
          notes: data.notes ?? '',
          ingredients: JSON.stringify(data.ingredients ?? []),
          confidence: data.confidence ?? 'medium',
          imageUri: capturedImageRef.current ?? '',
        },
      });
    } catch (err: any) {
      setError(err.message ?? 'Something went wrong. Please try again.');
      setCapturedImage(null);
      capturedImageRef.current = null;
    } finally {
      setAnalyzing(false);
    }
  };

  const takePicture = useCallback(async () => {
    if (!cameraRef.current) return;
    setError(null);
    try {
      const photo = await cameraRef.current.takePictureAsync({ base64: true, quality: 0.7 });
      if (photo) {
        capturedImageRef.current = photo.uri;
        setCapturedImage(photo.uri);
        setAnalyzing(true);
        await analyzeImage(photo.base64 ?? '');
      }
    } catch {
      setError('Failed to capture photo. Please try again.');
      setAnalyzing(false);
    }
  }, []);

  if (!permission) {
    return (
      <View style={styles.container}>
        <ActivityIndicator color="#22C55E" size="large" />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <LinearGradient colors={['#0F172A', '#111827']} style={styles.container}>
        <View style={styles.permissionBox}>
          <Camera color="#22C55E" size={56} />
          <Text style={styles.permissionTitle}>Camera Access Needed</Text>
          <Text style={styles.permissionText}>
            Allow camera access to snap your food and get instant calorie counts.
          </Text>
          <TouchableOpacity style={styles.permissionBtn} onPress={requestPermission}>
            <Text style={styles.permissionBtnText}>Allow Camera</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    );
  }

  if (analyzing && capturedImage) {
    return (
      <View style={styles.container}>
        <Image source={{ uri: capturedImage }} style={styles.analyzingImage} />
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.85)']}
          style={styles.analyzingOverlay}
        >
          <ActivityIndicator color="#22C55E" size="large" />
          <Text style={styles.analyzingText}>Analyzing your food...</Text>
          <Text style={styles.analyzingSubtext}>Calculating calories & nutrients</Text>
        </LinearGradient>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView ref={cameraRef} style={styles.camera} facing={facing}>
        <LinearGradient
          colors={['rgba(0,0,0,0.5)', 'transparent', 'transparent', 'rgba(0,0,0,0.6)']}
          style={styles.cameraOverlay}
        >
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Food Scanner</Text>
            <Text style={styles.headerSub}>Point at your meal</Text>
          </View>

          <View style={styles.frameContainer}>
            <View style={styles.frameTL} />
            <View style={styles.frameTR} />
            <View style={styles.frameBL} />
            <View style={styles.frameBR} />
          </View>

          <View style={styles.controls}>
            {error && (
              <View style={styles.errorBanner}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}
            <View style={styles.controlRow}>
              <TouchableOpacity
                style={styles.flipBtn}
                onPress={() => setFacing((f) => (f === 'back' ? 'front' : 'back'))}
              >
                <FlipHorizontal color="#FFFFFF" size={22} />
              </TouchableOpacity>

              <TouchableOpacity style={styles.captureBtn} onPress={takePicture}>
                <Zap color="#111827" size={28} fill="#111827" />
              </TouchableOpacity>

              <View style={styles.flipBtn} />
            </View>
            <Text style={styles.hint}>Tap to scan your food</Text>
          </View>
        </LinearGradient>
      </CameraView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  camera: {
    flex: 1,
  },
  cameraOverlay: {
    flex: 1,
    justifyContent: 'space-between',
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  headerSub: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 13,
    marginTop: 4,
  },
  frameContainer: {
    width: 260,
    height: 260,
    alignSelf: 'center',
  },
  frameTL: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 40,
    height: 40,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderColor: '#22C55E',
    borderTopLeftRadius: 8,
  },
  frameTR: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 40,
    height: 40,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderColor: '#22C55E',
    borderTopRightRadius: 8,
  },
  frameBL: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    width: 40,
    height: 40,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderColor: '#22C55E',
    borderBottomLeftRadius: 8,
  },
  frameBR: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 40,
    height: 40,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderColor: '#22C55E',
    borderBottomRightRadius: 8,
  },
  controls: {
    paddingBottom: 40,
    alignItems: 'center',
  },
  controlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 32,
    marginBottom: 12,
  },
  flipBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  captureBtn: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#22C55E',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#22C55E',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 16,
    elevation: 8,
  },
  hint: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
    letterSpacing: 0.5,
  },
  errorBanner: {
    backgroundColor: 'rgba(239,68,68,0.85)',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginBottom: 16,
    marginHorizontal: 24,
  },
  errorText: {
    color: '#FFFFFF',
    fontSize: 13,
    textAlign: 'center',
  },
  analyzingImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  analyzingOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 100,
    gap: 12,
  },
  analyzingText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
  },
  analyzingSubtext: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
  },
  permissionBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    gap: 16,
  },
  permissionTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 8,
  },
  permissionText: {
    color: '#9CA3AF',
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
  permissionBtn: {
    backgroundColor: '#22C55E',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 8,
  },
  permissionBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
