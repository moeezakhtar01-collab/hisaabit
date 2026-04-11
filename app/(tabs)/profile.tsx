import { View, Text, StyleSheet, Pressable, Platform, ScrollView, Alert, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useAuth } from '@/lib/auth-context';
import { useTheme } from '@/lib/theme-context';

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();
  const { colors, isDark, toggleTheme } = useTheme();
  const webTopInset = Platform.OS === 'web' ? 67 : 0;

  const navigateTo = (screen: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(screen as any);
  };

  const handleLogout = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      'Log Out',
      'Are you sure you want to log out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log Out',
          style: 'destructive',
          onPress: async () => {
            await logout();
          },
        },
      ]
    );
  };

  const styles = createStyles(colors);

  return (
    <View style={styles.screen}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Platform.OS === 'web' ? 34 : 120 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.header, { paddingTop: (Platform.OS === 'web' ? webTopInset : insets.top) + 12 }]}>
          <Text style={styles.screenTitle}>Account</Text>
        </View>

        <Animated.View entering={FadeInDown.delay(100).duration(400)} style={styles.profileCard}>
          <View style={styles.avatarContainer}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {user?.name?.charAt(0)?.toUpperCase() || 'U'}
              </Text>
            </View>
          </View>
          <Text style={styles.userName}>{user?.name || 'User'}</Text>
          <Text style={styles.userEmail}>{user?.email || ''}</Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(200).duration(400)} style={styles.section}>
          <Text style={styles.sectionTitle}>Settings</Text>

          <View style={styles.menuCard}>
            <Pressable style={styles.menuItem} onPress={() => navigateTo('/edit-profile')} testID="profile-menu-item">
              <View style={[styles.menuIconBg, { backgroundColor: colors.primary + '15' }]}>
                <Ionicons name="person-outline" size={18} color={colors.primary} />
              </View>
              <Text style={styles.menuLabel}>Profile</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.border} />
            </Pressable>

            <View style={styles.menuDivider} />

            <Pressable style={styles.menuItem} onPress={() => navigateTo('/subscription')} testID="subscription-menu-item">
              <View style={[styles.menuIconBg, { backgroundColor: '#F59E0B15' }]}>
                <Ionicons name="diamond-outline" size={18} color="#F59E0B" />
              </View>
              <Text style={styles.menuLabel}>Subscription</Text>
              <View style={styles.planBadge}>
                <Text style={[styles.planBadgeText, user?.subscriptionPlan === 'pro' && styles.proPlanBadgeText]}>
                  {(user?.subscriptionPlan || 'free').toUpperCase()}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.border} />
            </Pressable>

            <View style={styles.menuDivider} />

            <View style={styles.menuItem}>
              <View style={[styles.menuIconBg, { backgroundColor: '#6366F115' }]}>
                <Ionicons name={isDark ? 'moon' : 'moon-outline'} size={18} color="#6366F1" />
              </View>
              <Text style={styles.menuLabel}>Dark Mode</Text>
              <Switch
                value={isDark}
                onValueChange={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  toggleTheme();
                }}
                trackColor={{ false: colors.border, true: colors.primary + '80' }}
                thumbColor={isDark ? colors.primary : '#f4f3f4'}
              />
            </View>

            <View style={styles.menuDivider} />

            <Pressable style={styles.menuItem} onPress={() => navigateTo('/notifications')} testID="notifications-menu-item">
              <View style={[styles.menuIconBg, { backgroundColor: '#3B82F615' }]}>
                <Ionicons name="notifications-outline" size={18} color="#3B82F6" />
              </View>
              <Text style={styles.menuLabel}>Notifications</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.border} />
            </Pressable>

            <View style={styles.menuDivider} />

            <Pressable style={styles.menuItem} onPress={() => navigateTo('/sms-settings')} testID="sms-settings-menu-item">
              <View style={[styles.menuIconBg, { backgroundColor: '#10B98115' }]}>
                <Ionicons name="chatbox-ellipses-outline" size={18} color="#10B981" />
              </View>
              <Text style={styles.menuLabel}>SMS Expenses</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.border} />
            </Pressable>

            <View style={styles.menuDivider} />

            <Pressable style={styles.menuItem} onPress={() => navigateTo('/privacy')} testID="privacy-menu-item">
              <View style={[styles.menuIconBg, { backgroundColor: '#8B5CF615' }]}>
                <Ionicons name="shield-checkmark-outline" size={18} color="#8B5CF6" />
              </View>
              <Text style={styles.menuLabel}>Privacy</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.border} />
            </Pressable>
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(300).duration(400)} style={styles.section}>
          <Text style={styles.sectionTitle}>Support</Text>

          <View style={styles.menuCard}>
            <Pressable style={styles.menuItem} onPress={() => navigateTo('/help-faq')} testID="help-faq-menu-item">
              <View style={[styles.menuIconBg, { backgroundColor: '#F59E0B15' }]}>
                <Ionicons name="help-circle-outline" size={18} color="#F59E0B" />
              </View>
              <Text style={styles.menuLabel}>Help & FAQ</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.border} />
            </Pressable>

            <View style={styles.menuDivider} />

            <Pressable style={styles.menuItem} onPress={() => navigateTo('/about')} testID="about-menu-item">
              <View style={[styles.menuIconBg, { backgroundColor: '#06B6D415' }]}>
                <Ionicons name="information-circle-outline" size={18} color="#06B6D4" />
              </View>
              <Text style={styles.menuLabel}>About</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.border} />
            </Pressable>
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(400).duration(400)}>
          <Pressable
            onPress={handleLogout}
            style={({ pressed }) => [styles.logoutButton, pressed && { opacity: 0.8, transform: [{ scale: 0.98 }] }]}
            testID="logout-button"
          >
            <Ionicons name="log-out-outline" size={20} color={colors.danger} />
            <Text style={styles.logoutText}>Log Out</Text>
          </Pressable>
        </Animated.View>

        <Text style={styles.versionText}>Hisaabit v1.0.0</Text>
      </ScrollView>
    </View>
  );
}

const createStyles = (colors: typeof import('@/constants/colors').lightColors) => StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    gap: 16,
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 4,
  },
  screenTitle: {
    fontSize: 24,
    fontFamily: 'Inter_700Bold',
    color: colors.text,
  },
  profileCard: {
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: 24,
    marginHorizontal: 16,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 6,
  },
  avatarContainer: {
    marginBottom: 8,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 28,
    fontFamily: 'Inter_700Bold',
    color: '#fff',
  },
  userName: {
    fontSize: 20,
    fontFamily: 'Inter_700Bold',
    color: colors.text,
  },
  userEmail: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: colors.textSecondary,
  },
  section: {
    gap: 10,
  },
  sectionTitle: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: colors.textSecondary,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
    paddingHorizontal: 20,
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
  menuLabel: {
    flex: 1,
    fontSize: 15,
    fontFamily: 'Inter_500Medium',
    color: colors.text,
  },
  menuDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginLeft: 62,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.danger + '08',
    borderRadius: 14,
    padding: 16,
    marginHorizontal: 16,
    borderWidth: 1.5,
    borderColor: colors.danger + '25',
  },
  logoutText: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    color: colors.danger,
  },
  planBadge: {
    backgroundColor: colors.primary + '12',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginRight: 4,
  },
  planBadgeText: {
    fontSize: 11,
    fontFamily: 'Inter_700Bold',
    color: colors.primary,
  },
  proPlanBadgeText: {
    color: '#F59E0B',
  },
  versionText: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 4,
  },
});
