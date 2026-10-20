// Hardcoded ESV passages for trying practice before verse selection and the
// ESV proxy exist. Real text will come from treasured's server.

import type { Verse } from './rules';

export type Passage = { id: string; reference: string; verses: Verse[] };

export const SAMPLE_PASSAGES: Passage[] = [
  {
    id: 'psalm-119-11',
    reference: 'Psalm 119:11',
    verses: [
      { number: 11, text: 'I have stored up your word in my heart, that I might not sin against you.' },
    ],
  },
  {
    id: 'hebrews-12-1-2',
    reference: 'Hebrews 12:1–2',
    verses: [
      {
        number: 1,
        text:
          'Therefore, since we are surrounded by so great a cloud of witnesses, let us also lay aside ' +
          'every weight, and sin which clings so closely, and let us run with endurance the race that ' +
          'is set before us,',
      },
      {
        number: 2,
        text:
          'looking to Jesus, the founder and perfecter of our faith, who for the joy that was set ' +
          'before him endured the cross, despising the shame, and is seated at the right hand of the ' +
          'throne of God.',
      },
    ],
  },
];

export function findSample(id: string | undefined): Passage {
  return SAMPLE_PASSAGES.find((p) => p.id === id) ?? SAMPLE_PASSAGES[0];
}
