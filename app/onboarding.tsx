import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
  AppState,
  type AppStateStatus,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useColors } from '@/lib/theme-context';
import type { ThemeColors } from '@/constants/colors';
import { hasNotificationAccess, openNotificationAccessSettings } from '@/lib/notification-listener';

/**
 * v2 onboarding — the ONE setup step. Explains the passive-tracking value,
 * then sends the user to Android's Notification Access screen. Once access is
 * granted (re-checked on return from Settings), it advances to the dashboard.
 * On web / non-Android, access isn't applicable, so it just shows "Continue".
 */
export default function OnboardingScreen() {
  const colors = useColors();
  const styles = createStyles(colors);
  const insets = useSafeAreaInsets();
  const isAndroid = Platform.OS === 'android';

  const [hasAccess, setHasAccess] = useState(false);
  const appState = useRef(AppState.currentState);

  const refresh = useCallback(async () => {
    setHasAccess(await hasNotificationAccess());
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Re-check when the user comes back from the Android Settings screen.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (appState.current.match(/inactive|background/) && next === 'active') refresh();
      appState.current = next;
    });
    return () => sub.remove();
  }, [refresh]);

  const goToApp = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.replace('/dashboard' as any);
  }, []);

  const grant = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await openNotificationAccessSettings();
  }, []);

  const ready = hasAccess || !isAndroid;

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeInDown.delay(80).duration(500)} style={styles.heroIcon}>
          <Ionicons name="sparkles" size={34} color={colors.primary} />
        </Animated.View>

        <Animated.Text entering={FadeInDown.delay(160).duration(500)} style={styles.title}>
          Tracking that{'\n'}does itself
        </Animated.Text>
        <Animated.Text entering={FadeInDown.delay(240).duration(500)} style={styles.subtitle}>
          Hisaabit reads your bank &amp; wallet notifications and logs every expense for you. No typing. Ever.
        </Animated.Text>

        <Animated.View entering={FadeInDown.delay(340).duration(500)} style={styles.points}>
          <Point colors={colors} icon="notifications-outline" title="It watches quietly" body="Bank, JazzCash, Easypaisa, SadaPay & more — caught the moment they notify you." />
          <Point colors={colors} icon="flash-outline" title="It logs automatically" body="Each transaction becomes an expense on its own. You do nothing." />
          <Point colors={colors} icon="calendar-outline" title="It reports weekly" body="Every week, a clear summary of where your money actually went." />
        </Animated.View>

        <Animated.View entering={FadeIn.delay(460).duration(500)} style={styles.privacyNote}>
          <Ionicons name="lock-closed-outline" size={14} color={colors.textSecondary} />
          <Text style={styles.privacyText}>
            Only bank &amp; wallet alerts are read. Everything else is ignored.
          </Text>
        </Animated.View>
      </ScrollView>

      <Animated.View entering={FadeInDown.delay(520).duration(500)} style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        {ready ? (
          <Pressable
            onPress={goToApp}
            style={({ pressed }) => [styles.cta, pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] }]}
            testID="onboarding-continue"
          >
            <Text style={styles.ctaText}>{isAndroid ? "You're all set — let's go" : 'Continue'}</Text>
            <Ionicons name="arrow-forward" size={18} color="#fff" />
          </Pressable>
        ) : (
          <>
            <Pressable
              onPress={grant}
              style={({ pressed }) => [styles.cta, pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] }]}
              testID="onboarding-grant"
            >
              <Ionicons name="notifications" size={18} color="#fff" />
              <Text style={styles.ctaText}>Turn on automatic tracking</Text>
            </Pressable>
            <Text style={styles.footerHint}>
              Opens Android settings. If it&apos;s blocked, open the app&apos;s ⋮ menu → &quot;Allow restricted settings&quot; first.
            </Text>
          </>
        )}
      </Animated.View>
    </View>
  );
}

function Point({ colors, icon, title, body }: { colors: ThemeColors; icon: any; title: string; body: string }) {
  const styles = createStyles(colors);
  return (
    <View style={styles.point}>
      <View style={styles.pointIcon}>
        <Ionicons name={icon} size={20} color={colors.primary} />
      </View>
      <View style={styles.pointText}>
        <Text style={styles.pointTitle}>{title}</Text>
        <Text style={styles.pointBody}>{body}</Text>
      </View>
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 28, gap: 0, flexGrow: 1 },
  heroIcon: {
    width: 64, height: 64, borderRadius: 20,
    backgroundColor: colors.primary + '15',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 24,
  },
  title: { fontSize: 32, lineHeight: 38, fontFamily: 'Inter_700Bold', color: colors.text },
  subtitle: { fontSize: 16, lineHeight: 24, fontFamily: 'Inter_400Regular', color: colors.textSecondary, marginTop: 12 },
  points: { marginTop: 32, gap: 20 },
  point: { flexDirection: 'row', gap: 14, alignItems: 'flex-start' },
  pointIcon: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: colors.surface,
    alignItems: 'center', justifyContent: 'center',
  },
  pointText: { flex: 1, gap: 2 },
  pointTitle: { fontSize: 15, fontFamily: 'Inter_600SemiBold', color: colors.text },
  pointBody: { fontSize: 13, lineHeight: 19, fontFamily: 'Inter_400Regular', color: colors.textSecondary },
  privacyNote: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 28 },
  privacyText: { flex: 1, fontSize: 12, fontFamily: 'Inter_400Regular', color: colors.textSecondary },
  footer: { paddingHorizontal: 24, paddingTop: 12, gap: 10, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.background },
  cta: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: colors.primary, borderRadius: 16, paddingVertical: 17,
  },
  ctaText: { fontSize: 16, fontFamily: 'Inter_700Bold', color: '#fff' },
  footerHint: { fontSize: 11, lineHeight: 16, fontFamily: 'Inter_400Regular', color: colors.textSecondary, textAlign: 'center', paddingHorizontal: 8 },
});
