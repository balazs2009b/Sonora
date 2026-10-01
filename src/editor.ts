// A szerkesztő állapota és műveletei: kurzor, beírás, törlés, undo/redo.
// Itt nincs se DOM, se kottarajzolás – ez teszi jól tesztelhetővé.
import { cloneScore, emptyScore, newStaff, type Duration, type Event, type Score, type Step } from './model';

const HISTORY_LIMIT = 200;

export interface Cursor {
  /** Melyik szólam (sor). */
  staff: number;
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
  cursor: Cursor = { staff: 0, index: 0 };
  input: InputSettings = { duration: 'quarter', dots: 0, alter: 0, octave: 4 };

  private undoStack: Score[] = [];
  private redoStack: Score[] = [];

  constructor(score: Score = emptyScore()) {
    this.score = score;
  }

  get staff() {
    return this.score.staves[this.cursor.staff];
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
    this.cursor = { staff: 0, index: score.staves[0].events.length };
  }

  private clampCursor(): void {
    this.cursor.staff = Math.min(this.cursor.staff, this.score.staves.length - 1);
    this.cursor.index = Math.min(this.cursor.index, this.staff.events.length);
  }

  // --- Beírás és törlés ----------------------------------------------------

  insert(event: Event): void {
    this.change(() => {
      this.staff.events.splice(this.cursor.index, 0, event);
      this.cursor.index++;
    });
  }

  insertNote(step: Step): void {
    const { duration, dots, alter, octave } = this.input;
    this.insert({ kind: 'note', step, alter, octave, duration, dots });
  }

  insertRest(): void {
    this.insert({ kind: 'rest', duration: this.input.duration, dots: this.input.dots });
  }

  /** A kurzor előtti esemény törlése (Backspace). */
  deleteBefore(): void {
    if (this.cursor.index === 0) return;
    this.change(() => {
      this.staff.events.splice(this.cursor.index - 1, 1);
      this.cursor.index--;
    });
  }

  /** A kurzor utáni esemény törlése (Delete). */
  deleteAfter(): void {
    if (this.cursor.index >= this.staff.events.length) return;
    this.change(() => {
      this.staff.events.splice(this.cursor.index, 1);
    });
  }

  // --- Mozgás --------------------------------------------------------------

  moveBy(step: number): void {
    this.cursor.index = Math.max(0, Math.min(this.staff.events.length, this.cursor.index + step));
  }

  moveToStart(): void {
    this.cursor.index = 0;
  }

  moveToEnd(): void {
    this.cursor.index = this.staff.events.length;
  }

  selectStaff(index: number): void {
    if (index < 0 || index >= this.score.staves.length) return;
    this.cursor.staff = index;
    this.cursor.index = Math.min(this.cursor.index, this.staff.events.length);
  }

  /** A kurzor előtti esemény – ezt mutatjuk kiemelve a kottán. */
  currentEvent(): Event | null {
    return this.staff.events[this.cursor.index - 1] ?? null;
  }

  // --- Sorok ---------------------------------------------------------------

  /** Új üres sor beszúrása a megadott helyre (a többi sor lejjebb csúszik). */
  addStaffAt(index: number): void {
    this.change(() => {
      this.score.staves.splice(index, 0, newStaff(this.score.staves.length + 1));
      this.cursor = { staff: index, index: 0 };
    });
  }

  removeStaff(index: number): void {
    if (this.score.staves.length <= 1) return;
    this.change(() => {
      this.score.staves.splice(index, 1);
      this.cursor = { staff: Math.min(index, this.score.staves.length - 1), index: 0 };
      this.cursor.index = this.staff.events.length;
    });
  }

  /** Kotta-szintű vagy sor-szintű beállítás módosítása (kulcs, hangnem, ütemmutató…). */
  update(apply: (score: Score) => void): void {
    this.change(() => apply(this.score));
    this.clampCursor();
  }
}
