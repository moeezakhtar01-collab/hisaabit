import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Switch,
  Alert,
  Platform,
  ActivityIndicator,
  AppState,
  type AppStateStatus,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { router, Redirect } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useColors } from '@/lib/theme-context';
import { type ThemeColors } from '@/constants/colors';
import { NOTIFICATION_LISTENER_ENABLED } from '@/lib/feature-flags';
import {
  hasNotificationAccess,
  openNotificationAccessSettings,
  setNotificationListenerEnabled,
  isListenerActive,
} from '@/lib/notification-listener';

const ENABLED_CACHE_KEY = 'notification_listener_enabled';

export default function NotificationSettingsScreen() {
  const colors = useColors();
  const styles = createStyles(colors);
  const insets = useSafeAreaInsets();

  const [enabled, setEnabled] = useState(false);
  const [hasAccess, setHasAccess] = useState(false);
  const [listenerActive, setListenerActive] = useState(false);
  const [loading, setLoading] = useState(true);
  const appState = useRef(AppState.currentState);

  const refresh = useCallback(async () => {
    const granted = await hasNotificationAccess();
    setHasAccess(granted);
    setListenerActive(isListenerActive());
    setLoading(false);
  }, []);

  useEffect(() => {
    // Load persisted opt-in choice from AsyncStorage
    import('@react-native-async-storage/async-storage').then(({ default: AsyncStorage }) => {
      AsyncStorage.getItem(ENABLED_CACHE_KEY).then((value) => {
        setEnabled(value === 'true');
      });
    });
    refresh();
  }, [refresh]);

  // Re-check permission when user returns from Android Settings
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (appState.current.match(/inactive|background/) && next === 'active') {
        refresh();
      }
      appState.current = next;
    });
    return () => sub.remove();
  }, [refresh]);

  if (!NOTIFICATION_LISTENER_ENABLED) {
    return <Redirect href="/(tabs)" />;
  }

  const handleToggle = async (value: boolean) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    if (value && !hasAccess) {
      Alert.alert(
        'Notification Access Required',
        'To detect expenses from bank and wallet notifications, Hisaabit needs Notification Access. You will be taken to Android Settings where you can toggle it on for Hisaabit.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Open Settings',
            onPress: async () => {
              const opened = await openNotificationAccessSettings();
              if (!opened) {
                Alert.alert(
                  'Could not open Settings',
                  'Open Android Settings manually: Settings > Apps > Special app access > Notification access > Hisaabit'
                );
              }
            },
          },
        ]
      );
      return;
    }

    try {
      await setNotificationListenerEnabled(value);
      setEnabled(value);
      setTimeout(() => setListenerActive(isListenerActive()), 300);
    } catch {
      Alert.alert('Error', 'Failed to update notification listener settings');
    }
  };

  const webTopInset = Platform.OS === 'web' ? 20 : 0;

  if (loading) {
    return (
      <View style={[styles.screen, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: (Platform.OS === 'web' ? webTopInset : insets.top) + 8 }]}>
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.back();
          }}
          style={({ pressed }) => [styles.closeBtn, pressed && { opacity: 0.7 }]}
        >
          <Ionicons name="close" size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Notification Expenses</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom, 20) + 20 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Info card */}
        <Animated.View entering={FadeInDown.delay(100).duration(400)} style={styles.infoCard}>
          <View style={styles.infoIconBg}>
            <Ionicons name="notifications" size={24} color={colors.primary} />
          </View>
          <Text style={styles.infoTitle}>Auto-detect expenses from bank notifications</Text>
          <Text style={styles.infoText}>
            When enabled, Hisaabit quietly watches for transaction notifications
            from your bank and wallet apps. Each one becomes a pending expense
            you can confirm with a tap — no manual logging needed.
          </Text>
          <View style={styles.infoBadge}>
            <Ionicons name="logo-android" size={14} color={colors.success} />
            <Text style={styles.infoBadgeText}>Android only</Text>
          </View>
        </Animated.View>

        {/* Grant access CTA — shown prominently when access is missing */}
        {!hasAccess && (
          <Animated.View entering={FadeInDown.delay(150).duration(400)} style={styles.ctaCard}>
            <View style={styles.ctaHeader}>
              <Ionicons name="shield-outline" size={20} color={colors.warning} />
              <Text style={styles.ctaTitle}>Notification Access not granted</Text>
            </View>
            <Text style={styles.ctaBody}>
              Android requires you to enable this through Settings — there is
              no in-app prompt. Tap below to jump straight to the right screen.
            </Text>
            <Pressable
              onPress={async () => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                const opened = await openNotificationAccessSettings();
                if (!opened) {
                  Alert.alert(
                    'Could not open Settings',
                    'Open Android Settings manually: Settings > Apps > Special app access > Notification access > Hisaabit'
                  );
                }
              }}
              style={({ pressed }) => [styles.ctaButton, pressed && { opacity: 0.85 }]}
            >
              <Text style={styles.ctaButtonText}>Open Android Settings</Text>
              <Ionicons name="arrow-forward" size={18} color="#fff" />
            </Pressable>
          </Animated.View>
        )}

        {/* Toggle + status */}
        <Animated.View entering={FadeInDown.delay(200).duration(400)} style={styles.menuCard}>
          <View style={styles.menuItem}>
            <View style={[styles.menuIconBg, { backgroundColor: colors.success + '15' }]}>
              <Ionicons name="notifications-outline" size={18} color={colors.success} />
            </View>
            <View style={styles.menuLabelGroup}>
              <Text style={styles.menuLabel}>Notification Parsing</Text>
              <Text style={styles.menuSublabel}>
                {enabled ? 'Watching for bank notifications' : 'Disabled'}
              </Text>
            </View>
            <Switch
              value={enabled}
              onValueChange={handleToggle}
              trackColor={{ false: colors.border, true: colors.success + '80' }}
              thumbColor={enabled ? colors.success : '#f4f3f4'}
            />
          </View>

          <View style={styles.menuDivider} />

          {/* Permission status */}
          <View style={styles.menuItem}>
            <View style={[styles.menuIconBg, { backgroundColor: (hasAccess ? colors.success : colors.warning) + '15' }]}>
              <Ionicons
                name={hasAccess ? 'shield-checkmark' : 'shield-outline'}
                size={18}
                color={hasAccess ? colors.success : colors.warning}
              />
            </View>
            <View style={styles.menuLabelGroup}>
              <Text style={styles.menuLabel}>Notification Access</Text>
              <Text style={[styles.menuSublabel, { color: hasAccess ? colors.success : colors.warning }]}>
                {hasAccess ? 'Granted' : 'Not granted'}
              </Text>
            </View>
          </View>

          <View style={styles.menuDivider} />

          {/* Listener status */}
          <View style={styles.menuItem}>
            <View style={[styles.menuIconBg, { backgroundColor: (listenerActive ? colors.success : colors.textSecondary) + '15' }]}>
              <Ionicons
                name={listenerActive ? 'radio' : 'radio-outline'}
                size={18}
                color={listenerActive ? colors.success : colors.textSecondary}
              />
            </View>
            <View style={styles.menuLabelGroup}>
              <Text style={styles.menuLabel}>Listener Status</Text>
              <Text style={[styles.menuSublabel, { color: listenerActive ? colors.success : colors.textSecondary }]}>
                {listenerActive ? 'Active \u2014 watching in real-time' : 'Inactive'}
              </Text>
            </View>
            {listenerActive && <View style={styles.liveDot} />}
          </View>
        </Animated.View>

        {/* How it works */}
        <Animated.View entering={FadeInDown.delay(300).duration(400)} style={styles.howItWorks}>
          <Text style={styles.sectionTitle}>How it works</Text>
          <View style={styles.stepRow}>
            <View style={[styles.stepDot, { backgroundColor: colors.primary }]}>
              <Text style={styles.stepNumber}>1</Text>
            </View>
            <Text style={styles.stepText}>Your bank or wallet app sends a transaction notification</Text>
          </View>
          <View style={styles.stepRow}>
            <View style={[styles.stepDot, { backgroundColor: colors.primary }]}>
              <Text style={styles.stepNumber}>2</Text>
            </View>
            <Text style={styles.stepText}>Hisaabit reads it silently and extracts the amount + category</Text>
          </View>
          <View style={styles.stepRow}>
            <View style={[styles.stepDot, { backgroundColor: colors.primary }]}>
              <Text style={styles.stepNumber}>3</Text>
            </View>
            <Text style={styles.stepText}>A pending expense appears in your inbox</Text>
          </View>
          <View style={styles.stepRow}>
            <View style={[styles.stepDot, { backgroundColor: colors.success }]}>
              <Text style={styles.stepNumber}>4</Text>
            </View>
            <Text style={styles.stepText}>You review and confirm it — done!</Text>
          </View>
        </Animated.View>

        {/* Privacy notice */}
        <Animated.View entering={FadeInDown.delay(350).duration(400)} style={styles.privacyCard}>
          <Ionicons name="lock-closed-outline" size={16} color={colors.textSecondary} />
          <Text style={styles.privacyText}>
            Only notifications from recognized bank and wallet apps are parsed.
            Non-financial notifications are ignored and never leave your device.
            Extracted expense details (amount, category, date) are the only
            thing saved — the original notification text is discarded.
          </Text>
        </Animated.View>

        {/* Supported apps */}
        <Animated.View entering={FadeInDown.delay(400).duration(400)} style={styles.banksSection}>
          <Text style={styles.sectionTitle}>Supported Apps</Text>
          <View style={styles.banksList}>
            {[
              'HBL Mobile', 'UBL Digital', 'Meezan Mobile', 'Alfa',
              'MCB Live', 'Allied Mobile', 'Faysal Digibank',
              'JazzCash', 'Easypaisa', 'NayaPay', 'SadaPay', 'Keenu',
            ].map(app => (
              <View key={app} style={styles.bankChip}>
                <Text style={styles.bankChipText}>{app}</Text>
              </View>
            ))}
          </View>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontFamily: 'Inter_700Bold',
    color: colors.text,
    textAlign: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    gap: 16,
    paddingTop: 16,
  },
  infoCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 20,
    marginHorizontal: 16,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    gap: 10,
  },
  infoIconBg: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: colors.primary + '12',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  infoTitle: {
    fontSize: 17,
    fontFamily: 'Inter_700Bold',
    color: colors.text,
    textAlign: 'center',
  },
  infoText: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 19,
  },
  infoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.success + '12',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  infoBadgeText: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
    color: colors.success,
  },
  ctaCard: {
    backgroundColor: colors.warning + '10',
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 16,
    borderWidth: 1,
    borderColor: colors.warning + '30',
    gap: 10,
  },
  ctaHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  ctaTitle: {
    fontSize: 15,
    fontFamily: 'Inter_700Bold',
    color: colors.text,
  },
  ctaBody: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: colors.textSecondary,
    lineHeight: 18,
  },
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 12,
    marginTop: 4,
  },
  ctaButtonText: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
    color: '#fff',
  },
  menuCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    marginHorizontal: 16,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 12,
  },
  menuIconBg: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuLabelGroup: {
    flex: 1,
    gap: 2,
  },
  menuLabel: {
    fontSize: 15,
    fontFamily: 'Inter_500Medium',
    color: colors.text,
  },
  menuSublabel: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: colors.textSecondary,
  },
  menuDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginLeft: 62,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.success,
  },
  howItWorks: {
    marginHorizontal: 16,
    gap: 12,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  stepDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumber: {
    fontSize: 12,
    fontFamily: 'Inter_700Bold',
    color: '#fff',
  },
  stepText: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: colors.text,
  },
  privacyCard: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 14,
    marginHorizontal: 16,
  },
  privacyText: {
    flex: 1,
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: colors.textSecondary,
    lineHeight: 17,
  },
  banksSection: {
    paddingHorizontal: 20,
    gap: 10,
  },
  sectionTitle: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  banksList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  bankChip: {
    backgroundColor: colors.card,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  bankChipText: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    color: colors.text,
  },
});
