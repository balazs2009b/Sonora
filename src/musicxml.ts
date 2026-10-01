// A modell és a MusicXML fájlformátum közötti átjárás.
// Ez a Finale és minden más kottaprogram felé a közös nyelv.
import {
  DIVISIONS,
  DURATIONS,
  durationUnits,
  emptyScore,
  measureQuarters,
  splitIntoMeasures,
  type Clef,
  type Duration,
  type Event,
  type Score,
  type Staff,
  type Step,
} from './model';

const CLEF_TAGS: Record<Clef, { sign: string; line: number }> = {
  G: { sign: 'G', line: 2 },
  F: { sign: 'F', line: 4 },
  C3: { sign: 'C', line: 3 },
  C4: { sign: 'C', line: 4 },
};

const ACCIDENTAL_TAGS: Record<number, string> = { [-1]: 'flat', 0: 'natural', 1: 'sharp' };

function escapeXml(text: string): string {
  return text.replace(/[<>&'"]/g, (c) => `&#${c.charCodeAt(0)};`);
}

/** A kurzorhoz és a kiemeléshez minden esemény azonosítót kap: ev-<sor>-<sorszám>. */
export function eventId(staffIndex: number, eventIndex: number): string {
  return `ev-${staffIndex}-${eventIndex}`;
}

function eventToXml(event: Event, fifths: number, id: string): string {
  const parts = [`<note id="${id}">`];
  if (event.kind === 'rest') {
    parts.push('<rest/>');
  } else {
    parts.push(`<pitch><step>${event.step}</step>`);
    if (event.alter !== 0) parts.push(`<alter>${event.alter}</alter>`);
    parts.push(`<octave>${event.octave}</octave></pitch>`);
  }
  parts.push(`<duration>${durationUnits(event)}</duration>`);
  parts.push(`<type>${event.duration}</type>`);
  parts.push('<dot/>'.repeat(event.dots));
  // A módosítójelet csak akkor írjuk ki, ha nem következik az előjegyzésből.
  if (event.kind === 'note' && event.alter !== 0 && !impliedByKey(event.step, event.alter, fifths)) {
    parts.push(`<accidental>${ACCIDENTAL_TAGS[event.alter]}</accidental>`);
  }
  parts.push('</note>');
  return parts.join('');
}

/** Igaz, ha az előjegyzés már tartalmazza ezt a módosítást (pl. G-dúrban az F#). */
function impliedByKey(step: Step, alter: number, fifths: number): boolean {
  const sharps: Step[] = ['F', 'C', 'G', 'D', 'A', 'E', 'B'];
  const flats: Step[] = ['B', 'E', 'A', 'D', 'G', 'C', 'F'];
  if (alter === 1) return fifths > 0 && sharps.slice(0, fifths).includes(step);
  if (alter === -1) return fifths < 0 && flats.slice(0, -fifths).includes(step);
  return false;
}

function staffToXml(staff: Staff, score: Score, id: string, staffIndex: number): string {
  const capacity = measureQuarters(score);
  const measures = splitIntoMeasures(staff.events, capacity);
  const clef = CLEF_TAGS[staff.clef];
  // A tempójelzés csak az első soron jelenik meg, mint a nyomtatott kottákban.
  const tempo =
    staffIndex === 0
      ? `<direction placement="above"><direction-type><metronome>` +
        `<beat-unit>quarter</beat-unit><per-minute>${score.tempo}</per-minute>` +
        `</metronome></direction-type><sound tempo="${score.tempo}"/></direction>`
      : '';
  const attributes =
    `<attributes><divisions>${DIVISIONS}</divisions>` +
    `<key><fifths>${score.fifths}</fifths></key>` +
    `<time><beats>${score.beats}</beats><beat-type>${score.beatType}</beat-type></time>` +
    `<clef><sign>${clef.sign}</sign><line>${clef.line}</line></clef></attributes>${tempo}`;

  let eventIndex = 0;
  const body = measures
    .map((events, index) => {
      const head = index === 0 ? attributes : '';
      const tail =
        index === measures.length - 1
          ? '<barline location="right"><bar-style>light-heavy</bar-style></barline>'
          : '';
      const notes = events.map((e) => eventToXml(e, score.fifths, eventId(staffIndex, eventIndex++))).join('');
      return `<measure number="${index + 1}">${head}${notes}${tail}</measure>`;
    })
    .join('');

  return `<part id="${id}">${body}</part>`;
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

function readClef(part: Element): Clef {
  const clef = part.querySelector('clef');
  const sign = text(clef, 'sign');
  const line = number(clef, 'line', 2);
  if (sign === 'F') return 'F';
  if (sign === 'C') return line === 3 ? 'C3' : 'C4';
  return 'G';
}

function readEvent(note: Element): Event | null {
  const type = text(note, 'type');
  if (!DURATIONS.includes(type as Duration)) return null; // ismeretlen hangérték: kihagyjuk
  const duration = type as Duration;
  const dots = note.querySelectorAll('dot').length;
  if (note.querySelector('rest')) return { kind: 'rest', duration, dots };

  const pitch = note.querySelector('pitch');
  const step = text(pitch, 'step');
  if (!step) return null;
  const alter = Math.max(-1, Math.min(1, number(pitch, 'alter', 0)));
  return {
    kind: 'note',
    step: step as Step,
    alter: alter as -1 | 0 | 1,
    octave: number(pitch, 'octave', 4),
    duration,
    dots,
  };
}

/**
 * MusicXML beolvasása a modellbe. Amit a szerkesztő még nem tud (akkordok,
 * több szólam egy soron, sor közbeni kulcsváltás), azt kihagyja – ezért a
 * beolvasott kotta egyszerűbb lehet az eredetinél.
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

  score.staves = [...root.querySelectorAll('part')].map((part, index) => {
    const id = part.getAttribute('id');
    const name = (id && text(root.querySelector(`score-part[id="${id}"]`), 'part-name')) || `Szólam ${index + 1}`;
    const events: Event[] = [];
    for (const note of part.querySelectorAll('note')) {
      // Akkord második hangja és a nem első szólam: kihagyjuk (lásd a leírást).
      if (note.querySelector('chord')) continue;
      const voice = text(note, 'voice');
      if (voice && voice !== '1') continue;
      const event = readEvent(note);
      if (event) events.push(event);
    }
    return { name, clef: readClef(part), events };
  });

  if (score.staves.length === 0) score.staves = emptyScore().staves;
  return score;
}
