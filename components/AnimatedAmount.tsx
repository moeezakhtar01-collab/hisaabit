import { useState, useEffect, useRef } from 'react';
import { Text, StyleProp, TextStyle } from 'react-native';

interface AnimatedAmountProps {
  value: number;
  formatter: (value: number) => string;
  style?: StyleProp<TextStyle>;
  duration?: number;
}

export default function AnimatedAmount({
  value,
  formatter,
  style,
  duration = 600,
}: AnimatedAmountProps) {
  const [display, setDisplay] = useState(value);
  const displayRef = useRef(value);
  const raf = useRef<number | undefined>(undefined);

  useEffect(() => {
    const from = displayRef.current;
    const to = value;
    if (from === to) return;

    const start = Date.now();
    const animate = () => {
      const elapsed = Date.now() - start;
      const t = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
      const current = Math.round(from + (to - from) * eased);
      displayRef.current = current;
      setDisplay(current);
      if (t < 1) {
        raf.current = requestAnimationFrame(animate);
      }
    };
    raf.current = requestAnimationFrame(animate);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [value, duration]);

  return <Text style={style} numberOfLines={1} adjustsFontSizeToFit>{formatter(display)}</Text>;
}
