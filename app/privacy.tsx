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
import * as Sharing from 'expo-sharing';
import { Paths, File } from 'expo-file-system';
import * as WebBrowser from 'expo-web-browser';

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

  const openFullPolicy = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const baseUrl = getApiUrl();
    const url = new URL('/privacy', baseUrl).toString();
    try {
      await WebBrowser.openBrowserAsync(url);
    } catch {
      Alert.alert('Could not open', url);
    }
  };

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

      // Write the export to a file and hand off to the native share sheet.
      // Previously we dumped the raw JSON into an Alert, which was unreadable
      // for users with more than a handful of expenses and leaked all data
      // into the task-switcher screenshot.
      const stamp = new Date().toISOString().slice(0, 10);
      const filename = `Hisaabit-export-${stamp}.json`;
      const file = new File(Paths.cache, filename);
      file.create({ overwrite: true });
      file.write(JSON.stringify(data, null, 2));

      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(file.uri, {
          mimeType: 'application/json',
          dialogTitle: 'Export My Data',
          UTI: 'public.json',
        });
      } else {
        Alert.alert(
          'Data Exported',
          `Saved ${expenseCount} expense(s) and ${budgetCount} budget(s) to ${filename}.`,
        );
      }
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
          <Text style={styles.sectionLabel}>What we store</Text>
          <View style={styles.card}>
            <View style={styles.infoRow}>
              <Ionicons name="person-outline" size={20} color={colors.primary} />
              <Text style={styles.infoText}>
                Your name, email, and a hashed password — used only to sign you in.
              </Text>
            </View>
            <View style={styles.separator} />
            <View style={styles.infoRow}>
              <Ionicons name="receipt-outline" size={20} color={colors.primary} />
              <Text style={styles.infoText}>
                Expenses and budgets you add, linked to your account. We never share them with third parties.
              </Text>
            </View>
            <View style={styles.separator} />
            <View style={styles.infoRow}>
              <Ionicons name="server-outline" size={20} color={colors.primary} />
              <Text style={styles.infoText}>
                Data is stored on Railway (our cloud host) inside a private Postgres database, accessed over HTTPS.
              </Text>
            </View>
            <View style={styles.separator} />
            <View style={styles.infoRow}>
              <Ionicons name="key-outline" size={20} color={colors.primary} />
              <Text style={styles.infoText}>
                A signed session cookie keeps you logged in. No location, contacts, SMS or photos are collected.
              </Text>
            </View>
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(250).duration(400)}>
          <Text style={styles.sectionLabel}>Voice expenses</Text>
          <View style={styles.card}>
            <View style={styles.infoRow}>
              <Ionicons name="mic-outline" size={20} color={colors.primary} />
              <Text style={styles.infoText}>
                When you record a voice expense, the audio is sent to OpenAI&apos;s Whisper API for transcription and to GPT-4o-mini to pull out amount, category, and date. Only the extracted fields and transcript are saved — the audio file is deleted from our server right after processing.
              </Text>
            </View>
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(300).duration(400)}>
          <Text style={styles.sectionLabel}>Your controls</Text>
          <View style={styles.card}>
            <View style={styles.infoRow}>
              <Ionicons name="download-outline" size={20} color={colors.primary} />
              <Text style={styles.infoText}>
                Export — download a full copy of your expenses and budgets as a JSON file any time.
              </Text>
            </View>
            <View style={styles.separator} />
            <View style={styles.infoRow}>
              <Ionicons name="trash-outline" size={20} color={colors.primary} />
              <Text style={styles.infoText}>
                Delete — removing your account permanently wipes your expenses, budgets, and login details from our database. This cannot be undone.
              </Text>
            </View>
            <View style={styles.separator} />
            <View style={styles.infoRow}>
              <Ionicons name="globe-outline" size={20} color={colors.primary} />
              <Text style={styles.infoText}>
                Uninstalled the app? You can still delete your account at hisaabit-production.up.railway.app/account-deletion
              </Text>
            </View>
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(350).duration(400)}>
          <Pressable
            onPress={openFullPolicy}
            style={({ pressed }) => [
              styles.policyLink,
              pressed && { opacity: 0.6 },
            ]}
            testID="full-policy-link"
          >
            <Text style={styles.policyLinkText}>View full Privacy Policy</Text>
            <Ionicons name="open-outline" size={16} color={colors.primary} />
          </Pressable>
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
  policyLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
  },
  policyLinkText: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
    color: colors.primary,
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
