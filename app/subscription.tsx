import { useState, useEffect } from 'react';
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
import { getApiUrl, apiRequest } from '@/lib/query-client';

const MONTHLY_FREE_LIMIT = 5;

export default function SubscriptionScreen() {
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const styles = createStyles(colors);
  const { user, refreshUser } = useAuth();
  const [loading, setLoading] = useState<string | null>(null);
  const [storeInfo, setStoreInfo] = useState<{
    adsRemoved: boolean;
    voiceUsageCount: number;
    voiceCreditsPurchased: number;
    monthlyFreeLimit: number;
  } | null>(null);
  const webTopInset = Platform.OS === 'web' ? 67 : 0;

  useEffect(() => {
    loadStoreInfo();
  }, []);

  const loadStoreInfo = async () => {
    try {
      const res = await apiRequest('GET', '/api/subscription');
      const data = await res.json();
      setStoreInfo(data);
    } catch {
      // Use auth context data as fallback
    }
  };

  const adsRemoved = storeInfo?.adsRemoved ?? user?.adsRemoved ?? false;
  const voiceUsageCount = storeInfo?.voiceUsageCount ?? 0;
  const voiceCreditsPurchased = storeInfo?.voiceCreditsPurchased ?? user?.voiceCreditsPurchased ?? 0;
  const voiceFreeRemaining = Math.max(0, MONTHLY_FREE_LIMIT - voiceUsageCount);

  const handleRemoveAds = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      'Remove Ads',
      'Remove all ads permanently for Rs. 399. This is a one-time purchase.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Purchase — Rs. 399',
          onPress: async () => {
            setLoading('ads');
            try {
              await apiRequest('POST', '/api/purchase', { action: 'remove_ads' });
              await refreshUser();
              await loadStoreInfo();
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              Alert.alert('Ads Removed!', 'You won\'t see any ads from now on. Enjoy!');
            } catch {
              Alert.alert('Error', 'Purchase failed. Please try again.');
            } finally {
              setLoading(null);
            }
          },
        },
      ]
    );
  };

  const handleBuyCredits = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      'Buy Voice Credits',
      'Get 50 AI voice credits for Rs. 150. Credits never expire.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Purchase — Rs. 150',
          onPress: async () => {
            setLoading('credits');
            try {
              await apiRequest('POST', '/api/purchase', { action: 'buy_voice_credits' });
              await refreshUser();
              await loadStoreInfo();
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              Alert.alert('Credits Added!', '50 voice credits have been added to your account.');
            } catch {
              Alert.alert('Error', 'Purchase failed. Please try again.');
            } finally {
              setLoading(null);
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
        <Text style={styles.headerTitle}>Store</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: (Platform.OS === 'web' ? 34 : insets.bottom) + 20 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Voice AI Usage */}
        <Animated.View entering={FadeInDown.delay(100).duration(400)} style={styles.usageBanner}>
          <View style={styles.usageRow}>
            <View style={styles.usageIconBg}>
              <Ionicons name="mic" size={20} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.usageLabel}>Voice AI — This Month</Text>
              <Text style={styles.usageSubLabel}>
                {voiceFreeRemaining} of {MONTHLY_FREE_LIMIT} free uses left
                {voiceCreditsPurchased > 0 && ` • ${voiceCreditsPurchased} credits`}
              </Text>
            </View>
          </View>
          <View style={styles.usageBarContainer}>
            <View style={[styles.usageBar, { width: `${Math.min(100, (voiceUsageCount / MONTHLY_FREE_LIMIT) * 100)}%` }]} />
          </View>
        </Animated.View>

        {/* Remove Ads Card */}
        <Animated.View entering={FadeInDown.delay(200).duration(400)} style={styles.purchaseCard}>
          <View style={styles.cardHeader}>
            <View style={[styles.cardIconBg, { backgroundColor: '#EF444415' }]}>
              <Ionicons name="eye-off-outline" size={22} color="#EF4444" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>Remove Ads</Text>
              <Text style={styles.cardSubtitle}>One-time purchase — ads gone forever</Text>
            </View>
          </View>

          {adsRemoved ? (
            <View style={styles.purchasedBadge}>
              <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
              <Text style={styles.purchasedText}>Purchased</Text>
            </View>
          ) : (
            <>
              <View style={styles.featureList}>
                <View style={styles.featureRow}>
                  <Ionicons name="checkmark" size={16} color={colors.primary} />
                  <Text style={styles.featureText}>No banner ads on home screen</Text>
                </View>
                <View style={styles.featureRow}>
                  <Ionicons name="checkmark" size={16} color={colors.primary} />
                  <Text style={styles.featureText}>No interstitial ads after saving expenses</Text>
                </View>
                <View style={styles.featureRow}>
                  <Ionicons name="checkmark" size={16} color={colors.primary} />
                  <Text style={styles.featureText}>Cleaner, distraction-free experience</Text>
                </View>
              </View>

              <Pressable
                onPress={handleRemoveAds}
                disabled={loading !== null}
                style={({ pressed }) => [styles.purchaseButton, pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] }]}
              >
                {loading === 'ads' ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Text style={styles.purchaseButtonText}>Remove Ads — Rs. 399</Text>
                  </>
                )}
              </Pressable>
            </>
          )}
        </Animated.View>

        {/* Voice Credits Card */}
        <Animated.View entering={FadeInDown.delay(300).duration(400)} style={styles.purchaseCard}>
          <View style={styles.cardHeader}>
            <View style={[styles.cardIconBg, { backgroundColor: '#8B5CF615' }]}>
              <Ionicons name="diamond-outline" size={22} color="#8B5CF6" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>Voice Credits</Text>
              <Text style={styles.cardSubtitle}>For when you need more than 5/month</Text>
            </View>
          </View>

          {voiceCreditsPurchased > 0 && (
            <View style={styles.creditsBadge}>
              <Ionicons name="wallet" size={16} color="#8B5CF6" />
              <Text style={styles.creditsText}>{voiceCreditsPurchased} credits remaining</Text>
            </View>
          )}

          <View style={styles.featureList}>
            <View style={styles.featureRow}>
              <Ionicons name="checkmark" size={16} color="#8B5CF6" />
              <Text style={styles.featureText}>50 AI voice entries per pack</Text>
            </View>
            <View style={styles.featureRow}>
              <Ionicons name="checkmark" size={16} color="#8B5CF6" />
              <Text style={styles.featureText}>Credits never expire</Text>
            </View>
            <View style={styles.featureRow}>
              <Ionicons name="checkmark" size={16} color="#8B5CF6" />
              <Text style={styles.featureText}>Used only after free monthly uses are spent</Text>
            </View>
          </View>

          <Pressable
            onPress={handleBuyCredits}
            disabled={loading !== null}
            style={({ pressed }) => [styles.purchaseButton, styles.creditsPurchaseButton, pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] }]}
          >
            {loading === 'credits' ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.purchaseButtonText}>Buy 50 Credits — Rs. 150</Text>
            )}
          </Pressable>
        </Animated.View>

        {/* Free Features Info */}
        <Animated.View entering={FadeInDown.delay(400).duration(400)} style={styles.freeCard}>
          <Text style={styles.freeTitle}>Included Free</Text>
          <View style={styles.featureList}>
            {[
              'Unlimited manual expenses',
              'All 11 expense categories',
              'Daily, weekly & monthly budgets',
              'Spending charts & history',
              'PDF & CSV reports',
              'SMS auto-capture (Android)',
              '5 AI voice entries per month',
              'Multiple expenses per recording',
            ].map((feature, i) => (
              <View key={i} style={styles.featureRow}>
                <Ionicons name="checkmark-circle" size={16} color={colors.primary} />
                <Text style={styles.featureText}>{feature}</Text>
              </View>
            ))}
          </View>
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
    gap: 12,
  },
  usageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  usageIconBg: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.primary + '12',
    alignItems: 'center',
    justifyContent: 'center',
  },
  usageLabel: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
    color: colors.text,
  },
  usageSubLabel: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: colors.textSecondary,
    marginTop: 2,
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
  purchaseCard: {
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  cardIconBg: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    fontSize: 18,
    fontFamily: 'Inter_700Bold',
    color: colors.text,
  },
  cardSubtitle: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: colors.textSecondary,
    marginTop: 2,
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
  purchaseButton: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderRadius: 14,
    padding: 16,
  },
  creditsPurchaseButton: {
    backgroundColor: '#8B5CF6',
  },
  purchaseButtonText: {
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
    color: '#fff',
  },
  purchasedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.primary + '10',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignSelf: 'flex-start',
  },
  purchasedText: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
    color: colors.primary,
  },
  creditsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#8B5CF610',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignSelf: 'flex-start',
  },
  creditsText: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    color: '#8B5CF6',
  },
  freeCard: {
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 14,
  },
  freeTitle: {
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
    color: colors.text,
  },
});
