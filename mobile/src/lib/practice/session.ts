// One practice session of one passage, as a reducer: the screen dispatches what
// the user did, and this decides what happens next. Like rules.ts it has no
// React Native imports, so the server can replay the recorded events later.
//
// A session is a set of rounds. Each round hides some words; the user fills
// the blanks in reading order. After a round, the hiding level moves up, stays,
// or drops with accuracy, and words answered wrong stay hidden next round. A
// set ends after ROUNDS_PER_SET rounds or after a no-blanks round.
//
// Only the first set counts. "Keep practicing" starts another set that keeps
// adapting, but repeated practice right after seeing the verse isn't evidence
// of memory, so it won't move the schedule or badges.

import {
  accuracy,
  grade,
  hiddenWords,
  hidingOrder,
  isPerfect,
  nextLevel,
  NO_BLANKS,
  toWords,
  type Grade,
  type Verse,
  type Word,
} from './rules';

export const ROUNDS_PER_SET = 5;

/** Raw input, in order. This is what will be sent to the server for replay. */
export type AnswerEvent = {
  /** 1 is the counted set; later sets are extra practice. */
  set: number;
  round: number;
  wordIndex: number;
  /** Exactly what was typed; empty when the user chose to see the word. */
  typed: string;
  typedAt: number;
  /** The phone's live grade. The server recalculates its own. */
  result: Grade;
};

export type RoundSummary = {
  set: number;
  round: number;
  level: number;
  hiddenCount: number;
  accuracy: number;
  perfect: boolean;
  typos: number;
  wrong: number;
  /** Hiding level the next round will use. */
  nextLevel: number;
};

export type SessionState = {
  words: Word[];
  seed: number;
  order: number[];
  set: number;
  /** Round within the current set, starting at 1. */
  round: number;
  level: number;
  /** Word indexes hidden this round, in reading order. */
  hidden: number[];
  /** Position in `hidden` of the word being typed. */
  cursor: number;
  /** This round's grades, by word index. */
  grades: Record<number, Grade>;
  events: AnswerEvent[];
  rounds: RoundSummary[];
  status: 'typing' | 'roundDone' | 'setDone';
};

export type SessionAction =
  | { type: 'answer'; typed: string; at: number }
  | { type: 'reveal'; at: number }
  | { type: 'nextRound' }
  | { type: 'keepPracticing' };

export function startSession(verses: Verse[], seed: number, level = 0): SessionState {
  const words = toWords(verses);
  const order = hidingOrder(words.length, seed);
  return {
    words,
    seed,
    order,
    set: 1,
    round: 1,
    level,
    hidden: hiddenWords(order, level),
    cursor: 0,
    grades: {},
    events: [],
    rounds: [],
    status: 'typing',
  };
}

export function sessionReducer(state: SessionState, action: SessionAction): SessionState {
  switch (action.type) {
    case 'answer':
    case 'reveal': {
      if (state.status !== 'typing') return state;
      const wordIndex = state.hidden[state.cursor];
      const typed = action.type === 'answer' ? action.typed : '';
      const result = action.type === 'answer' ? grade(typed, state.words[wordIndex].answer) : 'wrong';
      const grades = { ...state.grades, [wordIndex]: result };
      const events = [
        ...state.events,
        { set: state.set, round: state.round, wordIndex, typed, typedAt: action.at, result },
      ];
      const cursor = state.cursor + 1;
      if (cursor < state.hidden.length) return { ...state, grades, events, cursor };

      const summary = summarize(state, grades);
      const setOver = state.level === NO_BLANKS || state.round === ROUNDS_PER_SET;
      return {
        ...state,
        grades,
        events,
        cursor,
        rounds: [...state.rounds, summary],
        status: setOver ? 'setDone' : 'roundDone',
      };
    }
    case 'nextRound':
      if (state.status !== 'roundDone') return state;
      return startRound(state, state.set, state.round + 1);
    case 'keepPracticing':
      if (state.status !== 'setDone') return state;
      return startRound(state, state.set + 1, 1);
  }
}

function startRound(state: SessionState, set: number, round: number): SessionState {
  const last = state.rounds[state.rounds.length - 1];
  const missed = state.hidden.filter((i) => state.grades[i] === 'wrong');
  return {
    ...state,
    set,
    round,
    level: last.nextLevel,
    hidden: hiddenWords(state.order, last.nextLevel, missed),
    cursor: 0,
    grades: {},
    status: 'typing',
  };
}

function summarize(state: SessionState, grades: Record<number, Grade>): RoundSummary {
  const list = state.hidden.map((i) => grades[i]);
  return {
    set: state.set,
    round: state.round,
    level: state.level,
    hiddenCount: state.hidden.length,
    accuracy: accuracy(list),
    perfect: isPerfect(list),
    typos: list.filter((g) => g === 'typo').length,
    wrong: list.filter((g) => g === 'wrong').length,
    nextLevel: nextLevel(state.level, list),
  };
}
