import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Platform,
  AppState,
  type AppStateStatus,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { router, useFocusEffect } from 'expo-router';
import { useColors } from '@/lib/theme-context';
import type { ThemeColors } from '@/constants/colors';
import {
  getCapturedNotifications,
  clearCapturedNotifications,
  type CapturedNotification,
} from '@/lib/notification-task';
import { hasNotificationAccess, openNotificationAccessSettings } from '@/lib/notification-listener';

/**
 * PHASE 0 spike screen — TEMPORARY. Proves the notification listener captures
 * bank/wallet notifications on a real device (under SDK 54 + New Architecture),
 * and surfaces the raw {package, title, text} so we can build accurate on-device
 * parser patterns. Remove once Phase 1 (parse + auto-save) lands.
 */
export default function NotifDebugScreen() {
  const colors = useColors();
  const styles = createStyles(colors);
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<CapturedNotification[]>([]);
  const [granted, setGranted] = useState(false);
  const appState = useRef(AppState.currentState);

  const refresh = useCallback(async () => {
    const [captured, access] = await Promise.all([
      getCapturedNotifications(),
      hasNotificationAccess(),
    ]);
    setItems(captured);
    setGranted(access);
  }, []);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  // Re-check after the user returns from Android Settings.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (appState.current.match(/inactive|background/) && next === 'active') {
        refresh();
      }
      appState.current = next;
    });
    return () => sub.remove();
  }, [refresh]);

  const fmtTime = (ms: number) => {
    if (!ms) return '—';
    try {
      return new Date(ms).toLocaleString('en-GB', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return '—';
    }
  };

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.closeBtn}>
          <Ionicons name="close" size={22} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Capture Debug</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.statusRow}>
        <View style={[styles.statusPill, { backgroundColor: (granted ? colors.success : colors.warning) + '18' }]}>
          <Ionicons
            name={granted ? 'shield-checkmark' : 'shield-outline'}
            size={14}
            color={granted ? colors.success : colors.warning}
          />
          <Text style={[styles.statusText, { color: granted ? colors.success : colors.warning }]}>
            {granted ? 'Access granted' : 'Access NOT granted'}
          </Text>
        </View>
        <Text style={styles.countText}>{items.length} captured</Text>
      </View>

      {Platform.OS !== 'android' && (
        <View style={styles.noticeBox}>
          <Ionicons name="information-circle-outline" size={16} color={colors.textSecondary} />
          <Text style={styles.noticeText}>
            Notification capture is Android-only. Build & run this on your phone to test.
          </Text>
        </View>
      )}

      <View style={styles.actionRow}>
        {!granted && (
          <Pressable
            onPress={async () => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              await openNotificationAccessSettings();
            }}
            style={({ pressed }) => [styles.actionBtn, styles.primaryBtn, pressed && { opacity: 0.85 }]}
          >
            <Ionicons name="settings-outline" size={16} color="#fff" />
            <Text style={styles.primaryBtnText}>Grant Access</Text>
          </Pressable>
        )}
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            refresh();
          }}
          style={({ pressed }) => [styles.actionBtn, styles.secondaryBtn, pressed && { opacity: 0.7 }]}
        >
          <Ionicons name="refresh" size={16} color={colors.primary} />
          <Text style={styles.secondaryBtnText}>Refresh</Text>
        </Pressable>
        <Pressable
          onPress={async () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            await clearCapturedNotifications();
            refresh();
          }}
          style={({ pressed }) => [styles.actionBtn, styles.secondaryBtn, pressed && { opacity: 0.7 }]}
        >
          <Ionicons name="trash-outline" size={16} color={colors.danger} />
          <Text style={[styles.secondaryBtnText, { color: colors.danger }]}>Clear</Text>
        </Pressable>
      </View>

      <ScrollView
        style={styles.list}
        contentContainerStyle={{ paddingBottom: insets.bottom + 24, gap: 8 }}
        showsVerticalScrollIndicator={false}
      >
        {items.length === 0 ? (
          <View style={styles.emptyBox}>
            <Ionicons name="notifications-off-outline" size={32} color={colors.textSecondary} />
            <Text style={styles.emptyText}>No notifications captured yet</Text>
            <Text style={styles.emptySub}>
              Grant access, then trigger any notification (a test bank transaction, or any app).
              Pull back here and tap Refresh.
            </Text>
          </View>
        ) : (
          items.map((n, i) => (
            <View key={`${n.capturedAt}-${i}`} style={styles.card}>
              <View style={styles.cardTop}>
                <Text style={styles.cardApp} numberOfLines={1}>{n.app || 'unknown.package'}</Text>
                <Text style={styles.cardTime}>{fmtTime(n.time || n.capturedAt)}</Text>
              </View>
              {!!n.title && <Text style={styles.cardTitle} numberOfLines={2}>{n.title}</Text>}
              {!!n.text && <Text style={styles.cardText}>{n.text}</Text>}
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
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
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 14,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  statusText: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  countText: { fontSize: 12, fontFamily: 'Inter_500Medium', color: colors.textSecondary },
  noticeBox: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    backgroundColor: colors.surface,
    marginHorizontal: 16,
    marginTop: 12,
    padding: 12,
    borderRadius: 10,
  },
  noticeText: { flex: 1, fontSize: 12, fontFamily: 'Inter_400Regular', color: colors.textSecondary, lineHeight: 17 },
  actionRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingVertical: 14 },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  primaryBtn: { backgroundColor: colors.primary },
  primaryBtnText: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: '#fff' },
  secondaryBtn: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  secondaryBtnText: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: colors.primary },
  list: { flex: 1, paddingHorizontal: 16 },
  emptyBox: { alignItems: 'center', gap: 8, paddingVertical: 48, paddingHorizontal: 24 },
  emptyText: { fontSize: 15, fontFamily: 'Inter_600SemiBold', color: colors.text },
  emptySub: { fontSize: 13, fontFamily: 'Inter_400Regular', color: colors.textSecondary, textAlign: 'center', lineHeight: 19 },
  card: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 4,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  cardApp: { flex: 1, fontSize: 12, fontFamily: 'Inter_600SemiBold', color: colors.primary },
  cardTime: { fontSize: 11, fontFamily: 'Inter_400Regular', color: colors.textSecondary },
  cardTitle: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: colors.text },
  cardText: { fontSize: 13, fontFamily: 'Inter_400Regular', color: colors.text, lineHeight: 19 },
});
