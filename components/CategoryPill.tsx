import { Pressable, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';

interface CategoryPillProps {
  label: string;
  icon: string;
  categoryKey: string;
  selected: boolean;
  onPress: () => void;
}

export default function CategoryPill({ label, icon, categoryKey, selected, onPress }: CategoryPillProps) {
  const color = Colors.categories[categoryKey as keyof typeof Colors.categories] || Colors.categories.general;

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
        color={selected ? color : Colors.textSecondary}
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

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.card,
  },
  label: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: Colors.textSecondary,
  },
});
