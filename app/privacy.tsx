import { useState } from 'react';
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
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useColors } from '@/lib/theme-context';
import { useAuth } from '@/lib/auth-context';
import type { lightColors } from '@/constants/colors';
import { getApiUrl } from '@/lib/query-client';
import { fetch } from 'expo/fetch';

export default function PrivacyScreen() {
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const styles = createStyles(colors);
  const { deleteAccount } = useAuth();
  const [exporting, setExporting] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleting, setDeleting] = useState(false);

  const webTopInset = Platform.OS === 'web' ? 67 : 0;
  const webBottomInset = Platform.OS === 'web' ? 34 : 0;

  const handleExport = async () => {
    setExporting(true);
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const baseUrl = getApiUrl();
      const res = await fetch(new URL('/api/auth/export', baseUrl).toString(), {
        credentials: 'include',
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Export failed');
      }
      const data = await res.json();
      const expenseCount = data.expenses?.length ?? 0;
      const budgetCount = data.budgets?.length ?? 0;
      Alert.alert(
        'Data Exported',
        `Found ${expenseCount} expense(s) and ${budgetCount} budget(s).\n\n${JSON.stringify(data, null, 2)}`,
      );
    } catch (err: any) {
      Alert.alert('Export Failed', err.message || 'Something went wrong');
    } finally {
      setExporting(false);
    }
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'Are you sure you want to permanently delete your account? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Continue',
          style: 'destructive',
          onPress: () => {
            setDeletePassword('');
            setShowDeleteModal(true);
          },
        },
      ],
    );
  };

  const confirmDelete = async () => {
    if (!deletePassword.trim()) {
      Alert.alert('Password Required', 'Please enter your password to confirm.');
      return;
    }
    setDeleting(true);
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      await deleteAccount(deletePassword);
      setShowDeleteModal(false);
      router.replace('/login');
    } catch (err: any) {
      Alert.alert('Delete Failed', err.message || 'Could not delete account.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: (Platform.OS === 'web' ? webTopInset : insets.top) + 8 }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} testID="privacy-close-button">
          <Ionicons name="close" size={28} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Privacy & Data</Text>
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
          <Text style={styles.sectionLabel}>Data Management</Text>
          <View style={styles.card}>
            <Pressable
              onPress={handleExport}
              disabled={exporting}
              style={({ pressed }) => [
                styles.row,
                pressed && { opacity: 0.7 },
                exporting && { opacity: 0.6 },
              ]}
              testID="export-data-button"
            >
              <View style={styles.rowLeft}>
                <View style={[styles.iconCircle, { backgroundColor: colors.success + '18' }]}>
                  <Ionicons name="download-outline" size={20} color={colors.success} />
                </View>
                <Text style={styles.rowText}>Export My Data</Text>
              </View>
              {exporting ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
              )}
            </Pressable>

            <View style={styles.separator} />

            <Pressable
              onPress={handleDeleteAccount}
              style={({ pressed }) => [
                styles.row,
                pressed && { opacity: 0.7 },
              ]}
              testID="delete-account-button"
            >
              <View style={styles.rowLeft}>
                <View style={[styles.iconCircle, { backgroundColor: colors.danger + '18' }]}>
                  <Ionicons name="trash-outline" size={20} color={colors.danger} />
                </View>
                <Text style={[styles.rowText, { color: colors.danger }]}>Delete Account</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
            </Pressable>
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(200).duration(400)}>
          <Text style={styles.sectionLabel}>Information</Text>
          <View style={styles.card}>
            <View style={styles.infoRow}>
              <Ionicons name="shield-checkmark-outline" size={20} color={colors.primary} />
              <Text style={styles.infoText}>
                Your data is stored securely on our servers. You can export or delete your data at any time.
              </Text>
            </View>
            <View style={styles.separator} />
            <View style={styles.infoRow}>
              <Ionicons name="lock-closed-outline" size={20} color={colors.primary} />
              <Text style={styles.infoText}>
                Your expenses, budgets, and account information are only accessible to you.
              </Text>
            </View>
          </View>
        </Animated.View>
      </ScrollView>

      <Modal
        visible={showDeleteModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDeleteModal(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => !deleting && setShowDeleteModal(false)}
        >
          <Pressable style={styles.modalContent} onPress={() => {}}>
            <Text style={styles.modalTitle}>Confirm Deletion</Text>
            <Text style={styles.modalDescription}>
              Enter your password to permanently delete your account.
            </Text>
            <TextInput
              style={styles.modalInput}
              value={deletePassword}
              onChangeText={setDeletePassword}
              placeholder="Password"
              placeholderTextColor={colors.textSecondary}
              secureTextEntry
              autoFocus
              editable={!deleting}
              testID="delete-password-input"
            />
            <View style={styles.modalButtons}>
              <Pressable
                onPress={() => setShowDeleteModal(false)}
                disabled={deleting}
                style={({ pressed }) => [
                  styles.modalButton,
                  styles.modalCancelButton,
                  pressed && { opacity: 0.7 },
                ]}
                testID="delete-cancel-button"
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={confirmDelete}
                disabled={deleting}
                style={({ pressed }) => [
                  styles.modalButton,
                  styles.modalDeleteButton,
                  pressed && { opacity: 0.9 },
                  deleting && { opacity: 0.6 },
                ]}
                testID="delete-confirm-button"
              >
                {deleting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.modalDeleteText}>Delete</Text>
                )}
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
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
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: {
    fontSize: 15,
    fontFamily: 'Inter_500Medium',
    color: colors.text,
  },
  separator: {
    height: 1,
    backgroundColor: colors.border,
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
    color: colors.textSecondary,
    lineHeight: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  modalContent: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 360,
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: 'Inter_700Bold',
    color: colors.text,
    marginBottom: 8,
  },
  modalDescription: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: colors.textSecondary,
    marginBottom: 16,
    lineHeight: 20,
  },
  modalInput: {
    backgroundColor: colors.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    color: colors.text,
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelButton: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalCancelText: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
    color: colors.text,
  },
  modalDeleteButton: {
    backgroundColor: colors.danger,
  },
  modalDeleteText: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
    color: '#FFFFFF',
  },
});
