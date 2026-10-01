// A kotta adatmodellje. Ez a program "igazsága": a képernyőn látható kotta
// mindig ebből készül. Minden szerkesztés ezen a modellen történik.

export const DURATIONS = ['whole', 'half', 'quarter', 'eighth', '16th'] as const;
export type Duration = (typeof DURATIONS)[number];

/** Egy negyedhang ennyi egység. Ennyivel a pontozott tizenhatod is egész szám marad. */
export const DIVISIONS = 16;

const QUARTERS: Record<Duration, number> = {
  whole: 4,
  half: 2,
  quarter: 1,
  eighth: 0.5,
  '16th': 0.25,
};

export const DURATION_NAMES: Record<Duration, string> = {
  whole: 'egész',
  half: 'fél',
  quarter: 'negyed',
  eighth: 'nyolcad',
  '16th': 'tizenhatod',
};

export type Step = 'C' | 'D' | 'E' | 'F' | 'G' | 'A' | 'B';
export type Clef = 'G' | 'F' | 'C3' | 'C4';

export const CLEF_NAMES: Record<Clef, string> = {
  G: 'violinkulcs',
  F: 'basszuskulcs',
  C3: 'altkulcs',
  C4: 'tenorkulcs',
};

export interface Note {
  kind: 'note';
  /** A hang neve. Figyelem: a magyar H itt 'B', a magyar B pedig 'B' + alter -1. */
  step: Step;
  /** Módosítás: -1 (b), 0, +1 (#). */
  alter: -1 | 0 | 1;
  octave: number;
  duration: Duration;
  /** Pontok száma (0, 1 vagy 2). */
  dots: number;
}

export interface Rest {
  kind: 'rest';
  duration: Duration;
  dots: number;
}

export type Event = Note | Rest;

export interface Staff {
  name: string;
  clef: Clef;
  events: Event[];
}

export interface Score {
  title: string;
  /** Előjegyzés a kvintkörön: 0 = C-dúr, +1 = G-dúr, -1 = F-dúr … */
  fifths: number;
  beats: number;
  beatType: number;
  tempo: number;
  staves: Staff[];
}

/** Egy esemény hossza negyedhangban, a pontokkal együtt. */
export function quarters(event: Event): number {
  const base = QUARTERS[event.duration];
  // Minden pont a felét adja hozzá az addigi hossznak: 1 + 1/2 + 1/4 …
  return base * (2 - 2 ** -event.dots);
}

/** Egy esemény hossza a MusicXML `divisions` egységében. */
export function durationUnits(event: Event): number {
  return Math.round(quarters(event) * DIVISIONS);
}

/** Egy ütem hossza negyedhangban. */
export function measureQuarters(score: Score): number {
  return (score.beats * 4) / score.beatType;
}

/**
 * Az események ütemekre bontása. Az ütem akkor zárul, ha betelt; ha a következő
 * esemény már nem férne bele, új ütem kezdődik (az előző rövidebb marad).
 * Ütemvonalon átnyúló hang (átkötés) a 2c fázis feladata.
 */
export function splitIntoMeasures(events: Event[], capacity: number): Event[][] {
  const measures: Event[][] = [[]];
  let filled = 0;
  for (const event of events) {
    const length = quarters(event);
    if (filled > 0 && filled + length > capacity + 1e-9) {
      measures.push([]);
      filled = 0;
    }
    measures[measures.length - 1].push(event);
    filled += length;
  }
  return measures;
}

export function emptyScore(): Score {
  return {
    title: 'Új kotta',
    fifths: 0,
    beats: 4,
    beatType: 4,
    tempo: 100,
    staves: [{ name: 'Szólam 1', clef: 'G', events: [] }],
  };
}

export function newStaff(index: number): Staff {
  return { name: `Szólam ${index}`, clef: 'G', events: [] };
}

/** Mély másolat – az undo/redo minden lépésnél a teljes állapotot elteszi. */
export function cloneScore(score: Score): Score {
  return {
    ...score,
    staves: score.staves.map((staff) => ({ ...staff, events: staff.events.map((e) => ({ ...e })) })),
  };
}
