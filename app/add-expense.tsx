import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  ScrollView,
  Alert,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import Colors from '@/constants/colors';
import CategoryPill from '@/components/CategoryPill';
import { addExpense, updateExpense, CATEGORIES, formatPKR } from '@/lib/storage';

const QUICK_AMOUNTS = [100, 250, 500, 1000, 2500, 5000];

export default function AddExpenseScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    editId?: string;
    editAmount?: string;
    editCategory?: string;
    editNote?: string;
    editDate?: string;
  }>();

  const isEditing = !!params.editId;

  const [amount, setAmount] = useState(params.editAmount || '');
  const [selectedCategory, setSelectedCategory] = useState(params.editCategory || '');
  const [note, setNote] = useState(params.editNote || '');
  const [saving, setSaving] = useState(false);

  const handleAmountChange = (text: string) => {
    const cleaned = text.replace(/[^0-9]/g, '');
    setAmount(cleaned);
  };

  const handleQuickAmount = (value: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setAmount(value.toString());
  };

  const handleSave = async () => {
    if (!amount || parseInt(amount) <= 0) {
      Alert.alert('Enter Amount', 'Please enter a valid amount');
      return;
    }
    if (!selectedCategory) {
      Alert.alert('Select Category', 'Please choose a category for this expense');
      return;
    }

    setSaving(true);
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      if (isEditing) {
        await updateExpense(params.editId!, {
          amount: parseInt(amount, 10),
          category: selectedCategory,
          note: note.trim(),
          date: params.editDate || new Date().toISOString(),
        });
      } else {
        await addExpense({
          amount: parseInt(amount, 10),
          category: selectedCategory,
          note: note.trim(),
          date: new Date().toISOString(),
        });
      }
      router.back();
    } catch {
      Alert.alert('Error', `Failed to ${isEditing ? 'update' : 'save'} expense. Please try again.`);
      setSaving(false);
    }
  };

  const webTopInset = Platform.OS === 'web' ? 67 : 0;

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={90}
    >
      <View style={[styles.header, { paddingTop: (Platform.OS === 'web' ? webTopInset : insets.top) + 8 }]}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="close" size={28} color={Colors.text} />
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
          <Text style={styles.currencyLabel}>PKR</Text>
          <TextInput
            style={styles.amountInput}
            value={amount}
            onChangeText={handleAmountChange}
            keyboardType="numeric"
            placeholder="0"
            placeholderTextColor={Colors.border}
            autoFocus
            maxLength={8}
          />
          {amount ? (
            <Animated.Text entering={FadeIn.duration(200)} style={styles.amountFormatted}>
              {formatPKR(parseInt(amount) || 0)}
            </Animated.Text>
          ) : null}
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
            placeholder="e.g. Weekly groceries from Imtiaz"
            placeholderTextColor={Colors.textSecondary}
            multiline
            maxLength={100}
          />
        </Animated.View>

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
              {saving ? 'Saving...' : isEditing ? 'Update Expense' : 'Save Expense'}
            </Text>
          </Pressable>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
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
  amountSection: {
    alignItems: 'center',
    paddingVertical: 16,
    gap: 4,
  },
  currencyLabel: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.textSecondary,
    letterSpacing: 2,
  },
  amountInput: {
    fontSize: 48,
    fontFamily: 'Inter_700Bold',
    color: Colors.text,
    textAlign: 'center',
    minWidth: 120,
    paddingHorizontal: 20,
  },
  amountFormatted: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
    color: Colors.primary,
  },
  sectionLabel: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.text,
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
    borderColor: Colors.border,
    backgroundColor: Colors.card,
  },
  quickAmountSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary + '12',
  },
  quickAmountText: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.textSecondary,
  },
  quickAmountTextSelected: {
    color: Colors.primary,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  noteInput: {
    backgroundColor: Colors.card,
    borderRadius: 14,
    padding: 16,
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
    minHeight: 56,
    textAlignVertical: 'top',
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    borderRadius: 16,
    padding: 18,
    marginTop: 8,
  },
  saveButtonText: {
    fontSize: 17,
    fontFamily: 'Inter_700Bold',
    color: '#fff',
  },
});
