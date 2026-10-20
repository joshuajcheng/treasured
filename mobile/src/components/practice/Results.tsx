import { useEffect, useRef, type ReactNode } from 'react';
import { Animated, Easing, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Body, Button, Title } from '@/components/ui';
import { levelLabel, percent, roundMessage, sessionHeading, sessionLines } from '@/lib/practice/encouragement';
import { NO_BLANKS } from '@/lib/practice/rules';
import type { Passage } from '@/lib/practice/samples';
import type { RoundSummary } from '@/lib/practice/session';
import { colors, fonts } from '@/lib/theme';

type RoundCardProps = {
  summary: RoundSummary;
  /** The round before it in the same set, for "up from 70% last round". */
  previous: RoundSummary | undefined;
  onNext: () => void;
};

/** Shown between rounds. */
export function RoundCard({ summary, previous, onNext }: RoundCardProps) {
  let next = 'Same amount hidden next round.';
  if (summary.nextLevel === NO_BLANKS) next = 'Next round has no blanks.';
  else if (summary.nextLevel > summary.level) next = 'Hiding more words next round.';
  else if (summary.nextLevel < summary.level) next = 'Hiding fewer words next round.';

  return (
    <Appear style={styles.card}>
      <Text style={styles.score}>{percent(summary.accuracy)}</Text>
      <Text style={styles.message}>{roundMessage(summary, previous)}</Text>
      <Body muted>
        {countLine(summary.typos, summary.wrong)} · {next}
      </Body>
      <Button label="Next round" onPress={onNext} />
    </Appear>
  );
}

type SetSummaryProps = {
  passage: Passage;
  set: number;
  rounds: RoundSummary[];
  durationMs: number;
  onKeepPracticing: () => void;
  onDone: () => void;
};

/** Shown when a set's rounds are used up or a no-blanks round is done. */
export function SetSummary({ passage, set, rounds, durationMs, onKeepPracticing, onDone }: SetSummaryProps) {
  const setRounds = rounds.filter((r) => r.set === set);
  const typos = setRounds.reduce((n, r) => n + r.typos, 0);
  const wrong = setRounds.reduce((n, r) => n + r.wrong, 0);

  return (
    <ScrollView contentContainerStyle={styles.summary}>
      <Appear style={styles.summaryInner}>
        <Title>{sessionHeading(setRounds, set)}</Title>
        {sessionLines(passage.reference, durationMs, setRounds).map((line) => (
          <Text key={line} style={styles.message}>
            {line}
          </Text>
        ))}

        <View style={styles.table}>
          {setRounds.map((r) => (
            <View key={r.round} style={styles.row}>
              <Text style={styles.rowLabel}>Round {r.round}</Text>
              <Text style={styles.rowLevel}>{levelLabel(r.level)}</Text>
              <Text style={[styles.rowScore, r.perfect && styles.rowPerfect]}>{percent(r.accuracy)}</Text>
            </View>
          ))}
          <Text style={styles.totals}>{countLine(typos, wrong)}</Text>
        </View>

        <View style={styles.passage}>
          <Text style={styles.reference}>{passage.reference}</Text>
          <Text style={styles.passageText}>
            {passage.verses.map((v) => (
              <Text key={v.number}>
                <Text style={styles.verseNumber}>{v.number} </Text>
                {v.text}{' '}
              </Text>
            ))}
          </Text>
        </View>
        <Body muted>
          {set === 1
            ? "Practice preview: progress isn't saved yet."
            : "Extra practice doesn't count toward your progress."}
        </Body>
        <Button label="Keep practicing" onPress={onKeepPracticing} />
        <Button label="Done" variant="secondary" onPress={onDone} />
      </Appear>
    </ScrollView>
  );
}

/**
 * Fades and lifts its children in when first shown. JS driver, because the
 * keyboard closes at the same moment and the relayout would otherwise reset it.
 */
function Appear({ style, children }: { style: object; children: ReactNode }) {
  const shown = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(shown, {
      toValue: 1,
      duration: 240,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [shown]);
  const translateY = shown.interpolate({ inputRange: [0, 1], outputRange: [12, 0] });
  return <Animated.View style={[style, { opacity: shown, transform: [{ translateY }] }]}>{children}</Animated.View>;
}

function countLine(typos: number, wrong: number) {
  return `${typos} ${typos === 1 ? 'typo' : 'typos'} · ${wrong} wrong`;
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 24,
    marginBottom: 16,
    padding: 20,
    gap: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#FFFFFF',
  },
  score: { fontFamily: fonts.serif, fontSize: 40, color: colors.text },
  message: { fontFamily: fonts.serif, fontSize: 18, lineHeight: 26, color: colors.text },
  summary: { padding: 24 },
  summaryInner: { gap: 16 },
  table: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#FFFFFF',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  rowLabel: { flex: 1, fontSize: 15, color: colors.text },
  rowLevel: { flex: 1, fontSize: 14, color: colors.muted },
  rowScore: { width: 56, textAlign: 'right', fontSize: 15, fontWeight: '600', color: colors.text },
  rowPerfect: { color: colors.accent },
  totals: { paddingTop: 10, paddingBottom: 2, fontSize: 13, color: colors.muted },
  passage: { gap: 6, paddingVertical: 8 },
  reference: { fontFamily: fonts.serif, fontSize: 17, color: colors.text },
  passageText: { fontFamily: fonts.serif, fontSize: 18, lineHeight: 28, color: colors.text },
  verseNumber: { fontSize: 11, fontWeight: '600', color: colors.muted },
});
