import { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { levelLabel } from '@/lib/practice/encouragement';
import { HIDING_LEVELS, NO_BLANKS } from '@/lib/practice/rules';
import { ROUNDS_PER_SET } from '@/lib/practice/session';
import { colors, fonts } from '@/lib/theme';

type HeaderProps = {
  reference: string;
  set: number;
  round: number;
  /** How far through the current round, 0–1. */
  roundProgress: number;
  level: number;
  onClose: () => void;
};

// The plan bar only moves forward through the set's rounds; how much is hidden
// can rise or fall, so it gets its own meter.
export function PracticeHeader({ reference, set, round, roundProgress, level, onClose }: HeaderProps) {
  return (
    <View style={styles.header}>
      <View style={styles.top}>
        <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close">
          <Text style={styles.close}>✕</Text>
        </Pressable>
        <Text style={styles.reference}>{reference}</Text>
        <Text style={styles.round}>
          Round {round} of {ROUNDS_PER_SET}
        </Text>
      </View>
      <View style={styles.plan}>
        {Array.from({ length: ROUNDS_PER_SET }, (_, i) => (
          <PlanSegment key={i} fill={i < round - 1 ? 1 : i === round - 1 ? roundProgress : 0} />
        ))}
      </View>
      <View style={styles.meta}>
        <HiddenMeter level={level} />
        {set > 1 && <Text style={styles.metaText}>Extra practice · doesn't count</Text>}
      </View>
    </View>
  );
}

function PlanSegment({ fill }: { fill: number }) {
  const scale = useRef(new Animated.Value(fill)).current;
  useEffect(() => {
    Animated.timing(scale, {
      toValue: fill,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [fill, scale]);
  return (
    <View style={styles.segment}>
      <Animated.View style={[styles.segmentFill, { transform: [{ scaleX: scale }] }]} />
    </View>
  );
}

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const RADIUS = 7;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/** A ring that fills as more words are hidden, and turns solid at no blanks. */
function HiddenMeter({ level }: { level: number }) {
  const noBlanks = level === NO_BLANKS;
  const fraction = noBlanks ? 1 : HIDING_LEVELS[level];
  const progress = useRef(new Animated.Value(fraction)).current;
  useEffect(() => {
    Animated.timing(progress, {
      toValue: fraction,
      duration: 400,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [fraction, progress]);
  const dashOffset = progress.interpolate({ inputRange: [0, 1], outputRange: [CIRCUMFERENCE, 0] });

  return (
    <View style={styles.meter}>
      {/* Mirrored so the ring fills counter-clockwise from the top. */}
      <Svg width={18} height={18} viewBox="0 0 18 18" style={styles.counterClockwise}>
        <Circle cx={9} cy={9} r={RADIUS} stroke={colors.border} strokeWidth={2.5} fill="none" />
        <AnimatedCircle
          cx={9}
          cy={9}
          r={RADIUS}
          stroke={colors.accent}
          strokeWidth={2.5}
          fill={noBlanks ? colors.accent : 'none'}
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          transform="rotate(-90 9 9)"
        />
      </Svg>
      <Text style={styles.metaText}>{levelLabel(level)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 24, paddingTop: 8, gap: 12 },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  close: { fontSize: 20, color: colors.muted },
  reference: { fontFamily: fonts.serif, fontSize: 17, color: colors.text },
  round: { fontSize: 14, color: colors.muted },
  plan: { flexDirection: 'row', gap: 4 },
  segment: { flex: 1, height: 4, borderRadius: 2, backgroundColor: colors.border, overflow: 'hidden' },
  segmentFill: { flex: 1, backgroundColor: colors.accent, transformOrigin: 'left' },
  meta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  meter: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  counterClockwise: { transform: [{ scaleX: -1 }] },
  metaText: { fontSize: 12, color: colors.muted },
});
