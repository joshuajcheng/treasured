import MaskedView from '@react-native-masked-view/masked-view';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useLayoutEffect, useRef, useState, type Ref } from 'react';
import { AccessibilityInfo, Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';

import { splitPunctuation, type Grade, type Word } from '@/lib/practice/rules';
import { colors, fonts, sheen } from '@/lib/theme';

type PassageProps = {
  words: Word[];
  hidden: Set<number>;
  grades: Record<number, Grade>;
  /** What was typed for each graded word this round ('' if the user chose Show word). */
  attempts: Record<number, string>;
  current: number | undefined;
  typed: string;
  noBlanks: boolean;
  /** Changes every round, so the highlight jumps instead of gliding across rounds. */
  roundKey: string;
  onPress: () => void;
  /** Reports the current word's top edge, so the screen can scroll to it. */
  onCurrentMoved: (y: number) => void;
};

/**
 * Which copy of the passage is being drawn. Correct words aren't drawn as text:
 * a second, invisible copy of the passage (the mask) cuts word-shaped holes
 * through which one shared green gradient shows, so the sheen flows across all
 * of them together. Both copies use the same layout, so the holes line up.
 */
type Layer = 'text' | 'mask';

type Peek = { index: number; x: number; y: number; width: number; height: number };

// The passage being practiced. Each blank reserves exactly its word's width (the
// word is laid out invisibly underneath), so filling one never moves the text.
export function Passage(props: PassageProps) {
  const { words, hidden, grades, attempts, current, typed, noBlanks, roundKey, onPress, onCurrentMoved } = props;
  const container = useRef<View>(null);
  const currentWord = useRef<View>(null);
  const peekable = useRef(new Map<number, View>());
  const highlight = useHighlight();
  const [peek, setPeek] = useState<Peek | null>(null);
  const [width, setWidth] = useState(0);

  // A new round jumps the highlight into place. Declared first so it runs before the measure below.
  useLayoutEffect(() => {
    highlight.reset();
    setPeek(null);
  }, [roundKey, highlight]);

  // Re-measure only when the target word changes, not when the callback's identity does.
  useLayoutEffect(() => {
    if (current === undefined || !currentWord.current || !container.current) return;
    currentWord.current.measureLayout(container.current, (x, y, width, height) => {
      highlight.moveTo({ x, y, width, height });
      onCurrentMoved(y);
    });
  }, [current, roundKey]); // eslint-disable-line react-hooks/exhaustive-deps

  function showAttempt(index: number) {
    const node = peekable.current.get(index);
    if (!node || !container.current) return;
    node.measureLayout(container.current, (x, y, width, height) => setPeek({ index, x, y, width, height }));
  }

  function renderWords(layer: Layer) {
    return words.map((word, i) => {
      const grade = grades[i];
      const isCurrent = i === current;
      const canPeek = layer === 'text' && (grade === 'typo' || grade === 'wrong');
      const coreRef: Ref<View> | undefined =
        layer === 'mask'
          ? undefined
          : isCurrent
            ? currentWord
            : canPeek
              ? (node) => {
                  if (node) peekable.current.set(i, node);
                  else peekable.current.delete(i);
                }
              : undefined;

      if (noBlanks && !grade) {
        // Nothing ahead of the cursor is shown; typed words build up line by line.
        if (!isCurrent) return null;
        return (
          <View key={i} ref={coreRef} style={[styles.freeTyping, layer === 'mask' && styles.invisible]}>
            <Typing typed={typed} />
          </View>
        );
      }
      return (
        <WordView
          key={i}
          layer={layer}
          word={word}
          hidden={noBlanks || hidden.has(i)}
          grade={grade}
          typed={isCurrent && layer === 'text' ? typed : undefined}
          showVerse={!noBlanks}
          coreRef={coreRef}
          onPeek={canPeek ? () => showAttempt(i) : undefined}
        />
      );
    });
  }

  const anyCorrect = Object.values(grades).includes('correct');
  const attempt = peek ? attempts[peek.index] : undefined;

  return (
    // The whole passage area takes taps, including empty space around the verse.
    <Pressable
      style={styles.touchArea}
      onPress={() => {
        setPeek(null);
        onPress();
      }}
    >
      {/* Positions the mask and bubble over the words, inside the padding. */}
      <View>
        <View ref={container} style={styles.words} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
          {!noBlanks && current !== undefined && <Animated.View style={[styles.highlight, highlight.style]} />}
          {renderWords('text')}
        </View>

        {anyCorrect && (
          <MaskedView
            pointerEvents="none"
            style={StyleSheet.absoluteFill}
            maskElement={<View style={[styles.words, styles.flex]}>{renderWords('mask')}</View>}
          >
            <Sheen />
          </MaskedView>
        )}

        <AttemptBubble
          target={peek}
          label={attempt ? `You typed “${attempt}”` : 'You tapped Show word'}
          containerWidth={width}
        />
      </View>
    </Pressable>
  );
}

/**
 * Shows what was typed for a tapped mistake. Fades and rises in, glides to the
 * next word if another mistake is tapped, and fades out before it disappears.
 * JS driver throughout, since left/top are layout properties.
 */
function AttemptBubble({ target, label, containerWidth }: { target: Peek | null; label: string; containerWidth: number }) {
  // Kept after the target clears, so the bubble can fade out with its text.
  const [shownFor, setShownFor] = useState<{ target: Peek; label: string } | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [values] = useState(() => ({
    shown: new Animated.Value(0),
    anchorX: new Animated.Value(0),
    top: new Animated.Value(0),
    visible: { current: false },
  }));
  const { shown, anchorX, top, visible } = values;

  useEffect(() => {
    if (target) {
      setShownFor({ target, label });
      return;
    }
    visible.current = false;
    Animated.timing(shown, { toValue: 0, duration: 120, useNativeDriver: false }).start(({ finished }) => {
      if (finished) setShownFor(null);
    });
  }, [target, label, shown, visible]);

  const place = target ?? shownFor?.target;
  // Above the word, or below it on the first line where there's no room.
  const below = place ? place.y < 44 : false;

  useEffect(() => {
    if (!target || size.height === 0) return;
    const x = target.x + target.width / 2;
    const y = below ? target.y + target.height + 10 : target.y - size.height - 10;
    if (!visible.current) {
      anchorX.setValue(x);
      top.setValue(y);
      visible.current = true;
      Animated.timing(shown, {
        toValue: 1,
        duration: 180,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start();
      return;
    }
    const glide = (value: Animated.Value, toValue: number) =>
      Animated.timing(value, { toValue, duration: 200, easing: Easing.out(Easing.cubic), useNativeDriver: false });
    Animated.parallel([glide(anchorX, x), glide(top, y)]).start();
  }, [target, size.height, below, anchorX, top, shown, visible]);

  if (!shownFor) return null;

  // Centered on the word, but kept inside the passage's edges.
  const half = size.width / 2;
  const left =
    containerWidth > size.width
      ? anchorX.interpolate({
          inputRange: [half, containerWidth - half],
          outputRange: [0, containerWidth - size.width],
          extrapolate: 'clamp',
        })
      : 0;
  const pointerLeft = Animated.add(Animated.subtract(anchorX, left), -POINTER / 2);

  return (
    <Animated.View
      pointerEvents="none"
      onLayout={(e) => setSize(e.nativeEvent.layout)}
      style={[
        styles.bubble,
        {
          left,
          top,
          opacity: shown,
          transform: [
            { translateY: shown.interpolate({ inputRange: [0, 1], outputRange: [below ? -6 : 6, 0] }) },
            { scale: shown.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }) },
          ],
        },
      ]}
    >
      <Animated.View style={[styles.pointer, below ? styles.pointerTop : styles.pointerBottom, { left: pointerLeft }]} />
      <Text style={styles.bubbleText}>{shownFor.label}</Text>
    </Animated.View>
  );
}

const POINTER = 10;

type WordViewProps = {
  layer: Layer;
  word: Word;
  hidden: boolean;
  grade?: Grade;
  /** Set only on the word being typed. */
  typed?: string;
  showVerse: boolean;
  coreRef?: Ref<View>;
  onPeek?: () => void;
};

function WordView({ layer, word, hidden, grade, typed, showVerse, coreRef, onPeek }: WordViewProps) {
  const mask = layer === 'mask';
  // In the mask, everything except correct words is fully transparent.
  const fade = mask && styles.invisible;
  const verse = showVerse && word.verse ? <Text style={[styles.verseNumber, fade]}>{word.verse}</Text> : null;
  if (!hidden) {
    return (
      <View style={styles.wordRow}>
        {verse}
        <Text style={[styles.word, fade]}>{word.display}</Text>
      </View>
    );
  }

  const { before, core, after } = splitPunctuation(word.display);
  let coreText;
  if (mask) coreText = grade === 'correct' ? styles.maskInk : styles.invisible;
  else coreText = grade ? gradeText[grade] : styles.invisible;

  const coreView = (
    <View ref={coreRef} style={!mask && grade === 'wrong' && styles.wrongBox}>
      {/* Reserves the word's exact width; shown once graded. */}
      <Text style={[styles.word, coreText]}>{core}</Text>
      {!mask && !grade && typed === undefined && <View style={styles.underline} />}
      {!mask && grade === 'typo' && <View style={[styles.underline, styles.typoUnderline]} />}
      {typed !== undefined && !grade && (
        <View style={styles.overlay}>
          <Typing typed={typed} />
        </View>
      )}
    </View>
  );

  return (
    <View style={styles.wordRow}>
      {verse}
      {before ? <Text style={[styles.word, fade]}>{before}</Text> : null}
      {onPeek ? (
        <Pressable onPress={onPeek} hitSlop={6} accessibilityRole="button" accessibilityHint="Shows what you typed">
          {coreView}
        </Pressable>
      ) : (
        coreView
      )}
      {after ? <Text style={[styles.word, fade]}>{after}</Text> : null}
    </View>
  );
}

/** A slow wave of greens that drifts back and forth and gently brightens. */
function Sheen() {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const drift = useRef(new Animated.Value(0)).current;
  const glow = useRef(new Animated.Value(0)).current;
  const reduceMotion = useReduceMotion();

  useEffect(() => {
    if (reduceMotion) return;
    const wave = (value: Animated.Value, duration: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(value, { toValue: 1, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(value, { toValue: 0, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ]),
      );
    const animation = Animated.parallel([wave(drift, 8000), wave(glow, 5000)]);
    animation.start();
    return () => animation.stop();
  }, [reduceMotion, drift, glow]);

  // The gradient is wider than the passage and slides slowly across it.
  const travel = size.width * 1.5;
  return (
    <View style={StyleSheet.absoluteFill} onLayout={(e) => setSize(e.nativeEvent.layout)}>
      <Animated.View
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: 0,
          width: size.width + travel,
          transform: [{ translateX: drift.interpolate({ inputRange: [0, 1], outputRange: [0, -travel] }) }],
        }}
      >
        <LinearGradient colors={sheen} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0.6 }} style={StyleSheet.absoluteFill} />
      </Animated.View>
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          styles.glow,
          { opacity: glow.interpolate({ inputRange: [0, 1], outputRange: [0, 0.07] }) },
        ]}
      />
    </View>
  );
}

function useReduceMotion() {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduce);
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduce);
    return () => subscription.remove();
  }, []);
  return reduce;
}

/** What's been typed for the current word, with a caret that glides behind it. */
function Typing({ typed }: { typed: string }) {
  const [width, setWidth] = useState(0);
  return (
    <View style={styles.typing}>
      <View style={styles.letters} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
        {[...typed].map((char, i) => (
          <FadeInLetter key={i} char={char} />
        ))}
      </View>
      <Caret x={typed ? width : 0} typed={typed} />
    </View>
  );
}

function FadeInLetter({ char }: { char: string }) {
  const shown = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(shown, { toValue: 1, duration: 110, useNativeDriver: true }).start();
  }, [shown]);
  const translateY = shown.interpolate({ inputRange: [0, 1], outputRange: [3, 0] });
  return <Animated.Text style={[styles.word, { opacity: shown, transform: [{ translateY }] }]}>{char}</Animated.Text>;
}

/** Slides to each new letter instead of jumping, and blinks while idle. */
function Caret({ x, typed }: { x: number; typed: string }) {
  const left = useRef(new Animated.Value(x)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.timing(left, {
      toValue: x,
      duration: 90,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [x, left]);

  useEffect(() => {
    opacity.setValue(1);
    const blink = Animated.loop(
      Animated.sequence([
        Animated.delay(500),
        Animated.timing(opacity, { toValue: 0, duration: 350, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 350, useNativeDriver: true }),
      ]),
    );
    blink.start();
    return () => blink.stop();
  }, [typed, opacity]);

  return <Animated.View style={[styles.caret, { opacity, transform: [{ translateX: left }] }]} />;
}

/** The highlight behind the current blank, gliding from one blank to the next. */
function useHighlight() {
  const [values] = useState(() => ({
    x: new Animated.Value(0),
    y: new Animated.Value(0),
    width: new Animated.Value(0),
    height: new Animated.Value(0),
    placed: { current: false },
  }));
  const [api] = useState(() => ({
    style: { left: values.x, top: values.y, width: values.width, height: values.height },
    reset() {
      values.placed.current = false;
    },
    moveTo(target: { x: number; y: number; width: number; height: number }) {
      const keys = ['x', 'y', 'width', 'height'] as const;
      if (!values.placed.current) {
        keys.forEach((k) => values[k].setValue(target[k]));
        values.placed.current = true;
        return;
      }
      Animated.parallel(
        keys.map((k) =>
          Animated.timing(values[k], {
            toValue: target[k],
            duration: 180,
            easing: Easing.out(Easing.cubic),
            // Layout properties (left, width) can't use the native driver.
            useNativeDriver: false,
          }),
        ),
      ).start();
    },
  }));
  return api;
}

const gradeText = StyleSheet.create({
  // Drawn by the sheen showing through the mask instead.
  correct: { color: 'transparent' },
  typo: { color: colors.text },
  wrong: { color: colors.error },
});

const styles = StyleSheet.create({
  flex: { flex: 1 },
  touchArea: { flexGrow: 1, padding: 24 },
  words: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 7, rowGap: 6 },
  wordRow: { flexDirection: 'row', alignItems: 'flex-end' },
  word: { fontFamily: fonts.serif, fontSize: 22, lineHeight: 32, color: colors.text },
  verseNumber: {
    alignSelf: 'flex-start',
    marginRight: 3,
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '600',
    color: colors.muted,
  },
  invisible: { opacity: 0 },
  maskInk: { color: '#000000' },
  // Drawn over the word's box rather than as a border, so a blank is exactly
  // as tall as a word and sits on the same line.
  underline: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 2, backgroundColor: colors.border },
  typoUnderline: { backgroundColor: colors.typo },
  // The negative margin cancels the padding, so the highlight doesn't move the text.
  wrongBox: {
    backgroundColor: colors.errorBackground,
    borderRadius: 4,
    marginHorizontal: -3,
    paddingHorizontal: 3,
  },
  overlay: { ...StyleSheet.absoluteFill, flexDirection: 'row' },
  highlight: {
    position: 'absolute',
    borderRadius: 4,
    backgroundColor: colors.highlight,
    borderBottomWidth: 2,
    borderBottomColor: colors.accent,
  },
  glow: { backgroundColor: '#FFFFFF' },
  bubble: {
    position: 'absolute',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: colors.text,
  },
  bubbleText: { fontSize: 14, color: colors.background },
  pointer: {
    position: 'absolute',
    width: POINTER,
    height: POINTER,
    borderRadius: 2,
    backgroundColor: colors.text,
    transform: [{ rotate: '45deg' }],
  },
  pointerTop: { top: -POINTER / 2 + 1 },
  pointerBottom: { bottom: -POINTER / 2 + 1 },
  freeTyping: { minWidth: 12 },
  typing: { flexDirection: 'row' },
  letters: { flexDirection: 'row', alignSelf: 'flex-start' },
  caret: {
    position: 'absolute',
    left: 0,
    top: 5,
    width: 2,
    height: 23,
    borderRadius: 1,
    backgroundColor: colors.accent,
  },
});
