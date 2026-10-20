// Practice rules: splitting a passage into words, grading typed answers, and
// choosing which words to hide. Plain TypeScript with no React Native imports,
// so the server can later replay a session with exactly the same rules.

export type Verse = { number: number; text: string };

export type Word = {
  /** As printed, including punctuation: `heart,` */
  display: string;
  /** What the user has to type, normalized: `heart` */
  answer: string;
  /** Set on the first word of each verse, for the verse number. */
  verse?: number;
};

export type Grade = 'correct' | 'typo' | 'wrong';

/** Lowercase, strip accents, apostrophes, and punctuation. */
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

export function toWords(verses: Verse[]): Word[] {
  const words: Word[] = [];
  for (const verse of verses) {
    let first = true;
    // Dashes join words without spaces in the ESV ("witnesses—let"), so treat
    // them as a break after the dash.
    const pieces = verse.text.replace(/([—–])/g, '$1 ').split(/\s+/);
    for (const piece of pieces) {
      if (!piece) continue;
      const answer = normalize(piece);
      if (answer) {
        words.push({ display: piece, answer, ...(first && { verse: verse.number }) });
        first = false;
      } else if (words.length > 0) {
        // Stray punctuation (a lone dash) sticks to the word before it.
        words[words.length - 1].display += piece;
      }
    }
  }
  return words;
}

/** Splits `“heart,` into `“`, `heart`, `,` so a hidden word keeps its punctuation as a cue. */
export function splitPunctuation(display: string) {
  const match = display.match(/^([^A-Za-z0-9À-ɏ]*)(.*?)([^A-Za-z0-9À-ɏ]*)$/);
  if (!match) return { before: '', core: display, after: '' };
  return { before: match[1], core: match[2], after: match[3] };
}

/** How many letter changes still count as a typo in words of 4 or more letters. */
export function typoAllowance(answer: string): number {
  return answer.length >= 8 ? 2 : 1;
}

/**
 * In words of 1–3 letters, one changed letter usually makes a different word
 * (in/on, he/me), so only two swapped neighbors count as a typo (Gdo for God).
 */
function isSwappedNeighbors(attempt: string, answer: string): boolean {
  if (attempt.length !== answer.length) return false;
  const diffs = [...answer].flatMap((c, i) => (c === attempt[i] ? [] : [i]));
  return (
    diffs.length === 2 &&
    diffs[1] === diffs[0] + 1 &&
    attempt[diffs[0]] === answer[diffs[1]] &&
    attempt[diffs[1]] === answer[diffs[0]]
  );
}

export function grade(typed: string, answer: string): Grade {
  const attempt = normalize(typed);
  if (attempt === answer) return 'correct';
  if (!attempt) return 'wrong';
  if (answer.length <= 3) return isSwappedNeighbors(attempt, answer) ? 'typo' : 'wrong';
  return editDistance(attempt, answer) <= typoAllowance(answer) ? 'typo' : 'wrong';
}

/** A word submits on its own once this many letters are typed, right or wrong. */
export function lettersTyped(typed: string): number {
  return normalize(typed).length;
}

/**
 * Letter changes (insert, delete, replace, or swap two neighbors) needed to
 * turn `a` into `b`. Swaps count as one so "teh" is a typo of "the".
 */
export function editDistance(a: string, b: string): number {
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }
  return d[a.length][b.length];
}

// --- Hiding ---------------------------------------------------------------

/**
 * Share of the passage hidden as blanks at each hiding level. After the last
 * one comes NO_BLANKS: the passage isn't shown at all and is typed from memory.
 */
export const HIDING_LEVELS = [0.25, 0.5, 0.75, 1] as const;
export const ALL_HIDDEN = HIDING_LEVELS.length - 1;
export const NO_BLANKS = HIDING_LEVELS.length;

/** Small seeded random number generator (mulberry32), so a seed always gives the same sequence. */
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * The order in which words get hidden. The passage is cut into chunks of 1–3
 * neighboring words, and the chunks are shuffled. Each level hides a longer
 * prefix of this order, so words hidden at one level stay hidden at the next.
 */
export function hidingOrder(wordCount: number, seed: number): number[] {
  const random = seededRandom(seed);
  const chunks: number[][] = [];
  for (let i = 0; i < wordCount; ) {
    const size = Math.min(1 + Math.floor(random() * 3), wordCount - i);
    chunks.push(Array.from({ length: size }, (_, k) => i + k));
    i += size;
  }
  for (let i = chunks.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [chunks[i], chunks[j]] = [chunks[j], chunks[i]];
  }
  return chunks.flat();
}

/** Word indexes hidden at `level`, plus any words missed last round, in reading order. */
export function hiddenWords(order: number[], level: number, missed: number[] = []): number[] {
  const count = Math.ceil((HIDING_LEVELS[level] ?? 1) * order.length);
  const hidden = new Set([...order.slice(0, count), ...missed]);
  return [...hidden].sort((a, b) => a - b);
}

/** Round accuracy thresholds for moving the hiding level within a session. */
export const LEVEL_UP_AT = 0.9;
export const LEVEL_DOWN_BELOW = 0.5;

/** A typo costs a little; a wrong word costs the whole word. */
export const GRADE_CREDIT: Record<Grade, number> = { correct: 1, typo: 0.8, wrong: 0 };

export function accuracy(grades: Grade[]): number {
  if (grades.length === 0) return 1;
  return grades.reduce((sum, g) => sum + GRADE_CREDIT[g], 0) / grades.length;
}

/** Perfect means no wrong words; typos are allowed. */
export function isPerfect(grades: Grade[]): boolean {
  return grades.every((g) => g !== 'wrong');
}

/**
 * The hiding level for the next round. No blanks is only reached from a perfect
 * round with every word hidden, and a missed no-blanks round goes back to it.
 */
export function nextLevel(level: number, grades: Grade[]): number {
  if (level === NO_BLANKS) return isPerfect(grades) ? NO_BLANKS : ALL_HIDDEN;
  const score = accuracy(grades);
  if (level === ALL_HIDDEN && isPerfect(grades)) return NO_BLANKS;
  if (score >= LEVEL_UP_AT && level < ALL_HIDDEN) return level + 1;
  if (score < LEVEL_DOWN_BELOW) return Math.max(level - 1, 0);
  return level;
}
