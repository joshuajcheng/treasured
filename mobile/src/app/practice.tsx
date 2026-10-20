import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { usePreventRemove } from 'expo-router/react-navigation';
import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Easing,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PracticeHeader } from '@/components/practice/Header';
import { Passage } from '@/components/practice/Passage';
import { RoundCard, SetSummary } from '@/components/practice/Results';
import { Button } from '@/components/ui';
import { lettersTyped, normalize, NO_BLANKS } from '@/lib/practice/rules';
import { findSample } from '@/lib/practice/samples';
import { sessionReducer, startSession, type SessionAction } from '@/lib/practice/session';
import { colors } from '@/lib/theme';

// Typing practice. A preview only: nothing is saved yet. Later the session's
// events go to the server, which replays them for the official result.
export default function Practice() {
  const { passage } = useLocalSearchParams<{ passage?: string }>();
  const sample = findSample(passage);
  // The server will hand out the seed later, so it can rebuild the same hidden words.
  const [state, dispatch] = useReducer(sessionReducer, sample.verses, (verses) =>
    startSession(verses, Math.floor(Math.random() * 2 ** 32)),
  );
  const [typed, setTyped] = useState('');
  const [started, setStarted] = useState(false);
  const input = useRef<TextInput>(null);
  const scroll = useRef<ScrollView>(null);
  const lastScrollY = useRef(0);
  const slide = useRef(new Animated.Value(0)).current;
  /** When the current set began, for "you spent 4 minutes with…". */
  const setStartedAt = useRef(Date.now());
  const navigation = useNavigation();

  const typing = state.status === 'typing';
  const current = typing ? state.hidden[state.cursor] : undefined;
  const noBlanks = state.level === NO_BLANKS;

  // Covers the ✕ and Android's back button (swipe back is off for this screen).
  // Once a set is done, leaving loses nothing.
  usePreventRemove(started && state.status !== 'setDone', ({ data }) => {
    Alert.alert('Leave this session?', 'Your progress in this session will be lost.', [
      { text: 'Stay', style: 'cancel' },
      { text: 'Leave', style: 'destructive', onPress: () => navigation.dispatch(data.action) },
    ]);
  });

  // The keyboard closes when a round ends, so the whole passage and the round
  // card are visible and mistakes can be tapped.
  useEffect(() => {
    if (state.status === 'typing') input.current?.focus();
    else Keyboard.dismiss();
    if (state.status === 'setDone') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [state.status]);

  function submit(text: string) {
    setTyped('');
    if (!normalize(text)) return; // A stray space isn't an answer.
    dispatch({ type: 'answer', typed: text.trim(), at: Date.now() });
  }

  function onChangeText(text: string) {
    if (current === undefined) return;
    if (text) setStarted(true);
    // Space submits early (for a typo that drops a letter). With blanks, a word
    // also submits once it has as many letters as the answer, right or wrong.
    // Not in no-blanks, where that would give away each word's length.
    const full = !noBlanks && lettersTyped(text) >= state.words[current].answer.length;
    if (/\s$/.test(text) || full) submit(text);
    else setTyped(text);
  }

  /**
   * Slides the passage out, applies the action, and slides the next round in.
   * Runs on the JS driver: the keyboard opens mid-slide and re-lays out the
   * screen, which would reset a native-driven opacity to its faded-out value.
   */
  function transition(action: SessionAction) {
    Animated.timing(slide, {
      toValue: -1,
      duration: 160,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: false,
    }).start(() => {
      dispatch(action);
      setTyped('');
      lastScrollY.current = 0;
      scroll.current?.scrollTo({ y: 0, animated: false });
      slide.setValue(1);
      Animated.timing(slide, {
        toValue: 0,
        duration: 240,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start();
    });
  }

  // Keeps the current line in view on long passages.
  const onCurrentMoved = useCallback((y: number) => {
    if (y === lastScrollY.current) return;
    lastScrollY.current = y;
    scroll.current?.scrollTo({ y: Math.max(0, y - 48), animated: true });
  }, []);

  const lastRound = state.rounds[state.rounds.length - 1];
  const previousRound = state.rounds[state.rounds.length - 2];
  const setEvents = state.events.filter((e) => e.set === state.set);
  const setDurationMs = setEvents.length ? setEvents[setEvents.length - 1].typedAt - setStartedAt.current : 0;
  // What was typed for each word this round, for tapping a mistake to see it.
  const attempts: Record<number, string> = {};
  for (const e of state.events) {
    if (e.set === state.set && e.round === state.round) attempts[e.wordIndex] = e.typed;
  }

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {state.status === 'setDone' ? (
          <SetSummary
            passage={sample}
            set={state.set}
            rounds={state.rounds}
            durationMs={setDurationMs}
            onKeepPracticing={() => {
              setStartedAt.current = Date.now();
              dispatch({ type: 'keepPracticing' });
            }}
            onDone={() => router.back()}
          />
        ) : (
          <View style={styles.flex}>
            <PracticeHeader
              reference={sample.reference}
              set={state.set}
              round={state.round}
              roundProgress={state.cursor / state.hidden.length}
              level={state.level}
              onClose={() => router.back()}
            />
            <Animated.View
              style={[
                styles.flex,
                {
                  opacity: slide.interpolate({ inputRange: [-1, 0, 1], outputRange: [0, 1, 0] }),
                  transform: [{ translateX: slide.interpolate({ inputRange: [-1, 1], outputRange: [-40, 40] }) }],
                },
              ]}
            >
              <ScrollView ref={scroll} contentContainerStyle={styles.passage} keyboardShouldPersistTaps="handled">
                <Passage
                  words={state.words}
                  hidden={new Set(state.hidden)}
                  grades={state.grades}
                  attempts={attempts}
                  current={current}
                  typed={typed}
                  noBlanks={noBlanks}
                  roundKey={`${state.set}-${state.round}`}
                  // Between rounds the keyboard stays closed, so a tap only closes the bubble.
                  onPress={() => {
                    if (typing) input.current?.focus();
                  }}
                  onCurrentMoved={onCurrentMoved}
                />
              </ScrollView>
            </Animated.View>
            {state.status === 'roundDone' ? (
              <RoundCard
                summary={lastRound}
                previous={previousRound?.set === lastRound.set ? previousRound : undefined}
                onNext={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  transition({ type: 'nextRound' });
                }}
              />
            ) : (
              <View style={styles.toolbar}>
                <Button
                  label="Show word"
                  variant="link"
                  onPress={() => {
                    setTyped('');
                    setStarted(true);
                    dispatch({ type: 'reveal', at: Date.now() });
                  }}
                />
              </View>
            )}
          </View>
        )}

        {/* Invisible: what's typed shows in the passage instead. */}
        <TextInput
          ref={input}
          value={typed}
          onChangeText={onChangeText}
          onSubmitEditing={() => submit(typed)}
          submitBehavior="submit"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="off"
          spellCheck={false}
          caretHidden
          style={styles.hiddenInput}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: { flex: 1, backgroundColor: colors.background },
  // Passage pads itself, so its tap area reaches the edges.
  passage: { flexGrow: 1 },
  toolbar: { flexDirection: 'row', justifyContent: 'flex-start', paddingHorizontal: 24, paddingBottom: 4 },
  hiddenInput: { position: 'absolute', width: 1, height: 1, opacity: 0 },
});
