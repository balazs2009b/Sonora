// A szerkesztő állapota és műveletei: kurzor, beírás, törlés, jelek, undo/redo.
// Itt nincs se DOM, se kottarajzolás – ez teszi jól tesztelhetővé.
import {
  cloneScore,
  emptyScore,
  isTimed,
  newStaff,
  type Articulation,
  type BarlineStyle,
  type Clef,
  type Duration,
  type Dynamic,
  type Event,
  type Marker,
  type Note,
  type Pitch,
  type Score,
  type Step,
  type Wedge,
} from './model';

const HISTORY_LIMIT = 200;

export interface Cursor {
  /** Melyik sor. */
  staff: number;
  /** Melyik szólam a soron belül. */
  voice: number;
  /** Beszúrási hely: 0 = az első esemény elé, events.length = a végére. */
  index: number;
}

/** A következő beírandó hang beállításai. */
export interface InputSettings {
  duration: Duration;
  dots: number;
  alter: -1 | 0 | 1;
  octave: number;
}

export class Editor {
  score: Score;
  cursor: Cursor = { staff: 0, voice: 0, index: 0 };
  input: InputSettings = { duration: 'quarter', dots: 0, alter: 0, octave: 4 };

  private undoStack: Score[] = [];
  private redoStack: Score[] = [];

  constructor(score: Score = emptyScore()) {
    this.score = score;
  }

  get staff() {
    return this.score.staves[this.cursor.staff];
  }

  /** A kurzor szólamának eseményei. */
  get events(): Event[] {
    return this.staff.voices[this.cursor.voice];
  }

  get canUndo() {
    return this.undoStack.length > 0;
  }

  get canRedo() {
    return this.redoStack.length > 0;
  }

  /** Minden módosítás ezen megy keresztül, így lesz undózható. */
  private change(apply: () => void): void {
    this.undoStack.push(cloneScore(this.score));
    if (this.undoStack.length > HISTORY_LIMIT) this.undoStack.shift();
    this.redoStack = [];
    apply();
  }

  undo(): void {
    const previous = this.undoStack.pop();
    if (!previous) return;
    this.redoStack.push(cloneScore(this.score));
    this.score = previous;
    this.clampCursor();
  }

  redo(): void {
    const next = this.redoStack.pop();
    if (!next) return;
    this.undoStack.push(cloneScore(this.score));
    this.score = next;
    this.clampCursor();
  }

  /** Új kotta: a teljes előzmény is törlődik. */
  reset(score: Score): void {
    this.score = score;
    this.undoStack = [];
    this.redoStack = [];
    this.cursor = { staff: 0, voice: 0, index: score.staves[0].voices[0].length };
  }

  private clampCursor(): void {
    this.cursor.staff = Math.min(this.cursor.staff, this.score.staves.length - 1);
    this.cursor.voice = Math.min(this.cursor.voice, this.staff.voices.length - 1);
    this.cursor.index = Math.min(this.cursor.index, this.events.length);
  }

  // --- Beírás és törlés ----------------------------------------------------

  insert(event: Event): void {
    this.change(() => {
      this.events.splice(this.cursor.index, 0, event);
      this.cursor.index++;
    });
  }

  insertNote(step: Step): void {
    const { duration, dots, alter, octave } = this.input;
    this.insert({ kind: 'note', pitches: [{ step, alter, octave }], duration, dots });
  }

  insertRest(): void {
    this.insert({ kind: 'rest', duration: this.input.duration, dots: this.input.dots });
  }

  insertBarline(style: BarlineStyle): void {
    this.insert({ kind: 'barline', style });
  }

  insertClefChange(clef: Clef): void {
    this.insert({ kind: 'clef', clef });
  }

  insertKeyChange(fifths: number): void {
    this.insert({ kind: 'key', fifths });
  }

  /** A kurzor előtti esemény törlése (Backspace). */
  deleteBefore(): void {
    if (this.cursor.index === 0) return;
    this.change(() => {
      this.events.splice(this.cursor.index - 1, 1);
      this.cursor.index--;
    });
  }

  /** A kurzor utáni esemény törlése (Delete). */
  deleteAfter(): void {
    if (this.cursor.index >= this.events.length) return;
    this.change(() => {
      this.events.splice(this.cursor.index, 1);
    });
  }

  // --- Mozgás --------------------------------------------------------------

  moveBy(step: number): void {
    this.cursor.index = Math.max(0, Math.min(this.events.length, this.cursor.index + step));
  }

  moveToStart(): void {
    this.cursor.index = 0;
  }

  moveToEnd(): void {
    this.cursor.index = this.events.length;
  }

  selectStaff(index: number): void {
    if (index < 0 || index >= this.score.staves.length) return;
    this.cursor.staff = index;
    this.cursor.voice = 0;
    this.cursor.index = this.events.length;
  }

  selectVoice(index: number): void {
    if (index < 0 || index >= this.staff.voices.length) return;
    this.cursor.voice = index;
    this.cursor.index = this.events.length;
  }

  /** A kurzor előtti esemény – erre vonatkoznak a jelek. */
  currentEvent(): Event | null {
    return this.events[this.cursor.index - 1] ?? null;
  }

  /** A kurzor előtti hang (szünetre és ütemvonalra null). */
  currentNote(): Note | null {
    const event = this.currentEvent();
    return event?.kind === 'note' ? event : null;
  }

  // --- Akkord --------------------------------------------------------------

  /** További hang a kurzor előtti hanghoz. Azonos magasságot nem vesz fel kétszer. */
  addChordTone(step: Step): boolean {
    const note = this.currentNote();
    if (!note) return false;
    const pitch: Pitch = { step, alter: this.input.alter, octave: this.input.octave };
    if (note.pitches.some((p) => p.step === pitch.step && p.alter === pitch.alter && p.octave === pitch.octave)) {
      return false;
    }
    this.change(() => {
      // A hangokat alulról fölfelé rendezzük, mint a kottában.
      note.pitches = [...note.pitches, pitch].sort((a, b) => pitchValue(a) - pitchValue(b));
    });
    return true;
  }

  /** Az akkord legfelső hangjának elvétele. Egyetlen hangot nem vesz el. */
  removeChordTone(): boolean {
    const note = this.currentNote();
    if (!note || note.pitches.length < 2) return false;
    this.change(() => note.pitches.pop());
    return true;
  }

  // --- Jelek ---------------------------------------------------------------

  /** Be- vagy kikapcsol egy jelet (staccato, ékezet, korona…) a kurzor előtti eseményen. */
  toggleArticulation(name: Articulation): boolean {
    const event = this.currentEvent();
    if (!event || !isTimed(event)) return false;
    this.change(() => {
      const current = event.articulations ?? [];
      const next = current.includes(name) ? current.filter((a) => a !== name) : [...current, name];
      if (next.length > 0) event.articulations = next;
      else delete event.articulations;
    });
    return true;
  }

  /** Dinamikai jel; ugyanazt újra megadva leveszi. */
  setDynamic(value: Dynamic | null): boolean {
    return this.setMark((event) => {
      if (value === null || event.dynamic === value) delete event.dynamic;
      else event.dynamic = value;
    });
  }

  /** Crescendo/decrescendo villa kezdete vagy vége. */
  setWedge(value: Wedge | null): boolean {
    return this.setMark((event) => {
      if (value === null || event.wedge === value) delete event.wedge;
      else event.wedge = value;
    });
  }

  setMarker(value: Marker | null): boolean {
    return this.setMark((event) => {
      if (value === null || event.marker === value) delete event.marker;
      else event.marker = value;
    });
  }

  /** Kötőív kezdete vagy vége a kurzor előtti hangon. */
  setSlur(value: 'start' | 'stop' | null): boolean {
    const note = this.currentNote();
    if (!note) return false;
    this.change(() => {
      if (value === null || note.slur === value) delete note.slur;
      else note.slur = value;
    });
    return true;
  }

  /**
   * Átkötés a kurzor előtti hang és a következő között. Csak akkor teszi oda,
   * ha a két hang magassága megegyezik – különben az átkötésnek nincs értelme.
   */
  toggleTie(): boolean {
    const index = this.cursor.index - 1;
    const note = this.currentNote();
    const next = this.events[index + 1];
    if (!note || next?.kind !== 'note' || !samePitches(note, next)) return false;

    this.change(() => {
      const on = note.tie === 'start' || note.tie === 'both';
      if (on) {
        removeTieSide(note, 'start');
        removeTieSide(next, 'stop');
      } else {
        addTieSide(note, 'start');
        addTieSide(next, 'stop');
      }
    });
    return true;
  }

  private setMark(apply: (event: Extract<Event, { kind: 'note' | 'rest' }>) => void): boolean {
    const event = this.currentEvent();
    if (!event || !isTimed(event)) return false;
    this.change(() => apply(event));
    return true;
  }

  // --- Sorok és szólamok ---------------------------------------------------

  /** Új üres sor beszúrása a megadott helyre (a többi sor lejjebb csúszik). */
  addStaffAt(index: number): void {
    this.change(() => {
      this.score.staves.splice(index, 0, newStaff(this.score.staves.length + 1));
      this.cursor = { staff: index, voice: 0, index: 0 };
    });
  }

  removeStaff(index: number): void {
    if (this.score.staves.length <= 1) return;
    this.change(() => {
      this.score.staves.splice(index, 1);
      this.cursor = { staff: Math.min(index, this.score.staves.length - 1), voice: 0, index: 0 };
      this.cursor.index = this.events.length;
    });
  }

  /** Második (vagy további) szólam a mostani soron. */
  addVoice(): void {
    this.change(() => {
      this.staff.voices.push([]);
      this.cursor.voice = this.staff.voices.length - 1;
      this.cursor.index = 0;
    });
  }

  removeVoice(index: number): void {
    if (this.staff.voices.length <= 1) return;
    this.change(() => {
      this.staff.voices.splice(index, 1);
      this.cursor.voice = Math.min(index, this.staff.voices.length - 1);
      this.cursor.index = this.events.length;
    });
  }

  /** Kotta-szintű vagy sor-szintű beállítás módosítása (kulcs, hangnem, ütemmutató…). */
  update(apply: (score: Score) => void): void {
    this.change(() => apply(this.score));
    this.clampCursor();
  }
}

/** Félhangban számolt magasság, a hangok rendezéséhez. */
function pitchValue(pitch: Pitch): number {
  const base: Record<Step, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  return pitch.octave * 12 + base[pitch.step] + pitch.alter;
}

function samePitches(a: Note, b: Note): boolean {
  return (
    a.pitches.length === b.pitches.length &&
    a.pitches.every((pitch, index) => pitchValue(pitch) === pitchValue(b.pitches[index]))
  );
}

/** Átkötés egyik végének hozzáadása úgy, hogy a másik vége megmaradjon. */
function addTieSide(note: Note, side: 'start' | 'stop'): void {
  note.tie = note.tie && note.tie !== side ? 'both' : side;
}

/** Átkötés egyik végének elvétele; a másik vége marad. */
function removeTieSide(note: Note, side: 'start' | 'stop'): void {
  if (note.tie === 'both') note.tie = side === 'start' ? 'stop' : 'start';
  else if (note.tie === side) delete note.tie;
}
