import { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Alert,
  Platform,
  Modal,
  TextInput,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { router, Redirect } from 'expo-router';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useColors } from '@/lib/theme-context';
import { type ThemeColors } from '@/constants/colors';
import CategoryPill from '@/components/CategoryPill';
import PendingExpenseCard from '@/components/PendingExpenseCard';
import { CATEGORIES } from '@/lib/storage';
import {
  PendingExpense,
  getPendingSmsExpenses,
  confirmPendingExpense,
  dismissPendingExpense,
  confirmAllPending,
  dismissAllPending,
  updatePendingExpense,
} from '@/lib/sms-storage';
import { SMS_ENABLED } from '@/lib/feature-flags';

export default function SmsExpensesScreen() {
  const colors = useColors();
  const styles = createStyles(colors);
  const insets = useSafeAreaInsets();
  const [expenses, setExpenses] = useState<PendingExpense[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [editingExpense, setEditingExpense] = useState<PendingExpense | null>(null);
  const [editAmount, setEditAmount] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editNote, setEditNote] = useState('');
  const [showSmsBody, setShowSmsBody] = useState(false);

  const loadPending = useCallback(async () => {
    const data = await getPendingSmsExpenses();
    setExpenses(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadPending();
  }, [loadPending]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadPending();
    setRefreshing(false);
  }, [loadPending]);

  if (!SMS_ENABLED) {
    return <Redirect href="/(tabs)" />;
  }

  const handleConfirm = async (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await confirmPendingExpense(id);
      setExpenses(prev => prev.filter(e => e.id !== id));
    } catch {
      Alert.alert('Error', 'Failed to confirm expense');
    }
  };

  const handleDismiss = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert('Dismiss Expense', 'Are you sure you want to dismiss this expense?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Dismiss',
        style: 'destructive',
        onPress: async () => {
          try {
            await dismissPendingExpense(id);
            setExpenses(prev => prev.filter(e => e.id !== id));
          } catch {
            Alert.alert('Error', 'Failed to dismiss expense');
          }
        },
      },
    ]);
  };

  const handleConfirmAll = () => {
    if (expenses.length === 0) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      'Confirm All',
      `Add all ${expenses.length} expense${expenses.length > 1 ? 's' : ''} to your records?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm All',
          onPress: async () => {
            try {
              await confirmAllPending();
              setExpenses([]);
            } catch {
              Alert.alert('Error', 'Failed to confirm expenses');
            }
          },
        },
      ]
    );
  };

  const handleDismissAll = () => {
    if (expenses.length === 0) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert('Dismiss All', 'Dismiss all pending expenses? This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Dismiss All',
        style: 'destructive',
        onPress: async () => {
          try {
            await dismissAllPending();
            setExpenses([]);
          } catch {
            Alert.alert('Error', 'Failed to dismiss expenses');
          }
        },
      },
    ]);
  };

  const handleEdit = (expense: PendingExpense) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setEditingExpense(expense);
    setEditAmount(String(expense.amount));
    setEditCategory(expense.category);
    setEditNote(expense.note || '');
    setShowSmsBody(false);
  };

  const handleSaveEdit = async () => {
    if (!editingExpense) return;
    const amount = parseInt(editAmount, 10);
    if (!amount || amount <= 0) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }
    try {
      const updated = await updatePendingExpense(editingExpense.id, {
        amount,
        category: editCategory,
        note: editNote,
      });
      setExpenses(prev => prev.map(e => (e.id === editingExpense.id ? updated : e)));
      setEditingExpense(null);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      Alert.alert('Error', 'Failed to update expense');
    }
  };

  const webTopInset = Platform.OS === 'web' ? 20 : 0;

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
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>SMS Expenses</Text>
          {expenses.length > 0 && (
            <View style={styles.countBadge}>
              <Text style={styles.countBadgeText}>{expenses.length}</Text>
            </View>
          )}
        </View>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>Loading...</Text>
        </View>
      ) : expenses.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="checkmark-circle" size={56} color={colors.success + '60'} />
          <Text style={styles.emptyTitle}>All caught up!</Text>
          <Text style={styles.emptyText}>No pending SMS expenses to review.</Text>
        </View>
      ) : (
        <>
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={{ paddingBottom: 120 }}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
            }
          >
            <Animated.View entering={FadeIn.duration(300)}>
              <Text style={styles.subtitle}>
                Bank transactions detected from your SMS. Review and confirm to add to your expenses.
              </Text>
            </Animated.View>

            {expenses.map((expense, index) => (
              <PendingExpenseCard
                key={expense.id}
                expense={expense}
                onConfirm={handleConfirm}
                onDismiss={handleDismiss}
                onEdit={handleEdit}
                index={index}
              />
            ))}
          </ScrollView>

          {/* Bottom actions */}
          <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 16) }]}>
            <Pressable
              style={({ pressed }) => [styles.bottomBtn, styles.dismissAllBtn, pressed && { opacity: 0.7 }]}
              onPress={handleDismissAll}
            >
              <Ionicons name="trash-outline" size={18} color={colors.danger} />
              <Text style={[styles.bottomBtnText, { color: colors.danger }]}>Dismiss All</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.bottomBtn, styles.confirmAllBtn, pressed && { opacity: 0.7 }]}
              onPress={handleConfirmAll}
            >
              <Ionicons name="checkmark-done" size={18} color="#fff" />
              <Text style={[styles.bottomBtnText, { color: '#fff' }]}>Confirm All</Text>
            </Pressable>
          </View>
        </>
      )}

      {/* Edit Modal */}
      <Modal visible={!!editingExpense} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <Pressable style={styles.modalBackdrop} onPress={() => setEditingExpense(null)} />
          <View style={[styles.modalContent, { paddingBottom: Math.max(insets.bottom, 20) }]}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Edit Expense</Text>

            {/* Amount */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Amount (Rs.)</Text>
              <TextInput
                style={styles.input}
                value={editAmount}
                onChangeText={setEditAmount}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor={colors.textSecondary}
              />
            </View>

            {/* Category */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Category</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
                {CATEGORIES.map((cat) => (
                  <CategoryPill
                    key={cat.key}
                    label={cat.label}
                    icon={cat.icon}
                    categoryKey={cat.key}
                    selected={editCategory === cat.key}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setEditCategory(cat.key);
                    }}
                  />
                ))}
              </ScrollView>
            </View>

            {/* Note */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Note</Text>
              <TextInput
                style={styles.input}
                value={editNote}
                onChangeText={setEditNote}
                placeholder="Add a note..."
                placeholderTextColor={colors.textSecondary}
              />
            </View>

            {/* Original SMS */}
            {editingExpense?.smsBody && (
              <Pressable
                style={styles.smsToggle}
                onPress={() => setShowSmsBody(!showSmsBody)}
              >
                <Ionicons
                  name={showSmsBody ? 'chevron-up' : 'chevron-down'}
                  size={16}
                  color={colors.textSecondary}
                />
                <Text style={styles.smsToggleText}>Original SMS</Text>
              </Pressable>
            )}
            {showSmsBody && editingExpense?.smsBody && (
              <View style={styles.smsBodyContainer}>
                <Text style={styles.smsBodyText}>{editingExpense.smsBody}</Text>
              </View>
            )}

            {/* Save / Cancel */}
            <View style={styles.modalActions}>
              <Pressable
                style={({ pressed }) => [styles.modalBtn, styles.modalCancelBtn, pressed && { opacity: 0.7 }]}
                onPress={() => setEditingExpense(null)}
              >
                <Text style={[styles.modalBtnText, { color: colors.textSecondary }]}>Cancel</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.modalBtn, styles.modalSaveBtn, pressed && { opacity: 0.7 }]}
                onPress={handleSaveEdit}
              >
                <Text style={[styles.modalBtnText, { color: '#fff' }]}>Save</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
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
  headerCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: 'Inter_700Bold',
    color: colors.text,
  },
  countBadge: {
    backgroundColor: colors.warning,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    minWidth: 22,
    alignItems: 'center',
  },
  countBadgeText: {
    fontSize: 12,
    fontFamily: 'Inter_700Bold',
    color: '#fff',
  },
  scrollView: {
    flex: 1,
  },
  subtitle: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: colors.textSecondary,
    paddingHorizontal: 20,
    paddingVertical: 14,
    lineHeight: 19,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontFamily: 'Inter_700Bold',
    color: colors.text,
  },
  emptyText: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: colors.textSecondary,
    textAlign: 'center',
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  bottomBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 6,
  },
  dismissAllBtn: {
    backgroundColor: colors.danger + '10',
    borderWidth: 1,
    borderColor: colors.danger + '30',
  },
  confirmAllBtn: {
    backgroundColor: colors.success,
  },
  bottomBtnText: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
  },
  // Edit Modal
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  modalContent: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    maxHeight: '85%',
  },
  modalHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: 'Inter_700Bold',
    color: colors.text,
    marginBottom: 20,
  },
  fieldGroup: {
    marginBottom: 16,
    gap: 6,
  },
  fieldLabel: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  input: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    fontFamily: 'Inter_500Medium',
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
  },
  categoryScroll: {
    marginTop: 4,
  },
  smsToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
  },
  smsToggleText: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    color: colors.textSecondary,
  },
  smsBodyContainer: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  smsBodyText: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: colors.textSecondary,
    lineHeight: 18,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  modalBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 12,
  },
  modalCancelBtn: {
    backgroundColor: colors.surface,
  },
  modalSaveBtn: {
    backgroundColor: colors.primary,
  },
  modalBtnText: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
  },
});
