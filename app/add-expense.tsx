import { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  ScrollView,
  Platform,
  KeyboardAvoidingView,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { useColors } from '@/lib/theme-context';
import { type ThemeColors } from '@/constants/colors';
import CategoryPill from '@/components/CategoryPill';
import { addExpense, updateExpense, CATEGORIES, formatPKR } from '@/lib/storage';
import { useAuth } from '@/lib/auth-context';
import { maybeShowInterstitial } from '@/lib/ad-manager';

const QUICK_AMOUNTS = [100, 250, 500, 1000, 2500, 5000];

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function formatDateLabel(date: Date): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);

  if (target.getTime() === today.getTime()) return 'Today';
  if (target.getTime() === yesterday.getTime()) return 'Yesterday';

  return `${DAYS_OF_WEEK[date.getDay()]}, ${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

// 90 days of backfill range. Pakistani users routinely log expenses
// from the previous month or two (rent receipts, utility bills, etc.).
// 30 days was forcing them to give up.
const DATE_PICKER_DAYS = 90;

function generateDateOptions(): Date[] {
  const dates: Date[] = [];
  const today = new Date();
  for (let i = 0; i < DATE_PICKER_DAYS; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    d.setHours(12, 0, 0, 0);
    dates.push(d);
  }
  return dates;
}

export default function AddExpenseScreen() {
  const colors = useColors();
  const styles = createStyles(colors);
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const params = useLocalSearchParams<{
    editId?: string;
    editAmount?: string;
    editCategory?: string;
    editNote?: string;
    editDate?: string;
    date?: string;
  }>();

  const isEditing = !!params.editId;

  const [amount, setAmount] = useState(params.editAmount || '');
  const [selectedCategory, setSelectedCategory] = useState(params.editCategory || '');
  const [note, setNote] = useState(params.editNote || '');
  const [selectedDate, setSelectedDate] = useState<Date>(() => {
    if (params.editDate) return new Date(params.editDate);
    if (params.date) {
      const [y, m, d] = params.date.split('-').map(Number);
      return new Date(y, m - 1, d, 12, 0, 0);
    }
    return new Date();
  });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [saving, setSaving] = useState(false);
  // Inline form error (replaces the previous Alert.alert popups). Cleared
  // on every input change so the user gets immediate feedback.
  const [formError, setFormError] = useState<string | null>(null);
  // Brief overlay shown after a successful save, before router.back().
  // Adds visible confirmation that haptic alone doesn't provide on
  // Android (where the buzz can be subtle on some devices).
  const [savedFlash, setSavedFlash] = useState(false);
  const dateOptions = useMemo(() => generateDateOptions(), []);

  const handleAmountChange = (text: string) => {
    const cleaned = text.replace(/[^0-9]/g, '');
    setAmount(cleaned);
    if (formError) setFormError(null);
  };

  const handleQuickAmount = (value: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setAmount(value.toString());
  };

  const handleDateSelect = (date: Date) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedDate(date);
    setShowDatePicker(false);
  };

  const handleSave = async () => {
    if (!amount || parseInt(amount) <= 0) {
      setFormError('Enter an amount greater than zero');
      return;
    }
    if (!selectedCategory) {
      setFormError('Choose a category for this expense');
      return;
    }
    setFormError(null);

    setSaving(true);
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      const expenseDate = new Date(selectedDate);
      const dateStr = `${expenseDate.getFullYear()}-${String(expenseDate.getMonth() + 1).padStart(2, '0')}-${String(expenseDate.getDate()).padStart(2, '0')}`;

      if (isEditing) {
        await updateExpense(params.editId!, {
          amount: parseInt(amount, 10),
          category: selectedCategory,
          note: note.trim(),
          date: dateStr,
        });
      } else {
        await addExpense({
          amount: parseInt(amount, 10),
          category: selectedCategory,
          note: note.trim(),
          date: dateStr,
        });
      }

      // Show interstitial ad every 4th save (if ads not removed)
      await maybeShowInterstitial(user?.adsRemoved);

      // Brief visual confirmation. ~700ms is the sweet spot — long
      // enough to register, short enough not to feel like a delay.
      setSavedFlash(true);
      setTimeout(() => router.back(), 700);
    } catch (err: any) {
      setFormError(err?.message || `Couldn’t ${isEditing ? 'update' : 'save'} expense. Please try again.`);
      setSaving(false);
    }
  };

  const webTopInset = Platform.OS === 'web' ? 67 : 0;
  const isToday = formatDateLabel(selectedDate) === 'Today';

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <View style={[styles.header, { paddingTop: (Platform.OS === 'web' ? webTopInset : insets.top) + 8 }]}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="close" size={28} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>{isEditing ? 'Edit Expense' : 'Add Expense'}</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 20 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Animated.View entering={FadeIn.duration(400)} style={styles.amountSection}>
          <Text style={styles.currencyLabel}>Rs.</Text>
          <TextInput
            style={styles.amountInput}
            value={amount}
            onChangeText={handleAmountChange}
            keyboardType="numeric"
            placeholder="0"
            placeholderTextColor={colors.border}
            autoFocus
            maxLength={8}
          />
          {amount ? (
            <Animated.Text entering={FadeIn.duration(200)} style={styles.amountFormatted}>
              {formatPKR(parseInt(amount) || 0)}
            </Animated.Text>
          ) : null}
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(50).duration(400)}>
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setShowDatePicker(true);
            }}
            style={({ pressed }) => [
              styles.dateSelector,
              pressed && { opacity: 0.7 },
            ]}
          >
            <Ionicons name="calendar-outline" size={18} color={isToday ? colors.textSecondary : colors.primary} />
            <Text style={[styles.dateSelectorText, !isToday && { color: colors.primary }]}>
              {formatDateLabel(selectedDate)}
            </Text>
            <Ionicons name="chevron-down" size={16} color={colors.textSecondary} />
          </Pressable>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(100).duration(400)}>
          <Text style={styles.sectionLabel}>Quick Amount</Text>
          <View style={styles.quickAmountRow}>
            {QUICK_AMOUNTS.map(val => (
              <Pressable
                key={val}
                onPress={() => handleQuickAmount(val)}
                style={({ pressed }) => [
                  styles.quickAmountButton,
                  amount === val.toString() && styles.quickAmountSelected,
                  pressed && { opacity: 0.7 },
                ]}
              >
                <Text
                  style={[
                    styles.quickAmountText,
                    amount === val.toString() && styles.quickAmountTextSelected,
                  ]}
                >
                  {val.toLocaleString()}
                </Text>
              </Pressable>
            ))}
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(200).duration(400)}>
          <Text style={styles.sectionLabel}>Category</Text>
          <View style={styles.categoryGrid}>
            {CATEGORIES.map(cat => (
              <CategoryPill
                key={cat.key}
                label={cat.label}
                icon={cat.icon}
                categoryKey={cat.key}
                selected={selectedCategory === cat.key}
                onPress={() => setSelectedCategory(cat.key)}
              />
            ))}
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(300).duration(400)}>
          <Text style={styles.sectionLabel}>Note (Optional)</Text>
          <TextInput
            style={styles.noteInput}
            value={note}
            onChangeText={setNote}
            placeholder="e.g. Weekly groceries"
            placeholderTextColor={colors.textSecondary}
            multiline
            maxLength={100}
          />
        </Animated.View>

        {formError ? (
          <Animated.View entering={FadeIn.duration(180)} style={styles.formErrorBox}>
            <Ionicons name="alert-circle" size={16} color={colors.danger} />
            <Text style={styles.formErrorText} numberOfLines={2}>{formError}</Text>
          </Animated.View>
        ) : null}

        <Animated.View entering={FadeInDown.delay(400).duration(400)}>
          <Pressable
            onPress={handleSave}
            disabled={saving}
            style={({ pressed }) => [
              styles.saveButton,
              pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
              saving && { opacity: 0.6 },
            ]}
          >
            <Ionicons name="checkmark" size={22} color="#fff" />
            <Text style={styles.saveButtonText}>
              {saving ? 'Saving…' : isEditing ? 'Update' : 'Save'}
            </Text>
          </Pressable>
        </Animated.View>
      </ScrollView>

      {savedFlash ? (
        <Animated.View entering={FadeIn.duration(180)} style={styles.savedFlashOverlay} pointerEvents="none">
          <View style={styles.savedFlashCard}>
            <View style={styles.savedFlashIconBg}>
              <Ionicons name="checkmark" size={32} color="#fff" />
            </View>
            <Text style={styles.savedFlashText}>Saved</Text>
          </View>
        </Animated.View>
      ) : null}

      <Modal
        visible={showDatePicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDatePicker(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowDatePicker(false)}>
          <Pressable style={[styles.datePickerContainer, { paddingBottom: insets.bottom + 16 }]} onPress={e => e.stopPropagation()}>
            <View style={styles.datePickerHeader}>
              <Text style={styles.datePickerTitle}>Select Date</Text>
              <Pressable onPress={() => setShowDatePicker(false)} hitSlop={12}>
                <Ionicons name="close" size={24} color={colors.text} />
              </Pressable>
            </View>
            <ScrollView style={styles.dateList} showsVerticalScrollIndicator={false}>
              {dateOptions.map((date, index) => {
                const label = formatDateLabel(date);
                const isSelected = date.toDateString() === selectedDate.toDateString();
                return (
                  <Pressable
                    key={index}
                    onPress={() => handleDateSelect(date)}
                    style={({ pressed }) => [
                      styles.dateOption,
                      isSelected && styles.dateOptionSelected,
                      pressed && { opacity: 0.7 },
                    ]}
                  >
                    <Text style={[styles.dateOptionText, isSelected && styles.dateOptionTextSelected]}>
                      {label}
                    </Text>
                    {isSelected && (
                      <Ionicons name="checkmark-circle" size={22} color={colors.primary} />
                    )}
                  </Pressable>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
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
  amountSection: {
    alignItems: 'center',
    paddingVertical: 16,
    gap: 4,
  },
  currencyLabel: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: colors.textSecondary,
    letterSpacing: 2,
  },
  amountInput: {
    fontSize: 48,
    fontFamily: 'Inter_700Bold',
    color: colors.text,
    textAlign: 'center',
    minWidth: 120,
    paddingHorizontal: 20,
  },
  amountFormatted: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
    color: colors.primary,
  },
  dateSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dateSelectorText: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: colors.textSecondary,
  },
  sectionLabel: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
    color: colors.text,
    marginBottom: 10,
  },
  quickAmountRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  quickAmountButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  quickAmountSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + '12',
  },
  quickAmountText: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: colors.textSecondary,
  },
  quickAmountTextSelected: {
    color: colors.primary,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  noteInput: {
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 16,
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 56,
    textAlignVertical: 'top',
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    borderRadius: 16,
    padding: 18,
    marginTop: 8,
  },
  saveButtonText: {
    fontSize: 17,
    fontFamily: 'Inter_700Bold',
    color: '#fff',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  datePickerContainer: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '60%',
    paddingTop: 16,
  },
  datePickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  datePickerTitle: {
    fontSize: 17,
    fontFamily: 'Inter_700Bold',
    color: colors.text,
  },
  dateList: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  dateOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    marginVertical: 2,
  },
  dateOptionSelected: {
    backgroundColor: colors.primary + '12',
  },
  dateOptionText: {
    fontSize: 15,
    fontFamily: 'Inter_500Medium',
    color: colors.text,
  },
  dateOptionTextSelected: {
    fontFamily: 'Inter_700Bold',
    color: colors.primary,
  },
  formErrorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.danger + '12',
    borderColor: colors.danger + '30',
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginHorizontal: 20,
    marginTop: -8,
    marginBottom: 4,
  },
  formErrorText: {
    flex: 1,
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    color: colors.danger,
  },
  savedFlashOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  savedFlashCard: {
    backgroundColor: colors.card,
    borderRadius: 20,
    paddingVertical: 28,
    paddingHorizontal: 36,
    alignItems: 'center',
    gap: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 12,
  },
  savedFlashIconBg: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
  savedFlashText: {
    fontSize: 17,
    fontFamily: 'Inter_700Bold',
    color: colors.text,
    letterSpacing: 0.3,
  },
});
