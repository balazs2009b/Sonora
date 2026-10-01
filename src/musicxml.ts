// A modell és a MusicXML fájlformátum közötti átjárás.
// Ez a Finale és minden más kottaprogram felé a közös nyelv.
import {
  ARTICULATIONS,
  DIVISIONS,
  DURATIONS,
  DYNAMICS,
  durationUnits,
  emptyScore,
  isTimed,
  measureQuarters,
  splitIntoMeasures,
  type Articulation,
  type BarlineStyle,
  type Clef,
  type Duration,
  type Dynamic,
  type Event,
  type Marker,
  type Measure,
  type Note,
  type Pitch,
  type Score,
  type Staff,
  type Step,
  type Wedge,
} from './model';

const CLEF_TAGS: Record<Clef, { sign: string; line: number }> = {
  G: { sign: 'G', line: 2 },
  F: { sign: 'F', line: 4 },
  C3: { sign: 'C', line: 3 },
  C4: { sign: 'C', line: 4 },
};

const ACCIDENTAL_TAGS: Record<number, string> = { [-1]: 'flat', 0: 'natural', 1: 'sharp' };
const ARTICULATION_TAGS: Record<Articulation, string> = {
  staccato: 'staccato',
  accent: 'accent',
  tenuto: 'tenuto',
  marcato: 'strong-accent',
  fermata: 'fermata', // a korona a notations alá kerül, nem az articulations alá
};
const BAR_STYLE_TAGS: Record<Exclude<BarlineStyle, 'repeat-start'>, string> = {
  normal: 'regular',
  double: 'light-light',
  final: 'light-heavy',
  'repeat-end': 'light-heavy',
};

function escapeXml(text: string): string {
  return text.replace(/[<>&'"]/g, (c) => `&#${c.charCodeAt(0)};`);
}

/** A kurzorhoz és a kiemeléshez minden esemény azonosítót kap: ev-<sor>-<szólam>-<sorszám>. */
export function eventId(staffIndex: number, voiceIndex: number, eventIndex: number): string {
  return `ev-${staffIndex}-${voiceIndex}-${eventIndex}`;
}

/** Igaz, ha az előjegyzés már tartalmazza ezt a módosítást (pl. G-dúrban az F#). */
function impliedByKey(step: Step, alter: number, fifths: number): boolean {
  const sharps: Step[] = ['F', 'C', 'G', 'D', 'A', 'E', 'B'];
  const flats: Step[] = ['B', 'E', 'A', 'D', 'G', 'C', 'F'];
  if (alter === 1) return fifths > 0 && sharps.slice(0, fifths).includes(step);
  if (alter === -1) return fifths < 0 && flats.slice(0, -fifths).includes(step);
  return false;
}

function pitchToXml(pitch: Pitch, fifths: number, isChordTone: boolean): string {
  const parts = [isChordTone ? '<chord/>' : '', `<pitch><step>${pitch.step}</step>`];
  if (pitch.alter !== 0) parts.push(`<alter>${pitch.alter}</alter>`);
  parts.push(`<octave>${pitch.octave}</octave></pitch>`);
  return parts.join('');
}

/** A hang fölé/alá írt jelek: dinamika, villa, segno/coda. Ezek a hang elé kerülnek. */
function directionsToXml(event: Note | Extract<Event, { kind: 'rest' }>): string {
  const wrap = (placement: string, inner: string) =>
    `<direction placement="${placement}"><direction-type>${inner}</direction-type></direction>`;
  const parts: string[] = [];
  if (event.marker) parts.push(wrap('above', `<${event.marker}/>`));
  if (event.dynamic) parts.push(wrap('below', `<dynamics><${event.dynamic}/></dynamics>`));
  if (event.wedge) parts.push(wrap('below', `<wedge type="${event.wedge}"/>`));
  return parts.join('');
}

function notationsToXml(event: Note | Extract<Event, { kind: 'rest' }>): string {
  const parts: string[] = [];
  if (event.kind === 'note' && event.tie) {
    for (const type of event.tie === 'both' ? ['stop', 'start'] : [event.tie]) {
      parts.push(`<tied type="${type}"/>`);
    }
  }
  if (event.kind === 'note' && event.slur) parts.push(`<slur type="${event.slur}" number="1"/>`);
  const marks = (event.articulations ?? []).filter((a) => a !== 'fermata');
  if (marks.length > 0) {
    parts.push(`<articulations>${marks.map((a) => `<${ARTICULATION_TAGS[a]}/>`).join('')}</articulations>`);
  }
  if (event.articulations?.includes('fermata')) parts.push('<fermata/>');
  return parts.length > 0 ? `<notations>${parts.join('')}</notations>` : '';
}

function timedEventToXml(event: Note | Extract<Event, { kind: 'rest' }>, fifths: number, id: string, voice: number): string {
  const duration = `<duration>${durationUnits(event)}</duration><voice>${voice}</voice>` +
    `<type>${event.duration}</type>${'<dot/>'.repeat(event.dots)}`;
  const notations = notationsToXml(event);

  if (event.kind === 'rest') {
    return `${directionsToXml(event)}<note id="${id}"><rest/>${duration}${notations}</note>`;
  }

  // Az átkötést a <tie> (hangzás) és a <tied> (kotta) is jelöli.
  const tie = event.tie
    ? (event.tie === 'both' ? ['stop', 'start'] : [event.tie]).map((t) => `<tie type="${t}"/>`).join('')
    : '';

  return (
    directionsToXml(event) +
    event.pitches
      .map((pitch, index) => {
        const accidental =
          pitch.alter !== 0 && !impliedByKey(pitch.step, pitch.alter, fifths)
            ? `<accidental>${ACCIDENTAL_TAGS[pitch.alter]}</accidental>`
            : '';
        const head = index === 0 ? `<note id="${id}">${tie}` : '<note>';
        // A pontot és a módosítójelet a MusicXML sorrendje szerint kell kiírni.
        const body = pitchToXml(pitch, fifths, index > 0) + duration + accidental;
        return `${head}${body}${index === 0 ? notations : ''}</note>`;
      })
      .join('')
  );
}

function attributesToXml(score: Score, clef: Clef | null, fifths: number | null, first: boolean): string {
  const parts: string[] = [];
  if (first) parts.push(`<divisions>${DIVISIONS}</divisions>`);
  if (fifths !== null) parts.push(`<key><fifths>${fifths}</fifths></key>`);
  if (first) parts.push(`<time><beats>${score.beats}</beats><beat-type>${score.beatType}</beat-type></time>`);
  if (clef !== null) parts.push(`<clef><sign>${CLEF_TAGS[clef].sign}</sign><line>${CLEF_TAGS[clef].line}</line></clef>`);
  return parts.length > 0 ? `<attributes>${parts.join('')}</attributes>` : '';
}

/** Egy szólam eseményei egy ütemen belül, MusicXML-ben. */
function voiceToXml(
  measure: Measure,
  score: Score,
  staffIndex: number,
  voiceIndex: number,
  startIndex: number,
): string {
  let index = startIndex;
  return measure.events
    .map((event) => {
      const id = eventId(staffIndex, voiceIndex, index++);
      if (event.kind === 'clef') return attributesToXml(score, event.clef, null, false);
      if (event.kind === 'key') return attributesToXml(score, null, event.fifths, false);
      // Az ütemvonalakat a splitIntoMeasures már feldolgozta, itt nem maradhat.
      if (event.kind === 'barline') return '';
      return timedEventToXml(event, score.fifths, id, voiceIndex + 1);
    })
    .join('');
}

function staffToXml(staff: Staff, score: Score, id: string, staffIndex: number): string {
  const capacity = measureQuarters(score);
  const perVoice = staff.voices.map((events) => splitIntoMeasures(events, capacity));
  const measureCount = Math.max(...perVoice.map((m) => m.length));

  // A tempójelzés csak az első soron jelenik meg, mint a nyomtatott kottákban.
  const tempo =
    staffIndex === 0
      ? `<direction placement="above"><direction-type><metronome>` +
        `<beat-unit>quarter</beat-unit><per-minute>${score.tempo}</per-minute>` +
        `</metronome></direction-type><sound tempo="${score.tempo}"/></direction>`
      : '';

  // Minden szólamban külön számoljuk, hányadik eseménynél tartunk.
  const offsets = staff.voices.map(() => 0);
  const body: string[] = [];

  for (let i = 0; i < measureCount; i++) {
    const parts: string[] = [];
    const primary = perVoice[0][i];
    if (i === 0) parts.push(attributesToXml(score, staff.clef, score.fifths, true) + tempo);
    if (primary?.left === 'repeat-start') {
      parts.push('<barline location="left"><bar-style>heavy-light</bar-style><repeat direction="forward"/></barline>');
    }

    for (let v = 0; v < perVoice.length; v++) {
      const measure = perVoice[v][i];
      if (!measure) continue;
      if (v > 0) {
        const filled = perVoice[v - 1][i]?.events.reduce((sum, e) => sum + durationUnits(e), 0) ?? 0;
        if (filled > 0) parts.push(`<backup><duration>${filled}</duration></backup>`);
      }
      parts.push(voiceToXml(measure, score, staffIndex, v, offsets[v]));
      offsets[v] += measure.events.length;
    }

    const isLast = i === measureCount - 1;
    const style = primary?.right ?? (isLast ? 'final' : null);
    if (style) {
      const repeat = style === 'repeat-end' ? '<repeat direction="backward"/>' : '';
      parts.push(`<barline location="right"><bar-style>${BAR_STYLE_TAGS[style]}</bar-style>${repeat}</barline>`);
    }
    body.push(`<measure number="${i + 1}">${parts.join('')}</measure>`);
  }

  return `<part id="${id}">${body.join('')}</part>`;
}

export function toMusicXml(score: Score): string {
  const ids = score.staves.map((_, index) => `P${index + 1}`);
  const partList = score.staves
    .map((staff, index) => `<score-part id="${ids[index]}"><part-name>${escapeXml(staff.name)}</part-name></score-part>`)
    .join('');
  const parts = score.staves.map((staff, index) => staffToXml(staff, score, ids[index], index)).join('');
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 4.0 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">
<score-partwise version="4.0"><work><work-title>${escapeXml(score.title)}</work-title></work>
<part-list>${partList}</part-list>${parts}</score-partwise>`;
}

// --- Beolvasás -------------------------------------------------------------

function text(parent: Element | null, tag: string): string | null {
  return parent?.querySelector(tag)?.textContent?.trim() ?? null;
}

function number(parent: Element | null, tag: string, fallback: number): number {
  const value = Number(text(parent, tag));
  return Number.isFinite(value) ? value : fallback;
}

function readClef(element: Element | null): Clef | null {
  if (!element) return null;
  const sign = text(element, 'sign');
  const line = number(element, 'line', 2);
  if (sign === 'F') return 'F';
  if (sign === 'C') return line === 3 ? 'C3' : 'C4';
  if (sign === 'G') return 'G';
  return null;
}

function readPitch(element: Element): Pitch | null {
  const step = text(element, 'step');
  if (!step) return null;
  const alter = Math.max(-1, Math.min(1, number(element, 'alter', 0)));
  return { step: step as Step, alter: alter as -1 | 0 | 1, octave: number(element, 'octave', 4) };
}

function readMarks(note: Element): Partial<Note> {
  const marks: Partial<Note> = {};
  const tieTypes = [...note.querySelectorAll('tie')].map((t) => t.getAttribute('type'));
  if (tieTypes.includes('start') && tieTypes.includes('stop')) marks.tie = 'both';
  else if (tieTypes.includes('start')) marks.tie = 'start';
  else if (tieTypes.includes('stop')) marks.tie = 'stop';

  const slur = note.querySelector('slur')?.getAttribute('type');
  if (slur === 'start' || slur === 'stop') marks.slur = slur;

  const found = ARTICULATIONS.filter((name) =>
    name === 'fermata'
      ? note.querySelector('fermata') !== null
      : note.querySelector(`articulations > ${ARTICULATION_TAGS[name]}`) !== null,
  );
  if (found.length > 0) marks.articulations = found;
  return marks;
}

interface Directions {
  dynamic?: Dynamic;
  wedge?: Wedge;
  marker?: Marker;
}

/** A hang elé írt irányjelek: dinamika, villa, segno/coda. */
function readDirections(directions: Element[]): Directions {
  const marks: Directions = {};
  for (const direction of directions) {
    const dynamic = DYNAMICS.find((name) => direction.querySelector(`dynamics > ${name}`));
    if (dynamic) marks.dynamic = dynamic as Dynamic;
    const wedge = direction.querySelector('wedge')?.getAttribute('type');
    if (wedge === 'crescendo' || wedge === 'diminuendo' || wedge === 'stop') marks.wedge = wedge as Wedge;
    if (direction.querySelector('segno')) marks.marker = 'segno';
    else if (direction.querySelector('coda')) marks.marker = 'coda';
  }
  return marks;
}

function readBarline(element: Element): BarlineStyle | null {
  const repeat = element.querySelector('repeat')?.getAttribute('direction');
  if (repeat === 'forward') return 'repeat-start';
  if (repeat === 'backward') return 'repeat-end';
  const style = text(element, 'bar-style');
  if (style === 'light-light') return 'double';
  if (style === 'light-heavy') return 'final';
  if (style === 'regular') return 'normal';
  return null;
}

/**
 * MusicXML beolvasása a modellbe. Amit a program még nem ismer (pl. szövegsor,
 * több mint két szólam), azt kihagyja – a beolvasott kotta egyszerűbb lehet.
 */
export function fromMusicXml(xml: string): Score {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  if (doc.querySelector('parsererror')) throw new Error('A fájl nem érvényes XML.');
  const root = doc.querySelector('score-partwise');
  if (!root) throw new Error('Csak "score-partwise" MusicXML fájlt tudok megnyitni.');

  const score = emptyScore();
  score.title = text(root, 'work-title') ?? text(root, 'movement-title') ?? 'Névtelen kotta';
  const firstPart = root.querySelector('part');
  if (firstPart) {
    score.fifths = number(firstPart.querySelector('key'), 'fifths', 0);
    const time = firstPart.querySelector('time');
    score.beats = number(time, 'beats', 4);
    score.beatType = number(time, 'beat-type', 4);
    const perMinute = Number(text(firstPart.querySelector('metronome'), 'per-minute'));
    if (Number.isFinite(perMinute) && perMinute > 0) score.tempo = Math.round(perMinute);
  }

  score.staves = [...root.querySelectorAll('part')].map((part, partIndex) =>
    readPart(part, root, partIndex, score.fifths),
  );
  if (score.staves.length === 0) score.staves = emptyScore().staves;
  return score;
}

function readPart(part: Element, root: Element, partIndex: number, initialFifths: number): Staff {
  const id = part.getAttribute('id');
  const name = (id && text(root.querySelector(`score-part[id="${id}"]`), 'part-name')) || `Szólam ${partIndex + 1}`;
  const staffClef = readClef(part.querySelector('clef')) ?? 'G';
  const voices = new Map<string, Event[]>();
  const push = (voice: string, event: Event) => {
    if (!voices.has(voice)) voices.set(voice, []);
    voices.get(voice)!.push(event);
  };

  let seenFirstAttributes = false;
  let fifths = initialFifths;
  let pending: Element[] = []; // az eddig összegyűlt irányjelek

  for (const measure of part.querySelectorAll('measure')) {
    for (const element of measure.children) {
      if (element.tagName === 'direction') {
        pending.push(element);
        continue;
      }
      if (element.tagName === 'attributes') {
        if (!seenFirstAttributes) {
          seenFirstAttributes = true;
          continue; // a kezdő kulcs és hangnem már megvan
        }
        const clef = readClef(element.querySelector('clef'));
        if (clef && clef !== staffClef) push('1', { kind: 'clef', clef });
        const key = element.querySelector('key');
        if (key) {
          const next = number(key, 'fifths', fifths);
          if (next !== fifths) {
            fifths = next;
            push('1', { kind: 'key', fifths: next });
          }
        }
        continue;
      }
      if (element.tagName === 'barline') {
        const style = readBarline(element);
        // A darab végi záróvonalat nem vesszük fel: azt a program magától teszi oda.
        const isLastMeasure = measure === part.querySelector('measure:last-of-type');
        if (style && !(isLastMeasure && style === 'final')) push('1', { kind: 'barline', style });
        continue;
      }
      if (element.tagName !== 'note') continue;

      const voice = text(element, 'voice') ?? '1';
      const type = text(element, 'type');
      if (!DURATIONS.includes(type as Duration)) {
        pending = [];
        continue; // ismeretlen hangérték: kihagyjuk
      }
      const duration = type as Duration;
      const dots = element.querySelectorAll('dot').length;

      if (element.querySelector('chord')) {
        // Akkord további hangja: az előző hanghoz fűzzük.
        const list = voices.get(voice);
        const previous = list?.[list.length - 1];
        const pitch = readPitch(element.querySelector('pitch')!);
        if (previous?.kind === 'note' && pitch) previous.pitches.push(pitch);
        continue;
      }

      const directions = readDirections(pending);
      pending = [];
      if (element.querySelector('rest')) {
        push(voice, { kind: 'rest', duration, dots, ...directions });
        continue;
      }
      const pitchElement = element.querySelector('pitch');
      const pitch = pitchElement && readPitch(pitchElement);
      if (!pitch) continue;
      push(voice, { kind: 'note', pitches: [pitch], duration, dots, ...directions, ...readMarks(element) });
    }
  }

  const ordered = [...voices.entries()].sort(([a], [b]) => a.localeCompare(b, 'en', { numeric: true }));
  return { name, clef: staffClef, voices: ordered.length > 0 ? ordered.map(([, events]) => events) : [[]] };
}
