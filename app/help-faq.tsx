import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import Colors from '@/constants/colors';

const FAQ_ITEMS = [
  {
    question: 'How do I add an expense?',
    answer: 'Tap the + button on the home screen. You can enter the amount, select a category, and add a note. You can also use voice input to add expenses by tapping the microphone button.',
  },
  {
    question: 'How does voice input work?',
    answer: "Tap the microphone button, speak your expense in Urdu or English (e.g., 'spent 500 rupees on sabzi'), and the app will automatically extract the amount, category, and details.",
  },
  {
    question: 'How do I set a budget?',
    answer: 'Go to the Budgets tab and tap the + icon next to any category. You can set monthly limits for individual categories or an overall monthly budget.',
  },
  {
    question: 'Is my data safe?',
    answer: 'Yes, your data is stored securely on our servers and is only accessible to you. You can export or delete your data anytime from the Privacy settings.',
  },
  {
    question: 'Can I use the app on multiple devices?',
    answer: 'Yes! Since your data is stored on our servers, you can log in from any device and access your expenses and budgets.',
  },
  {
    question: 'What categories are available?',
    answer: 'Hisaabit includes 13 categories designed for Pakistani households: Kiryana, Sabzi Mandi, Bijli Bill, Gas Bill, Paani Bill, School Fees, Transport, Mobile Recharge, Medical, Chai/Nashta, Kapray, Rent, and General.',
  },
  {
    question: 'How do I change my password?',
    answer: 'Go to Account > Profile and use the Change Password section to update your password.',
  },
];

export default function HelpFAQScreen() {
  const insets = useSafeAreaInsets();
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  const webTopInset = Platform.OS === 'web' ? 67 : 0;
  const webBottomInset = Platform.OS === 'web' ? 34 : 0;

  const handleToggle = (index: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setExpandedIndex(prev => (prev === index ? null : index));
  };

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: (Platform.OS === 'web' ? webTopInset : insets.top) + 8 }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} testID="help-faq-close-button">
          <Ionicons name="close" size={28} color={Colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Help & FAQ</Text>
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
          <Text style={styles.sectionLabel}>Frequently Asked Questions</Text>
          <View style={styles.card}>
            {FAQ_ITEMS.map((item, index) => (
              <View key={index}>
                {index > 0 && <View style={styles.separator} />}
                <Pressable
                  onPress={() => handleToggle(index)}
                  style={({ pressed }) => [
                    styles.questionRow,
                    pressed && { opacity: 0.7 },
                  ]}
                  testID={`faq-item-${index}`}
                >
                  <View style={styles.questionLeft}>
                    <View style={[styles.iconCircle, { backgroundColor: Colors.primary + '18' }]}>
                      <Ionicons name="help-outline" size={18} color={Colors.primary} />
                    </View>
                    <Text style={styles.questionText}>{item.question}</Text>
                  </View>
                  <Ionicons
                    name={expandedIndex === index ? 'chevron-up' : 'chevron-down'}
                    size={18}
                    color={Colors.textSecondary}
                  />
                </Pressable>
                {expandedIndex === index && (
                  <View style={styles.answerContainer}>
                    <Text style={styles.answerText}>{item.answer}</Text>
                  </View>
                )}
              </View>
            ))}
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(200).duration(400)}>
          <View style={styles.card}>
            <View style={styles.infoRow}>
              <Ionicons name="mail-outline" size={20} color={Colors.primary} />
              <Text style={styles.infoText}>
                Still have questions? Reach out to us at support@hisaab.app and we'll get back to you as soon as possible.
              </Text>
            </View>
          </View>
        </Animated.View>
      </ScrollView>
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
    color: Colors.text,
    marginBottom: 10,
  },
  card: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  questionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  questionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    marginRight: 12,
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  questionText: {
    fontSize: 15,
    fontFamily: 'Inter_500Medium',
    color: Colors.text,
    flex: 1,
  },
  answerContainer: {
    paddingHorizontal: 16,
    paddingBottom: 14,
    paddingLeft: 60,
  },
  answerText: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  separator: {
    height: 1,
    backgroundColor: Colors.border,
    marginLeft: 60,
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
    color: Colors.textSecondary,
    lineHeight: 20,
  },
});
