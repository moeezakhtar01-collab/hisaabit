import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Switch,
  Platform,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useColors } from '@/lib/theme-context';
import type { lightColors } from '@/constants/colors';

const STORAGE_KEY = 'notification_prefs';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

interface NotificationPrefs {
  budgetAlerts: boolean;
  dailyReminder: boolean;
  monthlySummary: boolean;
  reminderHour: number;
  reminderMinute: number;
}

const DEFAULT_PREFS: NotificationPrefs = {
  budgetAlerts: true,
  dailyReminder: false,
  monthlySummary: true,
  reminderHour: 21,
  reminderMinute: 0,
};

const REMINDER_MESSAGES = [
  "Did you log today's expenses?",
  "Time to note down today's kharcha!",
  "Don't forget to track today's spending!",
  "Quick reminder to log your expenses for today.",
  "Keep your streak going - log today's expenses!",
];

async function requestNotificationPermission(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

async function scheduleDailyReminder(hour: number, minute: number) {
  await Notifications.cancelAllScheduledNotificationsAsync();
  const message = REMINDER_MESSAGES[Math.floor(Math.random() * REMINDER_MESSAGES.length)];
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Hisaabit',
      body: message,
      sound: true,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
    },
  });
}

async function cancelAllReminders() {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

function formatTime(hour: number, minute: number): string {
  const period = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 || 12;
  const displayMinute = minute.toString().padStart(2, '0');
  return `${displayHour}:${displayMinute} ${period}`;
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = [0, 15, 30, 45];

export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const styles = createStyles(colors);
  const [prefs, setPrefs] = useState<NotificationPrefs>(DEFAULT_PREFS);
  const [showTimePicker, setShowTimePicker] = useState(false);

  const webTopInset = Platform.OS === 'web' ? 67 : 0;
  const webBottomInset = Platform.OS === 'web' ? 34 : 0;

  useEffect(() => {
    const loadPrefs = async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (stored) {
          setPrefs({ ...DEFAULT_PREFS, ...JSON.parse(stored) });
        }
      } catch {}
    };
    loadPrefs();
  }, []);

  const savePrefs = useCallback(async (updated: NotificationPrefs) => {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  }, []);

  const handleToggle = useCallback(async (key: keyof NotificationPrefs) => {
    if (key === 'reminderHour' || key === 'reminderMinute') return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPrefs(prev => {
      const updated = { ...prev, [key]: !prev[key] };

      if (key === 'dailyReminder') {
        if (updated.dailyReminder) {
          requestNotificationPermission().then(granted => {
            if (granted) {
              scheduleDailyReminder(updated.reminderHour, updated.reminderMinute);
            } else {
              Alert.alert(
                'Notifications Disabled',
                'Please enable notifications in your device settings to use daily reminders.'
              );
              setPrefs(p => {
                const reverted = { ...p, dailyReminder: false };
                savePrefs(reverted);
                return reverted;
              });
            }
          });
        } else {
          cancelAllReminders();
        }
      }

      savePrefs(updated);
      return updated;
    });
  }, [savePrefs]);

  const handleTimeSelect = useCallback(async (hour: number, minute: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPrefs(prev => {
      const updated = { ...prev, reminderHour: hour, reminderMinute: minute };
      savePrefs(updated);
      if (updated.dailyReminder) {
        scheduleDailyReminder(hour, minute);
      }
      return updated;
    });
    setShowTimePicker(false);
  }, [savePrefs]);

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: (Platform.OS === 'web' ? webTopInset : insets.top) + 8 }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} testID="notifications-close-button">
          <Ionicons name="close" size={28} color={colors.text} />
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
            <View style={styles.row}>
              <View style={styles.rowLeft}>
                <View style={[styles.iconCircle, { backgroundColor: colors.primary + '18' }]}>
                  <Ionicons name="warning-outline" size={20} color={colors.primary} />
                </View>
                <View style={styles.rowTextContainer}>
                  <Text style={styles.rowTitle}>Budget Alerts</Text>
                  <Text style={styles.rowDescription}>Get notified when spending exceeds budget</Text>
                </View>
              </View>
              <Switch
                value={prefs.budgetAlerts}
                onValueChange={() => handleToggle('budgetAlerts')}
                trackColor={{ false: colors.border, true: colors.primary + '60' }}
                thumbColor={prefs.budgetAlerts ? colors.primary : '#f4f3f4'}
                testID="toggle-budgetAlerts"
              />
            </View>

            <View style={styles.separator} />

            <View style={styles.row}>
              <View style={styles.rowLeft}>
                <View style={[styles.iconCircle, { backgroundColor: '#3B82F618' }]}>
                  <Ionicons name="alarm-outline" size={20} color="#3B82F6" />
                </View>
                <View style={styles.rowTextContainer}>
                  <Text style={styles.rowTitle}>Daily Reminder</Text>
                  <Text style={styles.rowDescription}>Reminder to log your expenses</Text>
                </View>
              </View>
              <Switch
                value={prefs.dailyReminder}
                onValueChange={() => handleToggle('dailyReminder')}
                trackColor={{ false: colors.border, true: colors.primary + '60' }}
                thumbColor={prefs.dailyReminder ? colors.primary : '#f4f3f4'}
                testID="toggle-dailyReminder"
              />
            </View>

            {prefs.dailyReminder ? (
              <>
                <View style={styles.separator} />
                <Pressable
                  style={styles.timeRow}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setShowTimePicker(prev => !prev);
                  }}
                >
                  <View style={styles.rowLeft}>
                    <View style={[styles.iconCircle, { backgroundColor: '#8B5CF618' }]}>
                      <Ionicons name="time-outline" size={20} color="#8B5CF6" />
                    </View>
                    <View style={styles.rowTextContainer}>
                      <Text style={styles.rowTitle}>Reminder Time</Text>
                      <Text style={styles.rowDescription}>When should we remind you?</Text>
                    </View>
                  </View>
                  <View style={styles.timeDisplay}>
                    <Text style={styles.timeText}>{formatTime(prefs.reminderHour, prefs.reminderMinute)}</Text>
                    <Ionicons name={showTimePicker ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textSecondary} />
                  </View>
                </Pressable>
              </>
            ) : null}

            <View style={styles.separator} />

            <View style={styles.row}>
              <View style={styles.rowLeft}>
                <View style={[styles.iconCircle, { backgroundColor: '#F59E0B18' }]}>
                  <Ionicons name="calendar-outline" size={20} color="#F59E0B" />
                </View>
                <View style={styles.rowTextContainer}>
                  <Text style={styles.rowTitle}>Monthly Summary</Text>
                  <Text style={styles.rowDescription}>Monthly spending summary</Text>
                </View>
              </View>
              <Switch
                value={prefs.monthlySummary}
                onValueChange={() => handleToggle('monthlySummary')}
                trackColor={{ false: colors.border, true: colors.primary + '60' }}
                thumbColor={prefs.monthlySummary ? colors.primary : '#f4f3f4'}
                testID="toggle-monthlySummary"
              />
            </View>
          </View>
        </Animated.View>

        {showTimePicker && prefs.dailyReminder ? (
          <Animated.View entering={FadeInDown.duration(300)}>
            <Text style={styles.sectionLabel}>Select Time</Text>
            <View style={styles.card}>
              <ScrollView
                style={styles.timePickerScroll}
                contentContainerStyle={styles.timePickerContent}
                showsVerticalScrollIndicator={false}
              >
                {HOURS.map(hour =>
                  MINUTES.map(minute => {
                    const isSelected = prefs.reminderHour === hour && prefs.reminderMinute === minute;
                    return (
                      <Pressable
                        key={`${hour}-${minute}`}
                        onPress={() => handleTimeSelect(hour, minute)}
                        style={[styles.timeOption, isSelected && styles.timeOptionSelected]}
                      >
                        <Text style={[styles.timeOptionText, isSelected && styles.timeOptionTextSelected]}>
                          {formatTime(hour, minute)}
                        </Text>
                        {isSelected ? (
                          <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
                        ) : null}
                      </Pressable>
                    );
                  })
                )}
              </ScrollView>
            </View>
          </Animated.View>
        ) : null}

        <Animated.View entering={FadeInDown.delay(200).duration(400)}>
          <View style={styles.card}>
            <View style={styles.infoRow}>
              <Ionicons name="information-circle-outline" size={20} color={colors.primary} />
              <Text style={styles.infoText}>
                {Platform.OS === 'web'
                  ? 'Push notifications work on your mobile device via Expo Go. Toggle preferences here and they will take effect on your phone.'
                  : 'Notification preferences are saved locally on this device.'}
              </Text>
            </View>
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
  content: {
    padding: 20,
    gap: 24,
  },
  sectionLabel: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
    color: colors.text,
    marginBottom: 10,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  timeRow: {
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
    color: colors.text,
  },
  rowDescription: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: colors.textSecondary,
    marginTop: 2,
  },
  separator: {
    height: 1,
    backgroundColor: colors.border,
    marginLeft: 64,
  },
  timeDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  timeText: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
    color: colors.primary,
  },
  timePickerScroll: {
    maxHeight: 300,
  },
  timePickerContent: {
    paddingVertical: 4,
  },
  timeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  timeOptionSelected: {
    backgroundColor: colors.primary + '08',
  },
  timeOptionText: {
    fontSize: 15,
    fontFamily: 'Inter_500Medium',
    color: colors.text,
  },
  timeOptionTextSelected: {
    fontFamily: 'Inter_600SemiBold',
    color: colors.primary,
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
    color: colors.textSecondary,
    lineHeight: 20,
  },
});
