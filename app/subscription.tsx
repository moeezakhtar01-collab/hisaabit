import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useColors } from '@/lib/theme-context';
import { useAuth } from '@/lib/auth-context';
import type { lightColors } from '@/constants/colors';
import { getApiUrl } from '@/lib/query-client';
import { fetch } from 'expo/fetch';

const FREE_VOICE_LIMIT = 10;

interface PlanFeature {
  text: string;
  included: boolean;
}

const FREE_FEATURES: PlanFeature[] = [
  { text: 'Unlimited manual expenses', included: true },
  { text: 'All 13 expense categories', included: true },
  { text: 'Daily, weekly & monthly budgets', included: true },
  { text: 'Spending charts & history', included: true },
  { text: 'Daily reminder notifications', included: true },
  { text: '10 AI voice entries (total)', included: true },
  { text: '1 expense per voice recording', included: true },
  { text: 'Multiple expenses per recording', included: false },
  { text: 'Unlimited AI voice entries', included: false },
];

const PRO_FEATURES: PlanFeature[] = [
  { text: 'Everything in Free', included: true },
  { text: 'Unlimited AI voice entries', included: true },
  { text: 'Multiple expenses per recording', included: true },
];

export default function SubscriptionScreen() {
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const styles = createStyles(colors);
  const { user, refreshUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const webTopInset = Platform.OS === 'web' ? 67 : 0;

  const currentPlan = user?.subscriptionPlan || 'free';
  const voiceUsageCount = user?.voiceUsageCount || 0;
  const voiceRemaining = Math.max(0, FREE_VOICE_LIMIT - voiceUsageCount);

  const handleUpgrade = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      'Upgrade to Pro',
      'Pro plan will be available soon with premium features. For now, enjoy Pro access for free!',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Activate Pro',
          onPress: async () => {
            setLoading(true);
            try {
              const baseUrl = getApiUrl();
              const res = await fetch(new URL('/api/subscription', baseUrl).toString(), {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ plan: 'pro' }),
              });
              if (!res.ok) throw new Error('Failed to upgrade');
              await refreshUser();
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              Alert.alert('Welcome to Pro!', 'You now have unlimited AI voice entries and multi-expense logging.');
            } catch {
              Alert.alert('Error', 'Could not upgrade. Please try again.');
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleDowngrade = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      'Switch to Free',
      'You will lose access to unlimited voice entries and multi-expense recording.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Switch to Free',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              const baseUrl = getApiUrl();
              const res = await fetch(new URL('/api/subscription', baseUrl).toString(), {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ plan: 'free' }),
              });
              if (!res.ok) throw new Error('Failed to downgrade');
              await refreshUser();
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            } catch {
              Alert.alert('Error', 'Could not change plan. Please try again.');
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: (Platform.OS === 'web' ? webTopInset : insets.top) + 8 }]}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Subscription</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: (Platform.OS === 'web' ? 34 : insets.bottom) + 20 }]}
        showsVerticalScrollIndicator={false}
      >
        {currentPlan === 'free' && (
          <Animated.View entering={FadeInDown.delay(100).duration(400)} style={styles.usageBanner}>
            <View style={styles.usageRow}>
              <Ionicons name="mic" size={20} color={colors.primary} />
              <Text style={styles.usageLabel}>AI Voice Entries</Text>
            </View>
            <View style={styles.usageBarContainer}>
              <View style={[styles.usageBar, { width: `${Math.min(100, (voiceUsageCount / FREE_VOICE_LIMIT) * 100)}%` }]} />
            </View>
            <Text style={styles.usageText}>
              {voiceUsageCount} of {FREE_VOICE_LIMIT} used — {voiceRemaining} remaining
            </Text>
          </Animated.View>
        )}

        <Animated.View entering={FadeInDown.delay(150).duration(400)} style={[
          styles.planCard,
          currentPlan === 'free' && styles.planCardActive,
        ]}>
          {currentPlan === 'free' && (
            <View style={styles.currentBadge}>
              <Text style={styles.currentBadgeText}>Current Plan</Text>
            </View>
          )}
          <View style={styles.planHeader}>
            <View style={styles.planIconBg}>
              <Ionicons name="wallet-outline" size={24} color={colors.primary} />
            </View>
            <View>
              <Text style={styles.planName}>Free</Text>
              <Text style={styles.planPrice}>PKR 0</Text>
            </View>
          </View>
          <View style={styles.featureList}>
            {FREE_FEATURES.map((feature, i) => (
              <View key={i} style={styles.featureRow}>
                <Ionicons
                  name={feature.included ? 'checkmark-circle' : 'close-circle'}
                  size={18}
                  color={feature.included ? colors.primary : colors.textSecondary + '60'}
                />
                <Text style={[styles.featureText, !feature.included && styles.featureTextDisabled]}>
                  {feature.text}
                </Text>
              </View>
            ))}
          </View>
          {currentPlan === 'pro' && (
            <Pressable
              onPress={handleDowngrade}
              disabled={loading}
              style={({ pressed }) => [styles.downgradeButton, pressed && { opacity: 0.8 }]}
            >
              {loading ? (
                <ActivityIndicator size="small" color={colors.textSecondary} />
              ) : (
                <Text style={styles.downgradeButtonText}>Switch to Free</Text>
              )}
            </Pressable>
          )}
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(250).duration(400)} style={[
          styles.planCard,
          styles.proCard,
          currentPlan === 'pro' && styles.planCardActive,
          currentPlan === 'pro' && styles.proCardActive,
        ]}>
          {currentPlan === 'pro' && (
            <View style={[styles.currentBadge, styles.proBadge]}>
              <Text style={[styles.currentBadgeText, styles.proBadgeText]}>Current Plan</Text>
            </View>
          )}
          <View style={styles.planHeader}>
            <View style={[styles.planIconBg, styles.proIconBg]}>
              <Ionicons name="diamond-outline" size={24} color="#F59E0B" />
            </View>
            <View>
              <Text style={styles.planName}>Pro</Text>
              <Text style={styles.planPrice}>Rs. 99/month</Text>
            </View>
          </View>

          <View style={styles.bundleBadge}>
            <Ionicons name="pricetag" size={14} color="#F59E0B" />
            <Text style={styles.bundleText}>Save with 3-month bundle — Rs. 150 (Rs. 50/mo)</Text>
          </View>

          <View style={styles.featureList}>
            {PRO_FEATURES.map((feature, i) => (
              <View key={i} style={styles.featureRow}>
                <Ionicons name="checkmark-circle" size={18} color="#F59E0B" />
                <Text style={styles.featureText}>{feature.text}</Text>
              </View>
            ))}
          </View>
          {currentPlan !== 'pro' && (
            <Pressable
              onPress={handleUpgrade}
              disabled={loading}
              style={({ pressed }) => [styles.upgradeButton, pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] }]}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="flash" size={18} color="#fff" />
                  <Text style={styles.upgradeButtonText}>Upgrade to Pro</Text>
                </>
              )}
            </Pressable>
          )}
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const createStyles = (colors: typeof lightColors) => StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    fontSize: 17,
    fontFamily: 'Inter_600SemiBold',
    color: colors.text,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 16,
  },
  usageBanner: {
    backgroundColor: colors.primary + '08',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.primary + '20',
    gap: 10,
  },
  usageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  usageLabel: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
    color: colors.text,
  },
  usageBarContainer: {
    height: 8,
    backgroundColor: colors.border,
    borderRadius: 4,
    overflow: 'hidden',
  },
  usageBar: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 4,
  },
  usageText: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: colors.textSecondary,
  },
  planCard: {
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1.5,
    borderColor: colors.border,
    gap: 16,
  },
  planCardActive: {
    borderColor: colors.primary + '50',
  },
  proCard: {},
  proCardActive: {
    borderColor: '#F59E0B50',
  },
  currentBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.primary + '15',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  currentBadgeText: {
    fontSize: 12,
    fontFamily: 'Inter_700Bold',
    color: colors.primary,
  },
  proBadge: {
    backgroundColor: '#F59E0B15',
  },
  proBadgeText: {
    color: '#F59E0B',
  },
  planHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  planIconBg: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: colors.primary + '12',
    alignItems: 'center',
    justifyContent: 'center',
  },
  proIconBg: {
    backgroundColor: '#F59E0B12',
  },
  planName: {
    fontSize: 20,
    fontFamily: 'Inter_700Bold',
    color: colors.text,
  },
  planPrice: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
    color: colors.textSecondary,
  },
  featureList: {
    gap: 10,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  featureText: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: colors.text,
    flex: 1,
  },
  featureTextDisabled: {
    color: colors.textSecondary + '80',
    textDecorationLine: 'line-through',
  },
  upgradeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#F59E0B',
    borderRadius: 14,
    padding: 16,
  },
  upgradeButtonText: {
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
    color: '#fff',
  },
  downgradeButton: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  downgradeButtonText: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
    color: colors.textSecondary,
  },
  bundleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F59E0B10',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#F59E0B25',
  },
  bundleText: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    color: '#D97706',
    flex: 1,
  },
});
