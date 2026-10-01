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

export interface Pitch {
  /** A hang neve. Figyelem: a magyar H itt 'B', a magyar B pedig 'B' + alter -1. */
  step: Step;
  /** Módosítás: -1 (b), 0, +1 (#). */
  alter: -1 | 0 | 1;
  octave: number;
}

export const ARTICULATIONS = ['staccato', 'accent', 'tenuto', 'marcato', 'fermata'] as const;
export type Articulation = (typeof ARTICULATIONS)[number];

export const ARTICULATION_NAMES: Record<Articulation, string> = {
  staccato: 'staccato',
  accent: 'ékezet',
  tenuto: 'tenuto',
  marcato: 'erős ékezet',
  fermata: 'korona',
};

export const DYNAMICS = ['pp', 'p', 'mp', 'mf', 'f', 'ff'] as const;
export type Dynamic = (typeof DYNAMICS)[number];

export type Wedge = 'crescendo' | 'diminuendo' | 'stop';
export type Marker = 'segno' | 'coda';

export interface Note {
  kind: 'note';
  /** Egy elem = egy hang, több elem = akkord. Az első a fő hang. */
  pitches: Pitch[];
  duration: Duration;
  /** Pontok száma (0, 1 vagy 2). */
  dots: number;
  /** Átkötés a szomszédos, azonos magasságú hanghoz. */
  tie?: 'start' | 'stop' | 'both';
  /** Kötőív kezdete vagy vége. */
  slur?: 'start' | 'stop';
  articulations?: Articulation[];
  /** A hang alá írt dinamikai jel. */
  dynamic?: Dynamic;
  /** Crescendo/decrescendo villa kezdete vagy vége. */
  wedge?: Wedge;
  /** Segno vagy coda jel a hang fölött. */
  marker?: Marker;
}

export interface Rest {
  kind: 'rest';
  duration: Duration;
  dots: number;
  articulations?: Articulation[];
  dynamic?: Dynamic;
  wedge?: Wedge;
  marker?: Marker;
}

export const BARLINE_STYLES = ['normal', 'double', 'final', 'repeat-start', 'repeat-end'] as const;
export type BarlineStyle = (typeof BARLINE_STYLES)[number];

export const BARLINE_NAMES: Record<BarlineStyle, string> = {
  normal: 'ütemvonal',
  double: 'kettős vonal',
  final: 'záróvonal',
  'repeat-start': 'ismétlés kezdete',
  'repeat-end': 'ismétlés vége',
};

/** Ütemvonal: lezárja az addigi ütemet. Nincs időtartama. */
export interface Barline {
  kind: 'barline';
  style: BarlineStyle;
}

/** Kulcsváltás a darab közben. Nincs időtartama. */
export interface ClefChange {
  kind: 'clef';
  clef: Clef;
}

/** Hangnemváltás a darab közben. Nincs időtartama. */
export interface KeyChange {
  kind: 'key';
  fifths: number;
}

export type Event = Note | Rest | Barline | ClefChange | KeyChange;

/** Igaz, ha az esemény hangzik (van időtartama). */
export function isTimed(event: Event): event is Note | Rest {
  return event.kind === 'note' || event.kind === 'rest';
}

export interface Staff {
  name: string;
  clef: Clef;
  /** Szólamok ezen a soron. A legtöbb kottában egy van; kettő pl. zongoránál. */
  voices: Event[][];
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
  if (!isTimed(event)) return 0;
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

export interface Measure {
  events: Event[];
  /** Bal oldali ütemvonal – csak az ismétlés kezdeténél van. */
  left?: 'repeat-start';
  /** Jobb oldali ütemvonal, ha a felhasználó megadta. */
  right?: Exclude<BarlineStyle, 'repeat-start'>;
}

/**
 * Az események ütemekre bontása. Az ütem akkor zárul, ha betelt, vagy ha a
 * felhasználó ütemvonalat tett oda. Ha a következő hang már nem férne bele,
 * új ütem kezdődik (az előző rövidebb marad) – átkötés még nincs.
 */
export function splitIntoMeasures(events: Event[], capacity: number): Measure[] {
  const measures: Measure[] = [{ events: [] }];
  let filled = 0;
  const current = () => measures[measures.length - 1];
  const startMeasure = (left?: 'repeat-start') => {
    measures.push({ events: [], left });
    filled = 0;
  };

  for (const event of events) {
    if (event.kind === 'barline') {
      if (event.style === 'repeat-start') {
        // Az ismétlőjel a következő ütem elejére kerül.
        if (current().events.length > 0) startMeasure('repeat-start');
        else current().left = 'repeat-start';
      } else {
        current().right = event.style;
        startMeasure();
      }
      continue;
    }
    const length = quarters(event);
    if (filled > 0 && filled + length > capacity + 1e-9) startMeasure();
    current().events.push(event);
    filled += length;
  }

  // A lezárás után keletkezett üres ütemet eldobjuk.
  if (measures.length > 1 && current().events.length === 0 && !current().left) measures.pop();
  return measures;
}

export function emptyScore(): Score {
  return {
    title: 'Új kotta',
    fifths: 0,
    beats: 4,
    beatType: 4,
    tempo: 100,
    staves: [newStaff(1)],
  };
}

export function newStaff(index: number): Staff {
  return { name: `Szólam ${index}`, clef: 'G', voices: [[]] };
}

/** Mély másolat – az undo/redo minden lépésnél a teljes állapotot elteszi. */
export function cloneScore(score: Score): Score {
  return structuredClone(score);
}
