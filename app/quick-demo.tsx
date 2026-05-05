import { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeInDown, FadeInUp } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useAuth } from '@/lib/auth-context';
import { useColors } from '@/lib/theme-context';

const TOTAL_SLIDES = 5;
const BG = '#0A0A0A';
const TEXT_PRIMARY = '#FFFFFF';
const TEXT_DIM = 'rgba(255,255,255,0.5)';
const TEXT_SOFT = 'rgba(255,255,255,0.7)';

type SlideProps = {
  accent: string;
  userName?: string;
};

function WelcomeSlide({ accent, userName }: SlideProps) {
  return (
    <View style={s.center} pointerEvents="box-none">
      <Animated.Text entering={FadeInDown.delay(200).duration(600)} style={s.hookSmall}>
        Welcome to
      </Animated.Text>
      <Animated.Text entering={FadeInDown.delay(400).duration(600)} style={s.hookBig}>
        Hisaabit
      </Animated.Text>
      <Animated.Text entering={FadeIn.delay(800).duration(600)} style={[s.hookDate, { color: accent }]}>
        {userName ? `Salaam, ${userName}` : 'Your kharcha, asaan'}
      </Animated.Text>
      <Animated.Text entering={FadeIn.delay(1200).duration(500)} style={s.welcomeBody}>
        Let&apos;s show you around{'\n'}in 30 seconds
      </Animated.Text>
      <Animated.Text entering={FadeIn.delay(1700).duration(600)} style={s.tapHint}>
        Tap to continue
      </Animated.Text>
    </View>
  );
}

function ManualExpenseSlide({ accent }: SlideProps) {
  return (
    <View style={s.center} pointerEvents="box-none">
      <Animated.View entering={FadeInDown.delay(200).duration(500)} style={[s.iconBubble, { backgroundColor: accent + '22' }]}>
        <Ionicons name="add" size={48} color={accent} />
      </Animated.View>
      <Animated.Text entering={FadeInDown.delay(450).duration(500)} style={[s.slideTitle, { color: accent }]}>
        Log expenses manually
      </Animated.Text>
      <Animated.Text entering={FadeIn.delay(750).duration(500)} style={s.slideBody}>
        Tap the{'  '}
        <Text style={[s.inlineIcon, { color: accent }]}>+</Text>
        {'  '}button on the home screen to add an expense.
      </Animated.Text>
      <Animated.Text entering={FadeIn.delay(1050).duration(500)} style={s.slideSubtle}>
        Pick a category, enter the amount in Rupees, add a note — done.
      </Animated.Text>
    </View>
  );
}

function VoiceExpenseSlide({ accent }: SlideProps) {
  return (
    <View style={s.center} pointerEvents="box-none">
      <Animated.View entering={FadeInDown.delay(200).duration(500)} style={[s.iconBubble, { backgroundColor: accent + '22' }]}>
        <Ionicons name="mic" size={44} color={accent} />
      </Animated.View>
      <Animated.Text entering={FadeInDown.delay(450).duration(500)} style={[s.slideTitle, { color: accent }]}>
        Speak your kharcha
      </Animated.Text>
      <Animated.Text entering={FadeIn.delay(750).duration(500)} style={s.slideBody}>
        Hit the mic and just talk — Urdu, Roman Urdu, or English all work.
      </Animated.Text>
      <Animated.View entering={FadeIn.delay(1050).duration(500)} style={[s.tipCard, { borderColor: accent + '55', backgroundColor: accent + '12' }]}>
        <Ionicons name="sparkles" size={16} color={accent} />
        <Text style={[s.tipText, { color: accent }]}>
          Pro tip: log multiple expenses in one recording
        </Text>
      </Animated.View>
      <Animated.Text entering={FadeIn.delay(1350).duration(500)} style={s.slideSubtle}>
        {'\u201C'}Kiryana paanch sau, chai sau{'\u201D'} → two expenses, one tap.
      </Animated.Text>
    </View>
  );
}

function BudgetsSlide({ accent }: SlideProps) {
  return (
    <View style={s.center} pointerEvents="box-none">
      <Animated.View entering={FadeInDown.delay(200).duration(500)} style={[s.iconBubble, { backgroundColor: accent + '22' }]}>
        <Ionicons name="pie-chart" size={44} color={accent} />
      </Animated.View>
      <Animated.Text entering={FadeInDown.delay(450).duration(500)} style={[s.slideTitle, { color: accent }]}>
        Set your budgets
      </Animated.Text>
      <Animated.Text entering={FadeIn.delay(750).duration(500)} style={s.slideBody}>
        Daily, weekly, and monthly limits — plus per-category caps.
      </Animated.Text>
      <Animated.Text entering={FadeIn.delay(1050).duration(500)} style={s.slideSubtle}>
        Hisaabit warns you before you overshoot, not after.
      </Animated.Text>
    </View>
  );
}

function WeeklyHisaabSlide({
  accent,
  onFinish,
  isReplay,
}: SlideProps & { onFinish: () => void; isReplay: boolean }) {
  return (
    <View style={s.center} pointerEvents="box-none">
      <Animated.View entering={FadeInDown.delay(200).duration(500)} style={[s.iconBubble, { backgroundColor: accent + '22' }]}>
        <Ionicons name="sparkles" size={44} color={accent} />
      </Animated.View>
      <Animated.Text entering={FadeInDown.delay(450).duration(500)} style={[s.slideTitle, { color: accent }]}>
        Your Weekly Hisaab
      </Animated.Text>
      <Animated.Text entering={FadeIn.delay(750).duration(500)} style={s.slideBody}>
        Every week, a story-style recap of how you spent — with insights you&apos;ll actually read.
      </Animated.Text>
      <Animated.Text entering={FadeIn.delay(1050).duration(500)} style={s.slideSubtle}>
        Find it on the home screen once you&apos;ve logged a few days.
      </Animated.Text>
      <Animated.View entering={FadeInUp.delay(1400).duration(500)} style={s.ctaWrap}>
        <Pressable
          onPress={onFinish}
          style={({ pressed }) => [
            s.ctaBtn,
            { backgroundColor: accent },
            pressed && { opacity: 0.85, transform: [{ scale: 0.97 }] },
          ]}
        >
          <Text style={s.ctaText}>{isReplay ? 'Done' : "Let's Go"}</Text>
          <Ionicons name="arrow-forward" size={18} color="#fff" />
        </Pressable>
      </Animated.View>
    </View>
  );
}

// ─── Main screen ────────────────────────────────────────────────

export default function QuickDemoScreen() {
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const { user, markDemoSeen } = useAuth();
  const [index, setIndex] = useState(0);

  const accents = [colors.primary, '#10B981', '#3B82F6', '#F59E0B', '#EC4899'];
  const accent = accents[index];
  const isReplay = !!user?.hasSeenDemo;

  const advance = useCallback(() => {
    setIndex((i) => {
      if (i < TOTAL_SLIDES - 1) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        return i + 1;
      }
      return i;
    });
  }, []);

  const goBack = useCallback(() => {
    setIndex((i) => {
      if (i > 0) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        return i - 1;
      }
      return i;
    });
  }, []);

  const exit = useCallback(() => {
    // First-run: AuthGate used router.replace('/quick-demo'), so no history → go home.
    // Replay: user pushed from Account, so back returns them to where they came from.
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
    }
  }, []);

  const finish = useCallback(async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await markDemoSeen();
    exit();
  }, [markDemoSeen, exit]);

  const skip = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await markDemoSeen();
    exit();
  }, [markDemoSeen, exit]);

  function renderSlide() {
    switch (index) {
      case 0:
        return <WelcomeSlide accent={accent} userName={user?.name?.split(' ')[0]} />;
      case 1:
        return <ManualExpenseSlide accent={accent} />;
      case 2:
        return <VoiceExpenseSlide accent={accent} />;
      case 3:
        return <BudgetsSlide accent={accent} />;
      case 4:
        return <WeeklyHisaabSlide accent={accent} onFinish={finish} isReplay={isReplay} />;
      default:
        return null;
    }
  }

  const isLast = index === TOTAL_SLIDES - 1;

  return (
    <View style={s.screen}>
      <StatusBar barStyle="light-content" />
      <View style={[s.glow, { backgroundColor: accent + '06' }]} />

      {/* Tap zones — behind content */}
      <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
        <View style={s.tapRow} pointerEvents="box-none">
          {!isLast && (
            <>
              <Pressable style={s.tapBack} onPress={goBack} />
              <Pressable style={s.tapForward} onPress={advance} />
            </>
          )}
        </View>
      </View>

      {/* Progress segments */}
      <View style={[s.progressBar, { paddingTop: insets.top + 12 }]}>
        {Array.from({ length: TOTAL_SLIDES }).map((_, i) => (
          <View
            key={i}
            style={[
              s.progressSeg,
              { backgroundColor: i <= index ? '#fff' : 'rgba(255,255,255,0.18)' },
            ]}
          />
        ))}
      </View>

      {/* Skip */}
      <Pressable
        style={[s.skipBtn, { top: insets.top + 28 }]}
        onPress={skip}
        hitSlop={16}
      >
        <Text style={s.skipText}>Skip</Text>
      </Pressable>

      {/* Slide content (above tap areas so the CTA receives touches) */}
      <View style={s.slideWrap} pointerEvents="box-none">
        <Animated.View
          key={index}
          entering={FadeIn.duration(300)}
          style={{ flex: 1 }}
          pointerEvents="box-none"
        >
          {renderSlide()}
        </Animated.View>
      </View>
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────────────

const s = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: BG,
  },
  glow: {
    ...StyleSheet.absoluteFillObject,
  },

  // Progress
  progressBar: {
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: 12,
    paddingBottom: 8,
    zIndex: 10,
  },
  progressSeg: {
    flex: 1,
    height: 3,
    borderRadius: 1.5,
  },

  // Skip
  skipBtn: {
    position: 'absolute',
    right: 16,
    zIndex: 20,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  skipText: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: TEXT_SOFT,
  },

  // Tap areas
  tapRow: {
    flex: 1,
    flexDirection: 'row',
  },
  tapBack: { flex: 3 },
  tapForward: { flex: 7 },

  // Content
  slideWrap: {
    flex: 1,
    zIndex: 5,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },

  // Welcome
  hookSmall: {
    fontSize: 22,
    fontFamily: 'Inter_500Medium',
    color: TEXT_SOFT,
  },
  hookBig: {
    fontSize: 44,
    fontFamily: 'Inter_700Bold',
    color: TEXT_PRIMARY,
    marginBottom: 16,
  },
  hookDate: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    marginBottom: 28,
  },
  welcomeBody: {
    fontSize: 16,
    fontFamily: 'Inter_500Medium',
    color: TEXT_DIM,
    textAlign: 'center',
    lineHeight: 24,
  },
  tapHint: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    color: TEXT_DIM,
    position: 'absolute',
    bottom: 60,
  },

  // Feature slides
  iconBubble: {
    width: 96,
    height: 96,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
  },
  slideTitle: {
    fontSize: 28,
    fontFamily: 'Inter_700Bold',
    textAlign: 'center',
    marginBottom: 16,
  },
  slideBody: {
    fontSize: 17,
    fontFamily: 'Inter_500Medium',
    color: TEXT_PRIMARY,
    textAlign: 'center',
    lineHeight: 26,
    marginBottom: 12,
  },
  slideSubtle: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: TEXT_DIM,
    textAlign: 'center',
    lineHeight: 21,
    marginTop: 4,
  },
  inlineIcon: {
    fontSize: 20,
    fontFamily: 'Inter_700Bold',
  },

  // Voice tip pill
  tipCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 16,
    marginBottom: 12,
  },
  tipText: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    flexShrink: 1,
  },

  // CTA
  ctaWrap: {
    marginTop: 36,
    width: '100%',
  },
  ctaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
    borderRadius: 14,
  },
  ctaText: {
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
    color: '#fff',
  },
});
