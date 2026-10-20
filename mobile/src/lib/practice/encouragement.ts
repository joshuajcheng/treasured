// What practice says to the user, in the voice of an encouraging friend. Every
// message states something true about this session (a real score, a real
// change), so praise never outruns the result. No exclamation marks, no guilt
// about mistakes, no comparisons with other people.

import { HIDING_LEVELS, NO_BLANKS } from './rules';
import type { RoundSummary } from './session';

export function levelLabel(level: number) {
  return level === NO_BLANKS ? 'No blanks' : `${Math.round(HIDING_LEVELS[level] * 100)}% hidden`;
}

export function percent(accuracy: number) {
  return `${Math.round(accuracy * 100)}%`;
}

/** Varies the phrasing from round to round without being random. */
function pick(options: string[], n: number) {
  return options[n % options.length];
}

/** Shown on the card between rounds. The first case that applies wins. */
export function roundMessage(summary: RoundSummary, previous: RoundSummary | undefined): string {
  const n = summary.set + summary.round;
  if (summary.nextLevel === NO_BLANKS) {
    return pick(["You're ready to try it with no blanks.", "Next round, no blanks at all. You know this one."], n);
  }
  if (summary.perfect) {
    return pick(["Every word. That's settling in.", "Not one missed. It's sticking.", 'Every word, right where it belongs.'], n);
  }
  if (previous && summary.accuracy > previous.accuracy) {
    const from = percent(previous.accuracy);
    return pick([`Up from ${from} last round.`, `Better than last round: ${from} to ${percent(summary.accuracy)}.`], n);
  }
  if (summary.nextLevel > summary.level) {
    return pick(["You're getting it, so a few more words go.", "Nicely done. We'll hide a few more."], n);
  }
  if (summary.nextLevel < summary.level) {
    return pick(["That one was hard. We'll ease off a little.", 'Tough round. A few words come back to help.'], n);
  }
  return pick(['Steady. One more pass will help.', 'Good effort. Another pass will help it settle.'], n);
}

export function sessionHeading(rounds: RoundSummary[], set: number): string {
  const last = rounds[rounds.length - 1];
  if (last.level === NO_BLANKS && last.perfect) return 'Typed from memory';
  return set === 1 ? 'Session done' : 'Practice done';
}

/** The friendly lines at the top of the end-of-session summary. */
export function sessionLines(reference: string, durationMs: number, rounds: RoundSummary[]): string[] {
  const first = rounds[0];
  const last = rounds[rounds.length - 1];
  const furthest = Math.max(...rounds.map((r) => r.level));
  const lines = [`You spent ${duration(durationMs)} with ${reference}.`];

  if (last.level === NO_BLANKS && last.perfect) {
    lines.push('You typed the whole passage with nothing on the screen to help.');
  } else if (furthest > first.level) {
    lines.push(`You went from ${levelLabel(first.level).toLowerCase()} to ${levelLabel(furthest).toLowerCase()}.`);
  } else if (rounds.length > 1 && last.accuracy > first.accuracy) {
    lines.push(`Your score climbed from ${percent(first.accuracy)} to ${percent(last.accuracy)}.`);
  } else {
    lines.push(`You kept at it for ${rounds.length} ${rounds.length === 1 ? 'round' : 'rounds'}.`);
  }
  return lines;
}

function duration(ms: number) {
  const minutes = Math.round(ms / 60000);
  if (minutes < 1) return 'a few moments';
  return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`;
}
