// Sonora színrendszer – a megszólaló hang szerint színezünk.
// Az itt lévő színkódok bármikor átírhatók, a program minden része innen veszi őket.

export const NOTE_COLORS = {
  C: '#000000', // fekete
  D: '#7b3f00', // barna
  E: '#1565c0', // kék
  F: '#2e7d32', // zöld
  G: '#d32f2f', // piros
  A: '#f57c00', // narancs
  H: '#ffe600', // citromsárga
} as const;

export type NoteName = keyof typeof NOTE_COLORS;

/** Egy kottafej színezése: vagy egyszínű, vagy kettéosztott (köztes hang). */
export type HeadColor =
  | { kind: 'solid'; color: string }
  | { kind: 'split'; lower: string; upper: string; name: string };

// Hangosztály (0 = C, 1 = Cisz/Desz, ... 11 = H) → a két szomszédos törzshang.
const PITCH_CLASSES: (NoteName | [NoteName, NoteName])[] = [
  'C', ['C', 'D'], 'D', ['D', 'E'], 'E', 'F', ['F', 'G'], 'G', ['G', 'A'], 'A', ['A', 'H'], 'H',
];

/** MIDI hangmagasságból (pl. 60 = középső C) megadja a kottafej színét. */
export function colorForMidi(midi: number): HeadColor {
  const pc = ((Math.round(midi) % 12) + 12) % 12;
  const entry = PITCH_CLASSES[pc];
  if (typeof entry === 'string') return { kind: 'solid', color: NOTE_COLORS[entry] };
  const [low, high] = entry;
  return { kind: 'split', lower: NOTE_COLORS[low], upper: NOTE_COLORS[high], name: `${low}-${high}` };
}

/** Az összes kettéosztott (köztes hang) változat – ezekhez kell SVG színátmenet. */
export const SPLIT_COLORS = PITCH_CLASSES.filter((e): e is [NoteName, NoteName] => Array.isArray(e)).map(
  ([low, high]) => ({ name: `${low}-${high}`, lower: NOTE_COLORS[low], upper: NOTE_COLORS[high] }),
);
