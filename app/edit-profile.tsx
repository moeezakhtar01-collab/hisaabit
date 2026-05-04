import { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  ScrollView,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useColors } from '@/lib/theme-context';
import { useAuth } from '@/lib/auth-context';
import type { lightColors } from '@/constants/colors';

export default function EditProfileScreen() {
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const styles = createStyles(colors);
  const { user, updateProfile, changePassword } = useAuth();

  const [name, setName] = useState(user?.name || '');
  const [nameSaving, setNameSaving] = useState(false);
  const [nameSuccess, setNameSuccess] = useState('');
  const [nameError, setNameError] = useState('');

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const newPasswordRef = useRef<TextInput>(null);
  const confirmPasswordRef = useRef<TextInput>(null);

  const webTopInset = Platform.OS === 'web' ? 67 : 0;
  const webBottomInset = Platform.OS === 'web' ? 34 : 0;

  const handleUpdateName = async () => {
    if (!name.trim()) {
      setNameError('Name cannot be empty');
      setNameSuccess('');
      return;
    }

    setNameSaving(true);
    setNameError('');
    setNameSuccess('');

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await updateProfile(name.trim());
      setNameSuccess('Name updated successfully');
      setTimeout(() => setNameSuccess(''), 3000);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      setNameError(e.message || 'Failed to update name');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setNameSaving(false);
    }
  };

  const handleChangePassword = async () => {
    setPasswordError('');
    setPasswordSuccess('');

    if (!currentPassword) {
      setPasswordError('Please enter your current password');
      return;
    }

    if (newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters');
      return;
    }

    if (!/\d/.test(newPassword)) {
      setPasswordError('New password must include at least one number');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match');
      return;
    }

    setPasswordSaving(true);

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const message = await changePassword(currentPassword, newPassword);
      setPasswordSuccess(message || 'Password changed successfully');
      setTimeout(() => setPasswordSuccess(''), 3000);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      setPasswordError(e.message || 'Failed to change password');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setPasswordSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.header, { paddingTop: (Platform.OS === 'web' ? webTopInset : insets.top) + 8 }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} testID="close-button">
          <Ionicons name="close" size={28} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Edit Profile</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.content, { paddingBottom: (insets.bottom || webBottomInset) + 20 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Animated.View entering={FadeInDown.delay(80).duration(400)} style={styles.summaryCard}>
          <View style={styles.summaryAvatar}>
            <Text style={styles.summaryAvatarText}>
              {(user?.name || 'U').charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={styles.summaryInfo}>
            <Text style={styles.summaryName} numberOfLines={1}>
              {user?.name || 'User'}
            </Text>
            <View style={styles.summaryEmailRow}>
              <Ionicons name="mail-outline" size={13} color={colors.textSecondary} />
              <Text style={styles.summaryEmail} numberOfLines={1}>
                {user?.email || ''}
              </Text>
            </View>
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(120).duration(400)} style={styles.card}>
          <Text style={styles.sectionLabel}>Display name</Text>
          <Text style={styles.sectionHint}>This is how Hisaabit greets you.</Text>
          <View style={styles.nameRow}>
            <TextInput
              style={[styles.input, styles.nameInput]}
              value={name}
              onChangeText={(text) => {
                setName(text);
                setNameError('');
                setNameSuccess('');
              }}
              placeholder="Your name"
              placeholderTextColor={colors.textSecondary}
              autoCapitalize="words"
              returnKeyType="done"
              onSubmitEditing={handleUpdateName}
              testID="name-input"
            />
            <Pressable
              onPress={handleUpdateName}
              disabled={nameSaving || name.trim() === (user?.name || '')}
              style={({ pressed }) => [
                styles.iconButton,
                pressed && { opacity: 0.7 },
                (nameSaving || name.trim() === (user?.name || '')) && { opacity: 0.4 },
              ]}
              testID="save-name-button"
            >
              <Ionicons name="checkmark-circle" size={32} color={colors.primary} />
            </Pressable>
          </View>
          {nameSuccess ? (
            <View style={styles.feedbackRow}>
              <Ionicons name="checkmark-circle" size={14} color={colors.success} />
              <Text style={styles.successText}>{nameSuccess}</Text>
            </View>
          ) : null}
          {nameError ? (
            <View style={styles.feedbackRow}>
              <Ionicons name="alert-circle" size={14} color={colors.danger} />
              <Text style={styles.errorText}>{nameError}</Text>
            </View>
          ) : null}
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(180).duration(400)} style={styles.card}>
          <Text style={styles.sectionLabel}>Change password</Text>
          <Text style={styles.sectionHint}>Use at least 8 characters and include a number.</Text>
          <View style={styles.passwordInputWrap}>
            <Ionicons name="lock-closed-outline" size={18} color={colors.textSecondary} style={styles.passwordIcon} />
            <TextInput
              style={styles.passwordInput}
              value={currentPassword}
              onChangeText={(text) => {
                setCurrentPassword(text);
                setPasswordError('');
                setPasswordSuccess('');
              }}
              placeholder="Current password"
              placeholderTextColor={colors.textSecondary}
              secureTextEntry
              autoCapitalize="none"
              returnKeyType="next"
              onSubmitEditing={() => newPasswordRef.current?.focus()}
              blurOnSubmit={false}
              testID="current-password-input"
            />
          </View>
          <View style={styles.passwordInputWrap}>
            <Ionicons name="key-outline" size={18} color={colors.textSecondary} style={styles.passwordIcon} />
            <TextInput
              ref={newPasswordRef}
              style={styles.passwordInput}
              value={newPassword}
              onChangeText={(text) => {
                setNewPassword(text);
                setPasswordError('');
                setPasswordSuccess('');
              }}
              placeholder="New password (min 6 characters)"
              placeholderTextColor={colors.textSecondary}
              secureTextEntry
              autoCapitalize="none"
              returnKeyType="next"
              onSubmitEditing={() => confirmPasswordRef.current?.focus()}
              blurOnSubmit={false}
              testID="new-password-input"
            />
          </View>
          <View style={styles.passwordInputWrap}>
            <Ionicons name="shield-checkmark-outline" size={18} color={colors.textSecondary} style={styles.passwordIcon} />
            <TextInput
              ref={confirmPasswordRef}
              style={styles.passwordInput}
              value={confirmPassword}
              onChangeText={(text) => {
                setConfirmPassword(text);
                setPasswordError('');
                setPasswordSuccess('');
              }}
              placeholder="Confirm new password"
              placeholderTextColor={colors.textSecondary}
              secureTextEntry
              autoCapitalize="none"
              returnKeyType="go"
              onSubmitEditing={handleChangePassword}
              testID="confirm-password-input"
            />
          </View>
          <Pressable
            onPress={handleChangePassword}
            disabled={passwordSaving}
            style={({ pressed }) => [
              styles.saveButton,
              pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
              passwordSaving && { opacity: 0.6 },
            ]}
            testID="save-password-button"
          >
            <Ionicons name="lock-closed" size={18} color="#fff" />
            <Text style={styles.saveButtonText}>Update password</Text>
          </Pressable>
          {passwordSuccess ? (
            <View style={styles.feedbackRow}>
              <Ionicons name="checkmark-circle" size={14} color={colors.success} />
              <Text style={styles.successText}>{passwordSuccess}</Text>
            </View>
          ) : null}
          {passwordError ? (
            <View style={styles.feedbackRow}>
              <Ionicons name="alert-circle" size={14} color={colors.danger} />
              <Text style={styles.errorText}>{passwordError}</Text>
            </View>
          ) : null}
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(240).duration(400)} style={styles.shortcutCard}>
          <Text style={styles.sectionLabel}>Manage</Text>
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push('/notifications');
            }}
            style={({ pressed }) => [styles.shortcutRow, pressed && { opacity: 0.7 }]}
            testID="shortcut-notifications"
          >
            <View style={[styles.shortcutIconBg, { backgroundColor: '#3B82F618' }]}>
              <Ionicons name="notifications-outline" size={18} color="#3B82F6" />
            </View>
            <View style={styles.shortcutTextWrap}>
              <Text style={styles.shortcutLabel}>Notification preferences</Text>
              <Text style={styles.shortcutSub}>Daily reminders, monthly summary, budget alerts</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
          </Pressable>
          <View style={styles.shortcutDivider} />
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push('/privacy');
            }}
            style={({ pressed }) => [styles.shortcutRow, pressed && { opacity: 0.7 }]}
            testID="shortcut-privacy"
          >
            <View style={[styles.shortcutIconBg, { backgroundColor: '#8B5CF618' }]}>
              <Ionicons name="shield-checkmark-outline" size={18} color="#8B5CF6" />
            </View>
            <View style={styles.shortcutTextWrap}>
              <Text style={styles.shortcutLabel}>Privacy &amp; data</Text>
              <Text style={styles.shortcutSub}>Export, delete, or review what we store</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
          </Pressable>
          <View style={styles.shortcutDivider} />
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push('/help-faq');
            }}
            style={({ pressed }) => [styles.shortcutRow, pressed && { opacity: 0.7 }]}
            testID="shortcut-help"
          >
            <View style={[styles.shortcutIconBg, { backgroundColor: '#F59E0B18' }]}>
              <Ionicons name="help-circle-outline" size={18} color="#F59E0B" />
            </View>
            <View style={styles.shortcutTextWrap}>
              <Text style={styles.shortcutLabel}>Help &amp; FAQ</Text>
              <Text style={styles.shortcutSub}>How voice input works, common questions</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
          </Pressable>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
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
    gap: 14,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 12,
  },
  sectionLabel: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
    color: colors.text,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  nameInput: {
    flex: 1,
  },
  input: {
    backgroundColor: colors.background,
    borderRadius: 14,
    padding: 16,
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
  },
  iconButton: {
    padding: 4,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    borderRadius: 16,
    padding: 16,
    marginTop: 4,
  },
  saveButtonText: {
    fontSize: 15,
    fontFamily: 'Inter_700Bold',
    color: '#fff',
  },
  successText: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    color: colors.success,
  },
  errorText: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    color: colors.danger,
  },
  feedbackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  summaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  summaryAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryAvatarText: {
    fontSize: 22,
    fontFamily: 'Inter_700Bold',
    color: '#fff',
  },
  summaryInfo: {
    flex: 1,
    gap: 4,
  },
  summaryName: {
    fontSize: 17,
    fontFamily: 'Inter_700Bold',
    color: colors.text,
  },
  summaryEmailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  summaryEmail: {
    flex: 1,
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: colors.textSecondary,
  },
  sectionHint: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: colors.textSecondary,
    marginTop: -4,
    lineHeight: 18,
  },
  passwordInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    height: 52,
  },
  passwordIcon: {
    marginRight: 10,
  },
  passwordInput: {
    flex: 1,
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    color: colors.text,
    height: '100%',
  },
  shortcutCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 4,
  },
  shortcutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
  },
  shortcutIconBg: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shortcutTextWrap: {
    flex: 1,
  },
  shortcutLabel: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: colors.text,
  },
  shortcutSub: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: colors.textSecondary,
    marginTop: 2,
  },
  shortcutDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginLeft: 48,
  },
});
