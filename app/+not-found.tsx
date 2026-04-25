import { Stack, router } from 'expo-router';
import { StyleSheet, Text, View, Pressable, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useColors } from '@/lib/theme-context';
import type { lightColors } from '@/constants/colors';

export default function NotFoundScreen() {
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const styles = createStyles(colors);

  const handleGoHome = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.replace('/');
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.screen, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <Animated.View entering={FadeInDown.duration(400)} style={styles.content}>
          <View style={styles.iconCircle}>
            <Ionicons name="compass-outline" size={48} color={colors.primary} />
          </View>
          <Text style={styles.title}>Page not found</Text>
          <Text style={styles.subtitle}>
            We couldn&apos;t find the screen you&apos;re looking for. Let&apos;s get you back on track.
          </Text>
          <Pressable
            onPress={handleGoHome}
            style={({ pressed }) => [styles.button, pressed && { opacity: 0.85 }]}
            testID="not-found-home-button"
          >
            <Ionicons name="home-outline" size={18} color="#FFFFFF" />
            <Text style={styles.buttonText}>Go to home</Text>
          </Pressable>
        </Animated.View>
      </View>
    </>
  );
}

const createStyles = (colors: typeof lightColors) =>
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: colors.background,
    },
    content: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 32,
      gap: 16,
    },
    iconCircle: {
      width: 88,
      height: 88,
      borderRadius: 44,
      backgroundColor: colors.primary + '18',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 8,
    },
    title: {
      fontSize: 22,
      fontFamily: 'Inter_600SemiBold',
      color: colors.text,
      textAlign: 'center',
    },
    subtitle: {
      fontSize: 15,
      fontFamily: 'Inter_400Regular',
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 22,
      maxWidth: 320,
    },
    button: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: colors.primary,
      paddingHorizontal: 24,
      paddingVertical: 14,
      borderRadius: 16,
      marginTop: 12,
      ...Platform.select({
        ios: {
          shadowColor: colors.primary,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.2,
          shadowRadius: 8,
        },
        android: { elevation: 3 },
      }),
    },
    buttonText: {
      color: '#FFFFFF',
      fontSize: 15,
      fontFamily: 'Inter_600SemiBold',
    },
  });
