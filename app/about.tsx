import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useColors } from '@/lib/theme-context';
import type { lightColors } from '@/constants/colors';

const FEATURES = [
  { icon: 'wallet-outline' as const, label: 'Track daily expenses in PKR' },
  { icon: 'mic-outline' as const, label: 'Voice expenses in Urdu, Roman Urdu or English' },
  { icon: 'pie-chart-outline' as const, label: 'Daily, weekly and monthly budget tracking' },
  { icon: 'bar-chart-outline' as const, label: 'Spending charts by category' },
  { icon: 'document-text-outline' as const, label: 'Share a CSV of any date range' },
  { icon: 'shield-checkmark-outline' as const, label: 'Your data, only visible to you' },
];

export default function AboutScreen() {
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const styles = createStyles(colors);
  const webTopInset = Platform.OS === 'web' ? 67 : 0;
  const webBottomInset = Platform.OS === 'web' ? 34 : 0;

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: (Platform.OS === 'web' ? webTopInset : insets.top) + 8 }]}>
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.back();
          }}
          hitSlop={12}
        >
          <Ionicons name="close" size={28} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>About</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: (Platform.OS === 'web' ? webBottomInset : insets.bottom) + 20 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeInDown.duration(400)} style={styles.heroSection}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarLetter}>H</Text>
          </View>
          <Text style={styles.appName}>Hisaabit</Text>
          <Text style={styles.tagline}>Personal Finance Tracker for Pakistan</Text>
          <Text style={styles.version}>Version 1.0.0</Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(150).duration(400)} style={styles.card}>
          <Text style={styles.sectionTitle}>Features</Text>
          {FEATURES.map((feature, index) => (
            <View key={index} style={styles.featureRow}>
              <View style={styles.featureIconContainer}>
                <Ionicons name={feature.icon} size={22} color={colors.primary} />
              </View>
              <Text style={styles.featureLabel}>{feature.label}</Text>
            </View>
          ))}
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(300).duration(400)} style={styles.card}>
          <Text style={styles.sectionTitle}>How It Works</Text>
          <View style={styles.featureRow}>
            <View style={styles.stepBadge}>
              <Text style={styles.stepBadgeText}>1</Text>
            </View>
            <Text style={styles.featureLabel}>Add expenses manually or with your voice</Text>
          </View>
          <View style={styles.featureRow}>
            <View style={styles.stepBadge}>
              <Text style={styles.stepBadgeText}>2</Text>
            </View>
            <Text style={styles.featureLabel}>Set daily, weekly & monthly budgets</Text>
          </View>
          <View style={styles.featureRow}>
            <View style={styles.stepBadge}>
              <Text style={styles.stepBadgeText}>3</Text>
            </View>
            <Text style={styles.featureLabel}>Track spending patterns with charts</Text>
          </View>
          <View style={styles.featureRow}>
            <View style={styles.stepBadge}>
              <Text style={styles.stepBadgeText}>4</Text>
            </View>
            <Text style={styles.featureLabel}>Share a CSV export from the History screen — or a full PDF from the Sunday Weekly Hisaab</Text>
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(450).duration(400)} style={styles.madeInPakistan}>
          <Text style={styles.madeInText}>Hisaabit v1.0.0</Text>
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
  content: {
    padding: 20,
    gap: 24,
  },
  heroSection: {
    alignItems: 'center',
    paddingVertical: 24,
    gap: 8,
  },
  avatarCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  avatarLetter: {
    fontSize: 36,
    fontFamily: 'Inter_700Bold',
    color: '#FFFFFF',
  },
  appName: {
    fontSize: 28,
    fontFamily: 'Inter_700Bold',
    color: colors.text,
  },
  tagline: {
    fontSize: 15,
    fontFamily: 'Inter_500Medium',
    color: colors.textSecondary,
    textAlign: 'center',
  },
  version: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: colors.textSecondary,
    marginTop: 4,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 20,
    gap: 14,
  },
  sectionTitle: {
    fontSize: 17,
    fontFamily: 'Inter_600SemiBold',
    color: colors.text,
    marginBottom: 4,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  featureIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.primary + '12',
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureLabel: {
    fontSize: 15,
    fontFamily: 'Inter_500Medium',
    color: colors.text,
    flex: 1,
  },
  stepBadge: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.primary + '12',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBadgeText: {
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
    color: colors.primary,
  },
  madeInPakistan: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  madeInText: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: colors.textSecondary,
  },
});
