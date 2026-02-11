import { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Alert,
  Platform,
  ActivityIndicator,
  ScrollView,
  TextInput,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useAudioRecorder, AudioModule, RecordingPresets } from 'expo-audio';
import Animated, {
  FadeIn,
  FadeInDown,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  cancelAnimation,
  Easing,
} from 'react-native-reanimated';
import Colors from '@/constants/colors';
import { getApiUrl } from '@/lib/query-client';
import { addExpense, CATEGORIES, formatPKR, getCategoryLabel, getCategoryIcon } from '@/lib/storage';

type VoiceState = 'idle' | 'recording' | 'processing' | 'result';

interface ExtractedExpense {
  amount: number;
  category: string;
  note: string;
}

interface VoiceResult {
  transcript: string;
  expenses: ExtractedExpense[];
}

export default function VoiceExpenseScreen() {
  const insets = useSafeAreaInsets();
  const [state, setState] = useState<VoiceState>('idle');
  const [result, setResult] = useState<VoiceResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [permissionGranted, setPermissionGranted] = useState<boolean | null>(null);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const durationInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const [editingField, setEditingField] = useState<{ index: number; field: 'amount' | 'note' } | null>(null);
  const [editingValue, setEditingValue] = useState('');
  const [categoryPickerIndex, setCategoryPickerIndex] = useState<number | null>(null);

  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

  const pulseScale = useSharedValue(1);
  const pulseOpacity = useSharedValue(0.3);

  useEffect(() => {
    checkPermission();
    return () => {
      if (durationInterval.current) clearInterval(durationInterval.current);
    };
  }, []);

  const checkPermission = async () => {
    if (Platform.OS === 'web') {
      setPermissionGranted(true);
      return;
    }
    const status = await AudioModule.getRecordingPermissionsAsync();
    setPermissionGranted(status.granted);
  };

  const requestPermission = async () => {
    const status = await AudioModule.requestRecordingPermissionsAsync();
    setPermissionGranted(status.granted);
    if (!status.granted) {
      Alert.alert('Microphone Access', 'Microphone permission is needed to record voice notes.');
    }
  };

  const startRecording = async () => {
    try {
      if (Platform.OS !== 'web') {
        const status = await AudioModule.requestRecordingPermissionsAsync();
        if (!status.granted) {
          setPermissionGranted(false);
          return;
        }
      }

      if (Platform.OS === 'ios') {
        await AudioModule.setAudioModeAsync({
          allowsRecording: true,
          playsInSilentMode: true,
        });
      }

      await audioRecorder.prepareToRecordAsync();
      audioRecorder.record();

      setState('recording');
      setRecordingDuration(0);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      pulseScale.value = withRepeat(
        withSequence(
          withTiming(1.3, { duration: 800, easing: Easing.inOut(Easing.ease) }),
          withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) })
        ),
        -1
      );
      pulseOpacity.value = withRepeat(
        withSequence(
          withTiming(0.6, { duration: 800 }),
          withTiming(0.15, { duration: 800 })
        ),
        -1
      );

      durationInterval.current = setInterval(() => {
        setRecordingDuration(d => d + 1);
      }, 1000);
    } catch (err) {
      console.error('Failed to start recording', err);
      Alert.alert('Error', 'Could not start recording. Please check microphone access.');
    }
  };

  const stopRecording = async () => {
    if (durationInterval.current) {
      clearInterval(durationInterval.current);
      durationInterval.current = null;
    }

    cancelAnimation(pulseScale);
    cancelAnimation(pulseOpacity);
    pulseScale.value = 1;
    pulseOpacity.value = 0.3;

    setState('processing');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      await audioRecorder.stop();
      const uri = audioRecorder.uri;

      if (!uri) {
        throw new Error('No recording URI');
      }

      const formData = new FormData();

      if (Platform.OS === 'web') {
        const response = await globalThis.fetch(uri);
        const blob = await response.blob();
        formData.append('audio', blob, 'recording.webm');
      } else {
        const { File: ExpoFile, Paths } = await import('expo-file-system');
        const sourceFile = new ExpoFile(uri);
        const destFile = new ExpoFile(Paths.cache, 'recording.m4a');
        try { destFile.delete(); } catch {}
        sourceFile.move(destFile);
        formData.append('audio', destFile as any);
      }

      const baseUrl = getApiUrl();
      const apiUrl = new URL('/api/voice-expense', baseUrl).toString();
      const fetchFn = Platform.OS === 'web' ? globalThis.fetch : (await import('expo/fetch')).fetch;

      const res = await fetchFn(apiUrl, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error((errData as any).error || 'Failed to process voice');
      }

      const data = await res.json() as VoiceResult;

      if (!data.expenses && (data as any).amount !== undefined) {
        const legacy = data as any;
        data.expenses = [{ amount: legacy.amount, category: legacy.category, note: legacy.note }];
      }

      setResult(data);
      setState('result');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err: any) {
      console.error('Voice processing error:', err);
      setState('idle');
      Alert.alert('Could Not Process', err.message || 'Something went wrong. Please try again.');
    }
  };

  const handleSaveAll = async () => {
    if (!result || result.expenses.length === 0) return;

    const validExpenses = result.expenses.filter(e => e.amount > 0);
    if (validExpenses.length === 0) {
      Alert.alert('Invalid Amounts', 'No valid amounts could be determined. Please try again or add manually.');
      return;
    }

    setSaving(true);
    try {
      for (const expense of validExpenses) {
        await addExpense({
          amount: expense.amount,
          category: expense.category,
          note: expense.note,
          date: new Date().toISOString(),
        });
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch {
      Alert.alert('Error', 'Failed to save expenses.');
      setSaving(false);
    }
  };

  const handleRetry = () => {
    setResult(null);
    setState('idle');
    setRecordingDuration(0);
    setEditingField(null);
    setCategoryPickerIndex(null);
  };

  const updateExpenseField = (index: number, field: keyof ExtractedExpense, value: string | number) => {
    if (!result) return;
    const updated = [...result.expenses];
    updated[index] = { ...updated[index], [field]: value };
    setResult({ ...result, expenses: updated });
  };

  const startEditField = (index: number, field: 'amount' | 'note') => {
    if (!result) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const expense = result.expenses[index];
    setEditingValue(field === 'amount' ? expense.amount.toString() : (expense.note || ''));
    setEditingField({ index, field });
  };

  const confirmEditField = () => {
    if (!editingField || !result) return;
    const { index, field } = editingField;
    if (field === 'amount') {
      const parsed = parseInt(editingValue.replace(/[^0-9]/g, ''), 10);
      if (parsed > 0) {
        updateExpenseField(index, 'amount', parsed);
      }
    } else {
      updateExpenseField(index, 'note', editingValue.trim());
    }
    setEditingField(null);
    setEditingValue('');
  };

  const openCategoryPicker = (index: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCategoryPickerIndex(index);
  };

  const selectCategory = (catKey: string) => {
    if (categoryPickerIndex === null) return;
    updateExpenseField(categoryPickerIndex, 'category', catKey);
    setCategoryPickerIndex(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const formatDuration = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
    opacity: pulseOpacity.value,
  }));

  const webTopInset = Platform.OS === 'web' ? 67 : 0;

  const totalAmount = result?.expenses.reduce((sum, e) => sum + e.amount, 0) || 0;
  const validCount = result?.expenses.filter(e => e.amount > 0).length || 0;

  if (permissionGranted === false) {
    return (
      <View style={styles.screen}>
        <View style={[styles.header, { paddingTop: (Platform.OS === 'web' ? webTopInset : insets.top) + 8 }]}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="close" size={28} color={Colors.text} />
          </Pressable>
          <Text style={styles.headerTitle}>Voice Expense</Text>
          <View style={{ width: 28 }} />
        </View>
        <View style={styles.permissionContainer}>
          <View style={styles.permissionIconBg}>
            <Ionicons name="mic-off" size={40} color={Colors.textSecondary} />
          </View>
          <Text style={styles.permissionTitle}>Microphone Access Needed</Text>
          <Text style={styles.permissionDesc}>
            Allow microphone access so you can record voice notes for your expenses.
          </Text>
          <Pressable
            onPress={requestPermission}
            style={({ pressed }) => [styles.permissionButton, pressed && { opacity: 0.8 }]}
          >
            <Ionicons name="mic" size={20} color="#fff" />
            <Text style={styles.permissionButtonText}>Allow Microphone</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: (Platform.OS === 'web' ? webTopInset : insets.top) + 8 }]}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="close" size={28} color={Colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Voice Expense</Text>
        <View style={{ width: 28 }} />
      </View>

      {(state === 'idle' || state === 'recording' || state === 'processing') && (
        <View style={[styles.body, { paddingBottom: insets.bottom + 20 }]}>
          {state === 'idle' && (
            <Animated.View entering={FadeIn.duration(400)} style={styles.idleContainer}>
              <Text style={styles.instructionTitle}>Tap to Record</Text>
              <Text style={styles.instructionText}>
                Speak naturally about your expenses.{'\n'}
                You can mention multiple expenses at once!
              </Text>

              <Pressable
                onPress={startRecording}
                style={({ pressed }) => [styles.recordButton, pressed && { transform: [{ scale: 0.95 }] }]}
                testID="start-recording"
              >
                <Ionicons name="mic" size={36} color="#fff" />
              </Pressable>

              <Pressable onPress={() => { router.back(); router.push('/add-expense'); }} style={styles.manualLink}>
                <Ionicons name="create-outline" size={16} color={Colors.primary} />
                <Text style={styles.manualLinkText}>Add manually instead</Text>
              </Pressable>
            </Animated.View>
          )}

          {state === 'recording' && (
            <Animated.View entering={FadeIn.duration(300)} style={styles.recordingContainer}>
              <Text style={styles.recordingLabel}>Listening...</Text>
              <Text style={styles.durationText}>{formatDuration(recordingDuration)}</Text>

              <View style={styles.pulseContainer}>
                <Animated.View style={[styles.pulseRing, pulseStyle]} />
                <Pressable
                  onPress={stopRecording}
                  style={({ pressed }) => [styles.stopButton, pressed && { transform: [{ scale: 0.95 }] }]}
                  testID="stop-recording"
                >
                  <View style={styles.stopSquare} />
                </Pressable>
              </View>

              <Text style={styles.recordingHint}>Tap to stop recording</Text>
            </Animated.View>
          )}

          {state === 'processing' && (
            <Animated.View entering={FadeIn.duration(300)} style={styles.processingContainer}>
              <ActivityIndicator size="large" color={Colors.primary} />
              <Text style={styles.processingText}>Understanding your expenses...</Text>
              <Text style={styles.processingHint}>AI is extracting the details</Text>
            </Animated.View>
          )}
        </View>
      )}

      {state === 'result' && result && (
        <ScrollView
          style={styles.resultScroll}
          contentContainerStyle={[styles.resultContent, { paddingBottom: insets.bottom + 20 }]}
          showsVerticalScrollIndicator={false}
        >
          <Animated.View entering={FadeInDown.duration(400)} style={styles.resultContainer}>
            <View style={styles.transcriptCard}>
              <Ionicons name="chatbubble-ellipses-outline" size={16} color={Colors.textSecondary} />
              <Text style={styles.transcriptText}>"{result.transcript}"</Text>
            </View>

            {result.expenses.length > 1 && (
              <View style={styles.summaryBadge}>
                <Ionicons name="layers-outline" size={16} color={Colors.primary} />
                <Text style={styles.summaryText}>
                  {result.expenses.length} expenses found — Total {formatPKR(totalAmount)}
                </Text>
              </View>
            )}

            {result.expenses.map((expense, index) => (
              <View key={index} style={styles.extractedCard}>
                {result.expenses.length > 1 && (
                  <View style={styles.expenseNumberBadge}>
                    <Text style={styles.expenseNumberText}>{index + 1}</Text>
                  </View>
                )}

                <Pressable
                  onPress={() => startEditField(index, 'amount')}
                  style={({ pressed }) => [styles.extractedRow, styles.editableRow, pressed && styles.editableRowPressed]}
                >
                  <View style={styles.extractedIconBg}>
                    <Ionicons name="cash-outline" size={18} color={Colors.primary} />
                  </View>
                  <View style={styles.extractedDetail}>
                    <Text style={styles.extractedLabel}>Amount</Text>
                    {editingField?.index === index && editingField?.field === 'amount' ? (
                      <TextInput
                        style={styles.inlineInput}
                        value={editingValue}
                        onChangeText={(t) => setEditingValue(t.replace(/[^0-9]/g, ''))}
                        keyboardType="numeric"
                        autoFocus
                        onBlur={confirmEditField}
                        onSubmitEditing={confirmEditField}
                        maxLength={8}
                        selectTextOnFocus
                      />
                    ) : (
                      <Text style={styles.extractedValue}>{formatPKR(expense.amount)}</Text>
                    )}
                  </View>
                  {!(editingField?.index === index && editingField?.field === 'amount') && (
                    <Ionicons name="pencil" size={14} color={Colors.textSecondary} />
                  )}
                </Pressable>

                <View style={styles.extractedDivider} />

                <Pressable
                  onPress={() => openCategoryPicker(index)}
                  style={({ pressed }) => [styles.extractedRow, styles.editableRow, pressed && styles.editableRowPressed]}
                >
                  <View style={styles.extractedIconBg}>
                    <Ionicons
                      name={(CATEGORIES.find(c => c.key === expense.category)?.icon || 'ellipsis-horizontal-circle') as any}
                      size={18}
                      color={Colors.primary}
                    />
                  </View>
                  <View style={styles.extractedDetail}>
                    <Text style={styles.extractedLabel}>Category</Text>
                    <Text style={styles.extractedValue}>{getCategoryLabel(expense.category)}</Text>
                  </View>
                  <Ionicons name="chevron-down" size={16} color={Colors.textSecondary} />
                </Pressable>

                <View style={styles.extractedDivider} />

                <Pressable
                  onPress={() => startEditField(index, 'note')}
                  style={({ pressed }) => [styles.extractedRow, styles.editableRow, pressed && styles.editableRowPressed]}
                >
                  <View style={styles.extractedIconBg}>
                    <Ionicons name="document-text-outline" size={18} color={Colors.primary} />
                  </View>
                  <View style={styles.extractedDetail}>
                    <Text style={styles.extractedLabel}>Note</Text>
                    {editingField?.index === index && editingField?.field === 'note' ? (
                      <TextInput
                        style={styles.inlineInput}
                        value={editingValue}
                        onChangeText={setEditingValue}
                        autoFocus
                        onBlur={confirmEditField}
                        onSubmitEditing={confirmEditField}
                        maxLength={100}
                        placeholder="Add a note..."
                        placeholderTextColor={Colors.textSecondary}
                        selectTextOnFocus
                      />
                    ) : (
                      <Text style={[styles.extractedValue, !expense.note && styles.placeholderNote]}>
                        {expense.note || 'Tap to add note'}
                      </Text>
                    )}
                  </View>
                  {!(editingField?.index === index && editingField?.field === 'note') && (
                    <Ionicons name="pencil" size={14} color={Colors.textSecondary} />
                  )}
                </Pressable>
              </View>
            ))}

            <Pressable
              onPress={handleSaveAll}
              disabled={saving}
              style={({ pressed }) => [
                styles.saveButton,
                pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
                saving && { opacity: 0.6 },
              ]}
              testID="save-voice-expense"
            >
              <Ionicons name="checkmark" size={22} color="#fff" />
              <Text style={styles.saveButtonText}>
                {saving
                  ? 'Saving...'
                  : validCount > 1
                    ? `Save All ${validCount} Expenses`
                    : 'Save Expense'}
              </Text>
            </Pressable>

            <View style={styles.resultActions}>
              <Pressable onPress={handleRetry} style={styles.retryButton} testID="retry-recording">
                <Ionicons name="refresh" size={18} color={Colors.primary} />
                <Text style={styles.retryText}>Try Again</Text>
              </Pressable>
            </View>
          </Animated.View>
        </ScrollView>
      )}

      <Modal
        visible={categoryPickerIndex !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setCategoryPickerIndex(null)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setCategoryPickerIndex(null)}>
          <View style={[styles.modalSheet, { paddingBottom: insets.bottom + 20 }]}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Select Category</Text>
            <ScrollView showsVerticalScrollIndicator={false} style={styles.modalCategoryScroll}>
              {CATEGORIES.map(cat => {
                const isSelected = categoryPickerIndex !== null && result?.expenses[categoryPickerIndex]?.category === cat.key;
                return (
                  <Pressable
                    key={cat.key}
                    onPress={() => selectCategory(cat.key)}
                    style={({ pressed }) => [
                      styles.modalCategoryRow,
                      isSelected && styles.modalCategoryRowSelected,
                      pressed && { opacity: 0.7 },
                    ]}
                  >
                    <View style={[styles.modalCategoryIcon, isSelected && styles.modalCategoryIconSelected]}>
                      <Ionicons name={cat.icon as any} size={20} color={isSelected ? '#fff' : Colors.primary} />
                    </View>
                    <Text style={[styles.modalCategoryLabel, isSelected && styles.modalCategoryLabelSelected]}>
                      {cat.label}
                    </Text>
                    {isSelected && <Ionicons name="checkmark-circle" size={22} color={Colors.primary} />}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
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
  body: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  idleContainer: {
    alignItems: 'center',
    gap: 20,
  },
  instructionTitle: {
    fontSize: 22,
    fontFamily: 'Inter_700Bold',
    color: Colors.text,
    textAlign: 'center',
  },
  instructionText: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 280,
  },
  recordButton: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  manualLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  manualLinkText: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
    color: Colors.primary,
  },
  recordingContainer: {
    alignItems: 'center',
    gap: 16,
  },
  recordingLabel: {
    fontSize: 20,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.primary,
  },
  durationText: {
    fontSize: 40,
    fontFamily: 'Inter_700Bold',
    color: Colors.text,
    letterSpacing: 2,
  },
  pulseContainer: {
    width: 120,
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 12,
  },
  pulseRing: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#E53E3E',
  },
  stopButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#E53E3E',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  stopSquare: {
    width: 24,
    height: 24,
    borderRadius: 4,
    backgroundColor: '#fff',
  },
  recordingHint: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: Colors.textSecondary,
  },
  processingContainer: {
    alignItems: 'center',
    gap: 16,
  },
  processingText: {
    fontSize: 18,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.text,
  },
  processingHint: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: Colors.textSecondary,
  },
  resultScroll: {
    flex: 1,
  },
  resultContent: {
    padding: 20,
  },
  resultContainer: {
    gap: 14,
  },
  transcriptCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: Colors.card,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  transcriptText: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: Colors.textSecondary,
    fontStyle: 'italic',
    lineHeight: 20,
  },
  summaryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.primary + '10',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: Colors.primary + '25',
  },
  summaryText: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.primary,
  },
  extractedCard: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: Colors.primary + '30',
  },
  expenseNumberBadge: {
    position: 'absolute',
    top: -8,
    right: 12,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  expenseNumberText: {
    fontSize: 12,
    fontFamily: 'Inter_700Bold',
    color: '#fff',
  },
  extractedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  extractedIconBg: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.primary + '12',
    alignItems: 'center',
    justifyContent: 'center',
  },
  extractedDetail: {
    flex: 1,
  },
  extractedLabel: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    color: Colors.textSecondary,
    marginBottom: 2,
  },
  extractedValue: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.text,
  },
  extractedDivider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: 12,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    borderRadius: 16,
    padding: 18,
    marginTop: 4,
  },
  saveButtonText: {
    fontSize: 17,
    fontFamily: 'Inter_700Bold',
    color: '#fff',
  },
  resultActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  retryText: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
    color: Colors.primary,
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    gap: 16,
  },
  permissionIconBg: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.border + '60',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  permissionTitle: {
    fontSize: 20,
    fontFamily: 'Inter_700Bold',
    color: Colors.text,
    textAlign: 'center',
  },
  permissionDesc: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 280,
  },
  permissionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 24,
    marginTop: 8,
  },
  permissionButtonText: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    color: '#fff',
  },
  editableRow: {
    borderRadius: 8,
    paddingVertical: 4,
    paddingHorizontal: 4,
    marginHorizontal: -4,
  },
  editableRowPressed: {
    backgroundColor: Colors.primary + '08',
  },
  inlineInput: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.text,
    paddingVertical: 2,
    paddingHorizontal: 0,
    margin: 0,
    borderBottomWidth: 1.5,
    borderBottomColor: Colors.primary,
    minWidth: 80,
  },
  placeholderNote: {
    color: Colors.textSecondary,
    fontFamily: 'Inter_400Regular',
    fontStyle: 'italic' as const,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 12,
    paddingHorizontal: 20,
    maxHeight: '70%' as any,
  },
  modalHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
    alignSelf: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: 'Inter_700Bold',
    color: Colors.text,
    marginBottom: 16,
  },
  modalCategoryScroll: {
    flexGrow: 0,
  },
  modalCategoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 12,
    marginBottom: 2,
  },
  modalCategoryRowSelected: {
    backgroundColor: Colors.primary + '10',
  },
  modalCategoryIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.primary + '12',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCategoryIconSelected: {
    backgroundColor: Colors.primary,
  },
  modalCategoryLabel: {
    flex: 1,
    fontSize: 16,
    fontFamily: 'Inter_500Medium',
    color: Colors.text,
  },
  modalCategoryLabelSelected: {
    fontFamily: 'Inter_600SemiBold',
    color: Colors.primary,
  },
});
