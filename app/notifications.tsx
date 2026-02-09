import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Switch,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Colors from '@/constants/colors';

const STORAGE_KEY = 'notification_prefs';

interface NotificationPrefs {
  budgetAlerts: boolean;
  dailyReminder: boolean;
  monthlySummary: boolean;
}

const DEFAULT_PREFS: NotificationPrefs = {
  budgetAlerts: true,
  dailyReminder: false,
  monthlySummary: true,
};

export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  const [prefs, setPrefs] = useState<NotificationPrefs>(DEFAULT_PREFS);

  const webTopInset = Platform.OS === 'web' ? 67 : 0;
  const webBottomInset = Platform.OS === 'web' ? 34 : 0;

  useEffect(() => {
    const loadPrefs = async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (stored) {
          setPrefs(JSON.parse(stored));
        }
      } catch {}
    };
    loadPrefs();
  }, []);

  const handleToggle = useCallback(async (key: keyof NotificationPrefs) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPrefs(prev => {
      const updated = { ...prev, [key]: !prev[key] };
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const TOGGLE_ITEMS: { key: keyof NotificationPrefs; title: string; description: string; icon: keyof typeof Ionicons.glyphMap }[] = [
    {
      key: 'budgetAlerts',
      title: 'Budget Alerts',
      description: 'Get notified when spending exceeds budget',
      icon: 'warning-outline',
    },
    {
      key: 'dailyReminder',
      title: 'Daily Reminder',
      description: 'Reminder to log expenses',
      icon: 'alarm-outline',
    },
    {
      key: 'monthlySummary',
      title: 'Monthly Summary',
      description: 'Monthly spending summary',
      icon: 'calendar-outline',
    },
  ];

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: (Platform.OS === 'web' ? webTopInset : insets.top) + 8 }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} testID="notifications-close-button">
          <Ionicons name="close" size={28} color={Colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Notifications</Text>
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
        <Animated.View entering={FadeInDown.delay(100).duration(400)}>
          <Text style={styles.sectionLabel}>Preferences</Text>
          <View style={styles.card}>
            {TOGGLE_ITEMS.map((item, index) => (
              <View key={item.key}>
                {index > 0 && <View style={styles.separator} />}
                <View style={styles.row}>
                  <View style={styles.rowLeft}>
                    <View style={[styles.iconCircle, { backgroundColor: Colors.primary + '18' }]}>
                      <Ionicons name={item.icon} size={20} color={Colors.primary} />
                    </View>
                    <View style={styles.rowTextContainer}>
                      <Text style={styles.rowTitle}>{item.title}</Text>
                      <Text style={styles.rowDescription}>{item.description}</Text>
                    </View>
                  </View>
                  <Switch
                    value={prefs[item.key]}
                    onValueChange={() => handleToggle(item.key)}
                    trackColor={{ false: Colors.border, true: Colors.primary + '60' }}
                    thumbColor={prefs[item.key] ? Colors.primary : '#f4f3f4'}
                    testID={`toggle-${item.key}`}
                  />
                </View>
              </View>
            ))}
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(200).duration(400)}>
          <View style={styles.card}>
            <View style={styles.infoRow}>
              <Ionicons name="information-circle-outline" size={20} color={Colors.primary} />
              <Text style={styles.infoText}>
                Notification preferences are saved locally on this device.
              </Text>
            </View>
          </View>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: {
    fontSize: 17,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.text,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 20,
    gap: 24,
  },
  sectionLabel: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.text,
    marginBottom: 10,
  },
  card: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    marginRight: 12,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTextContainer: {
    flex: 1,
  },
  rowTitle: {
    fontSize: 15,
    fontFamily: 'Inter_500Medium',
    color: Colors.text,
  },
  rowDescription: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: Colors.textSecondary,
    marginTop: 2,
  },
  separator: {
    height: 1,
    backgroundColor: Colors.border,
    marginLeft: 64,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: Colors.textSecondary,
    lineHeight: 20,
  },
});
