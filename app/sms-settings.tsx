import { useState, useEffect, useCallback } from 'react';
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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { router, Redirect } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useColors } from '@/lib/theme-context';
import { type ThemeColors } from '@/constants/colors';
import { requestSmsPermission, hasSmsPermission } from '@/lib/sms-reader';
import { getSmsSettings, updateSmsSettings, getPendingCount } from '@/lib/sms-storage';
import { setSmsEnabledCache } from '@/lib/sms-processor';
import { isSmsListenerActive } from '@/lib/sms-listener';
import { SMS_ENABLED } from '@/lib/feature-flags';

export default function SmsSettingsScreen() {
  const colors = useColors();
  const styles = createStyles(colors);
  const insets = useSafeAreaInsets();

  const [enabled, setEnabled] = useState(false);
  const [hasPermission, setHasPermission] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [listenerActive, setListenerActive] = useState(false);

  const loadSettings = useCallback(async () => {
    const [settings, permission, count] = await Promise.all([
      getSmsSettings(),
      hasSmsPermission(),
      getPendingCount(),
    ]);
    setEnabled(settings.smsParsingEnabled);
    setHasPermission(permission);
    setPendingCount(count);
    setListenerActive(isSmsListenerActive());
    setLoading(false);
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  if (!SMS_ENABLED) {
    return <Redirect href="/(tabs)" />;
  }

  const handleToggle = async (value: boolean) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    if (value && !hasPermission) {
      const granted = await requestSmsPermission();
      if (!granted) {
        Alert.alert(
          'Permission Required',
          'SMS permission is needed to detect bank transactions. Please allow SMS access in your device settings.',
        );
        return;
      }
      setHasPermission(true);
    }

    try {
      await updateSmsSettings(value);
      await setSmsEnabledCache(value);
      setEnabled(value);

      // Small delay to let the listener start/stop
      setTimeout(() => setListenerActive(isSmsListenerActive()), 300);
    } catch {
      Alert.alert('Error', 'Failed to update SMS settings');
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
        <Text style={styles.headerTitle}>SMS Expenses</Text>
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
            <Ionicons name="chatbox-ellipses" size={24} color={colors.primary} />
          </View>
          <Text style={styles.infoTitle}>Real-time SMS Expense Detection</Text>
          <Text style={styles.infoText}>
            When enabled, Hisaabit automatically detects bank transaction SMS the moment they arrive.
            AI instantly categorizes each transaction and creates a pending expense for you to review.
          </Text>
          <View style={styles.infoBadge}>
            <Ionicons name="logo-android" size={14} color={colors.success} />
            <Text style={styles.infoBadgeText}>Android only</Text>
          </View>
        </Animated.View>

        {/* Toggle + status */}
        <Animated.View entering={FadeInDown.delay(200).duration(400)} style={styles.menuCard}>
          <View style={styles.menuItem}>
            <View style={[styles.menuIconBg, { backgroundColor: colors.success + '15' }]}>
              <Ionicons name="chatbox-ellipses-outline" size={18} color={colors.success} />
            </View>
            <View style={styles.menuLabelGroup}>
              <Text style={styles.menuLabel}>SMS Parsing</Text>
              <Text style={styles.menuSublabel}>
                {enabled ? 'Listening for bank SMS in real-time' : 'Disabled'}
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
            <View style={[styles.menuIconBg, { backgroundColor: (hasPermission ? colors.success : colors.warning) + '15' }]}>
              <Ionicons
                name={hasPermission ? 'shield-checkmark' : 'shield-outline'}
                size={18}
                color={hasPermission ? colors.success : colors.warning}
              />
            </View>
            <View style={styles.menuLabelGroup}>
              <Text style={styles.menuLabel}>SMS Permission</Text>
              <Text style={[styles.menuSublabel, { color: hasPermission ? colors.success : colors.warning }]}>
                {hasPermission ? 'Granted' : 'Not granted'}
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
                {listenerActive ? 'Active \u2014 detecting SMS in real-time' : 'Inactive'}
              </Text>
            </View>
            {listenerActive && (
              <View style={styles.liveDot} />
            )}
          </View>
        </Animated.View>

        {/* Pending count */}
        {pendingCount > 0 && (
          <Animated.View entering={FadeInDown.delay(250).duration(400)}>
            <Pressable
              style={({ pressed }) => [styles.pendingCard, pressed && { opacity: 0.85 }]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                (router as any).push('/sms-expenses');
              }}
            >
              <View style={styles.pendingLeft}>
                <View style={[styles.menuIconBg, { backgroundColor: colors.warning + '15' }]}>
                  <Ionicons name="mail-unread" size={18} color={colors.warning} />
                </View>
                <View>
                  <Text style={styles.menuLabel}>{pendingCount} Pending Expense{pendingCount > 1 ? 's' : ''}</Text>
                  <Text style={styles.menuSublabel}>Tap to review</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.border} />
            </Pressable>
          </Animated.View>
        )}

        {/* How it works */}
        <Animated.View entering={FadeInDown.delay(300).duration(400)} style={styles.howItWorks}>
          <Text style={styles.sectionTitle}>How it works</Text>
          <View style={styles.stepRow}>
            <View style={[styles.stepDot, { backgroundColor: colors.primary }]}>
              <Text style={styles.stepNumber}>1</Text>
            </View>
            <Text style={styles.stepText}>Bank sends you a transaction SMS</Text>
          </View>
          <View style={styles.stepRow}>
            <View style={[styles.stepDot, { backgroundColor: colors.primary }]}>
              <Text style={styles.stepNumber}>2</Text>
            </View>
            <Text style={styles.stepText}>Hisaabit instantly detects and parses it with AI</Text>
          </View>
          <View style={styles.stepRow}>
            <View style={[styles.stepDot, { backgroundColor: colors.primary }]}>
              <Text style={styles.stepNumber}>3</Text>
            </View>
            <Text style={styles.stepText}>A pending expense is created with the right category</Text>
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
            Your SMS messages are processed securely using AI to detect bank transactions only.
            No SMS content is permanently stored — only the extracted expense details (amount, category, date) are saved.
          </Text>
        </Animated.View>

        {/* Supported banks */}
        <Animated.View entering={FadeInDown.delay(400).duration(400)} style={styles.banksSection}>
          <Text style={styles.sectionTitle}>Supported Banks & Wallets</Text>
          <View style={styles.banksList}>
            {[
              'HBL', 'UBL', 'Meezan', 'Bank Alfalah', 'MCB',
              'Allied Bank', 'NBP', 'Faysal Bank', 'Askari',
              'JazzCash', 'Easypaisa', 'NayaPay', 'SadaPay',
            ].map(bank => (
              <View key={bank} style={styles.bankChip}>
                <Text style={styles.bankChipText}>{bank}</Text>
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
  pendingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.warning + '08',
    borderRadius: 16,
    marginHorizontal: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: colors.warning + '30',
  },
  pendingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
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
