import { useState } from 'react';
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

    if (newPassword.length < 6) {
      setPasswordError('New password must be at least 6 characters');
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
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={90}
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
        <Animated.View entering={FadeInDown.delay(100).duration(400)} style={styles.card}>
          <Text style={styles.sectionLabel}>Name</Text>
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
              testID="name-input"
            />
            <Pressable
              onPress={handleUpdateName}
              disabled={nameSaving}
              style={({ pressed }) => [
                styles.iconButton,
                pressed && { opacity: 0.7 },
                nameSaving && { opacity: 0.5 },
              ]}
              testID="save-name-button"
            >
              <Ionicons name="checkmark-circle" size={32} color={colors.primary} />
            </Pressable>
          </View>
          {nameSuccess ? (
            <Text style={styles.successText}>{nameSuccess}</Text>
          ) : null}
          {nameError ? (
            <Text style={styles.errorText}>{nameError}</Text>
          ) : null}
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(200).duration(400)} style={styles.card}>
          <Text style={styles.sectionLabel}>Change Password</Text>
          <TextInput
            style={styles.input}
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
            testID="current-password-input"
          />
          <TextInput
            style={styles.input}
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
            testID="new-password-input"
          />
          <TextInput
            style={styles.input}
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
            testID="confirm-password-input"
          />
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
            <Ionicons name="checkmark" size={22} color="#fff" />
          </Pressable>
          {passwordSuccess ? (
            <Text style={styles.successText}>{passwordSuccess}</Text>
          ) : null}
          {passwordError ? (
            <Text style={styles.errorText}>{passwordError}</Text>
          ) : null}
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
    gap: 24,
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
    backgroundColor: colors.primary,
    borderRadius: 16,
    padding: 16,
    marginTop: 4,
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
});
