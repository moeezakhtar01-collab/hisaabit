import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

/**
 * v2 report notifications — the re-engagement payoff. Schedules on-device LOCAL
 * notifications (no push server) that pull the user back to their summary:
 *   - Weekly: Sunday 7pm  → "Your weekly Hisaab is ready"
 *   - Monthly: 1st, 9am   → "Your monthly Hisaab"
 * Tapping deep-links to /weekly-report (handled by the listener in _layout).
 *
 * The old notifications screen set the foreground handler, but it isn't loaded
 * in v2, so we set it here (imported early from _layout).
 */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

const REPORT_KIND = 'report';

/**
 * Idempotently (re)schedule the weekly + monthly report notifications. Requests
 * notification permission if needed. Only touches our own scheduled
 * notifications (tagged via data.kind), so it won't clobber anything else.
 * No-op on web. Safe to call on every launch.
 */
export async function ensureReportNotifications(): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    let granted = (await Notifications.getPermissionsAsync()).status === 'granted';
    if (!granted) {
      granted = (await Notifications.requestPermissionsAsync()).status === 'granted';
    }
    if (!granted) return;

    // Remove our previously-scheduled report pings, then reschedule fresh.
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    await Promise.all(
      scheduled
        .filter((n) => (n.content.data as any)?.kind === REPORT_KIND)
        .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
    );

    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Your weekly Hisaab is ready ✨',
        body: 'See where your money went this week.',
        data: { kind: REPORT_KIND, target: '/weekly-report' },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
        weekday: 1, // 1 = Sunday
        hour: 19,
        minute: 0,
      },
    });

    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Your monthly Hisaab',
        body: "A new month — here's how last month went.",
        data: { kind: REPORT_KIND, target: '/weekly-report' },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.MONTHLY,
        day: 1,
        hour: 9,
        minute: 0,
      },
    });
  } catch {
    // Non-fatal — scheduling failures shouldn't affect the app.
  }
}
