import { Pressable, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/lib/theme-context';
import { type ThemeColors } from '@/constants/colors';

interface CategoryPillProps {
  label: string;
  icon: string;
  categoryKey: string;
  selected: boolean;
  onPress: () => void;
}

export default function CategoryPill({ label, icon, categoryKey, selected, onPress }: CategoryPillProps) {
  const colors = useColors();
  const styles = createStyles(colors);
  const color = colors.categories[categoryKey as keyof typeof colors.categories] || colors.categories.general;

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  };

  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => [
        styles.pill,
        selected && { backgroundColor: color + '18', borderColor: color },
        pressed && { opacity: 0.7 },
      ]}
    >
      <Ionicons
        name={icon as any}
        size={16}
        color={selected ? color : colors.textSecondary}
      />
      <Text
        style={[
          styles.label,
          selected && { color, fontFamily: 'Inter_600SemiBold' },
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  label: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: colors.textSecondary,
  },
});
