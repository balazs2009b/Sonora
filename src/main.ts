// A felhasználói felület: szerkesztés, nézetváltás, transzponálás, mentés, nyomtatás.
import './style.css';
import { Editor } from './editor';
import {
  CLEF_NAMES,
  DURATIONS,
  emptyScore,
  isTimed,
  type Articulation,
  type BarlineStyle,
  type Clef,
  type Duration,
  type Dynamic,
  type Marker,
  type Step,
  type Wedge,
} from './model';
import { eventId, fromMusicXml, toMusicXml } from './musicxml';
import { intervalLabel, MAX_TRANSPOSE, ScoreEngine } from './score';
import { applyView, installGradients, type ViewMode } from './noteheads';

const editor = new Editor();
const view = { mode: 'color' as ViewMode, outline: true, semitones: 0 };
let pitches = new Map<string, number>();

const byId = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const pagesEl = byId('pages');
const statusEl = byId('status');

/** A magyar hangnevek a C-dúrtól a kvintkör két irányába. */
const KEY_NAMES: Record<number, string> = {
  [-6]: 'Gesz-dúr / esz-moll', [-5]: 'Desz-dúr / b-moll', [-4]: 'Asz-dúr / f-moll',
  [-3]: 'Esz-dúr / c-moll', [-2]: 'B-dúr / g-moll', [-1]: 'F-dúr / d-moll',
  0: 'C-dúr / a-moll',
  1: 'G-dúr / e-moll', 2: 'D-dúr / h-moll', 3: 'A-dúr / fisz-moll',
  4: 'E-dúr / cisz-moll', 5: 'H-dúr / gisz-moll', 6: 'Fisz-dúr / disz-moll',
};

function setStatus(text: string, isError = false): void {
  statusEl.textContent = text;
  statusEl.classList.toggle('error', isError);
}

// --- Kirajzolás ------------------------------------------------------------

function render(engine: ScoreEngine): void {
  try {
    const result = engine.render({ kind: 'text', data: toMusicXml(editor.score) }, view.semitones);
    pitches = result.pitches;
    pagesEl.innerHTML = result.pages.map((svg) => `<div class="page">${svg}</div>`).join('');
    restyle();
    drawCaret();
    const { staff, voice, index } = editor.cursor;
    const total = editor.events.length;
    const voiceLabel = editor.staff.voices.length > 1 ? `, ${voice + 1}. szólam` : '';
    setStatus(
      `${editor.score.title} · ${staff + 1}. sor${voiceLabel}, ${index}/${total} elem · ${result.pages.length} oldal`,
    );
  } catch (err) {
    setStatus(err instanceof Error ? err.message : String(err), true);
  }
  syncPanel();
}

/** Csak a színezést frissíti, újrarajzolás nélkül. */
function restyle(): void {
  for (const page of pagesEl.querySelectorAll<SVGSVGElement>('.page > svg')) {
    applyView(page, view.mode, pitches, view.outline);
  }
  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-mode]')) {
    button.setAttribute('aria-pressed', String(button.dataset.mode === view.mode));
  }
}

/**
 * Függőleges vonal a beírás helyén. A vonalat az érintett hang szülőjébe tesszük,
 * így ugyanabban a koordinátarendszerben van, bármilyen nagyítás mellett.
 */
function drawCaret(): void {
  const { staff, voice, index } = editor.cursor;
  const events = editor.events;
  if (events.length === 0) return;

  // Ütemvonalnak és kulcsváltásnak nincs saját kottajele, ezért a legközelebbi hangot keressük.
  const step = index === 0 ? 1 : -1;
  let position = index === 0 ? 0 : index - 1;
  while (position >= 0 && position < events.length && !isTimed(events[position])) position += step;
  if (position < 0 || position >= events.length) return;

  const after = index > 0;
  const target = pagesEl.querySelector<SVGGElement>(`#${CSS.escape(eventId(staff, voice, position))}`);
  if (!target?.parentNode) return;

  const box = target.getBBox();
  const caret = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  caret.setAttribute('class', 'caret');
  caret.setAttribute('x', String(after ? box.x + box.width + 30 : box.x - 60));
  caret.setAttribute('y', String(box.y - 300));
  caret.setAttribute('width', '25');
  caret.setAttribute('height', String(box.height + 600));
  target.parentNode.appendChild(caret);
}

// --- Vezérlőpult -----------------------------------------------------------

function syncPanel(): void {
  const { score, cursor, input } = editor;
  byId<HTMLInputElement>('title').value = score.title;
  byId<HTMLInputElement>('beats').value = String(score.beats);
  byId<HTMLSelectElement>('beat-type').value = String(score.beatType);
  byId<HTMLInputElement>('tempo').value = String(score.tempo);
  byId<HTMLSelectElement>('fifths').value = String(score.fifths);
  byId<HTMLSelectElement>('clef').value = editor.staff.clef;
  byId<HTMLInputElement>('staff-name').value = editor.staff.name;
  byId<HTMLButtonElement>('remove-voice').disabled = editor.staff.voices.length < 2;
  byId('octave').textContent = String(input.octave);
  byId('dots').setAttribute('aria-pressed', String(input.dots > 0));
  byId('dots').textContent = input.dots === 2 ? '••' : '•';
  byId<HTMLButtonElement>('undo').disabled = !editor.canUndo;
  byId<HTMLButtonElement>('redo').disabled = !editor.canRedo;

  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-duration]')) {
    button.setAttribute('aria-pressed', String(button.dataset.duration === input.duration));
  }
  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-alter]')) {
    button.setAttribute('aria-pressed', String(Number(button.dataset.alter) === input.alter));
  }

  // A jelgombok azt mutatják, mi van a kurzor előtti hangon.
  const current = editor.currentEvent();
  const timed = current && isTimed(current) ? current : null;
  const note = editor.currentNote();
  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-articulation]')) {
    const name = button.dataset.articulation as Articulation;
    button.setAttribute('aria-pressed', String(timed?.articulations?.includes(name) ?? false));
    button.disabled = !timed;
  }
  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-dynamic]')) {
    button.setAttribute('aria-pressed', String(timed?.dynamic === button.dataset.dynamic));
    button.disabled = !timed;
  }
  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-wedge]')) {
    button.setAttribute('aria-pressed', String(timed?.wedge === button.dataset.wedge));
    button.disabled = !timed;
  }
  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-marker]')) {
    button.setAttribute('aria-pressed', String(timed?.marker === button.dataset.marker));
    button.disabled = !timed;
  }
  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-slur]')) {
    button.setAttribute('aria-pressed', String(note?.slur === button.dataset.slur));
    button.disabled = !note;
  }
  const tieButton = byId<HTMLButtonElement>('tie');
  tieButton.setAttribute('aria-pressed', String(note?.tie === 'start' || note?.tie === 'both'));
  tieButton.disabled = !note;
  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-chord]')) button.disabled = !note;
  byId<HTMLButtonElement>('chord-remove').disabled = !note || note.pitches.length < 2;

  byId('voice-list').innerHTML = editor.staff.voices
    .map(
      (_, index) =>
        `<button type="button" data-voice="${index}" aria-pressed="${index === cursor.voice}">` +
        `${index + 1}. szólam</button>`,
    )
    .join('');

  byId('staff-list').innerHTML = score.staves
    .map(
      (staff, index) =>
        `<li><button type="button" data-staff="${index}" aria-pressed="${index === cursor.staff}">` +
        `${index + 1}. ${staff.name} <span class="muted">(${CLEF_NAMES[staff.clef]})</span></button></li>`,
    )
    .join('');
}

function fillSelects(): void {
  const keys = Object.entries(KEY_NAMES)
    .map(([value, name]) => `<option value="${value}">${name}</option>`)
    .join('');
  const clefs = Object.entries(CLEF_NAMES)
    .map(([value, name]) => `<option value="${value}">${name}</option>`)
    .join('');
  byId<HTMLSelectElement>('fifths').innerHTML = keys;
  byId<HTMLSelectElement>('key-change').innerHTML = keys;
  byId<HTMLSelectElement>('clef').innerHTML = clefs;
  byId<HTMLSelectElement>('clef-change').innerHTML = clefs;
  byId<HTMLSelectElement>('clef-change').value = 'F';
}

// --- Fájlkezelés -----------------------------------------------------------

function saveFile(): void {
  const blob = new Blob([toMusicXml(editor.score)], { type: 'application/vnd.recordare.musicxml+xml' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${editor.score.title.replace(/[^\p{L}\p{N} _-]/gu, '').trim() || 'kotta'}.musicxml`;
  // A letöltés csak akkor kapja meg a fájlnevet, ha a link az oldal része.
  document.body.append(link);
  link.click();
  link.remove();
  // A felszabadítás csak a letöltés elindulása után jöhet, különben elvész a fájlnév.
  setTimeout(() => URL.revokeObjectURL(link.href), 10_000);
}

async function openFile(file: File, engine: ScoreEngine): Promise<void> {
  try {
    if (file.name.toLowerCase().endsWith('.mxl')) {
      throw new Error('A tömörített .mxl fájlt előbb csomagold ki, és a benne lévő .musicxml fájlt nyisd meg.');
    }
    editor.reset(fromMusicXml(await file.text()));
    view.semitones = 0;
    render(engine);
  } catch (err) {
    setStatus(err instanceof Error ? err.message : String(err), true);
  }
}

// --- Billentyűzet ----------------------------------------------------------

const NOTE_KEYS: Record<string, { step: Step; alter?: -1 }> = {
  c: { step: 'C' }, d: { step: 'D' }, e: { step: 'E' }, f: { step: 'F' },
  g: { step: 'G' }, a: { step: 'A' }, h: { step: 'B' },
  b: { step: 'B', alter: -1 }, // magyar B = bé
};

function handleKey(event: KeyboardEvent, engine: ScoreEngine): void {
  // Szövegmezőben a billentyűk a szokásos módon működjenek.
  if (event.target instanceof HTMLElement && ['INPUT', 'SELECT', 'TEXTAREA'].includes(event.target.tagName)) return;

  const key = event.key.toLowerCase();
  if (event.ctrlKey || event.metaKey) {
    if (key === 'z') editor.undo();
    else if (key === 'y') editor.redo();
    else return;
  } else if (NOTE_KEYS[key]) {
    const { step, alter } = NOTE_KEYS[key];
    const saved = editor.input.alter;
    if (alter !== undefined) editor.input.alter = alter;
    editor.insertNote(step);
    editor.input.alter = saved;
  } else if (key >= '1' && key <= '5') {
    editor.input.duration = DURATIONS[Number(key) - 1];
    syncPanel();
    return;
  } else if (key === '.') {
    editor.input.dots = (editor.input.dots + 1) % 3;
    syncPanel();
    return;
  } else if (key === '+' || key === '-' || key === '0') {
    editor.input.alter = key === '+' ? 1 : key === '-' ? -1 : 0;
    syncPanel();
    return;
  } else if (key === 'arrowup' || key === 'arrowdown') {
    setOctave(editor.input.octave + (key === 'arrowup' ? 1 : -1));
    return;
  } else if (key === 's') {
    editor.insertRest();
  } else if (key === 'arrowleft') {
    editor.moveBy(-1);
  } else if (key === 'arrowright') {
    editor.moveBy(1);
  } else if (key === 'home') {
    editor.moveToStart();
  } else if (key === 'end') {
    editor.moveToEnd();
  } else if (key === 'backspace') {
    editor.deleteBefore();
  } else if (key === 'delete') {
    editor.deleteAfter();
  } else {
    return;
  }
  event.preventDefault();
  render(engine);
}

function setOctave(value: number): void {
  editor.input.octave = Math.max(1, Math.min(7, value));
  syncPanel();
}

// --- Indulás ---------------------------------------------------------------

async function main(): Promise<void> {
  installGradients(document);
  fillSelects();
  editor.reset(emptyScore());
  syncPanel();

  const engine = await ScoreEngine.create();
  render(engine);
  setStatus('Új kotta. Írd be a hangokat a billentyűzetről (C D E F G A H) vagy a gombokkal.');

  const redraw = () => render(engine);
  const on = (id: string, handler: () => void) => byId(id).addEventListener('click', () => { handler(); redraw(); });

  // Fájl
  on('new', () => {
    editor.reset(emptyScore());
    view.semitones = 0;
  });
  byId('save').addEventListener('click', saveFile);
  byId('print').addEventListener('click', () => window.print());
  byId<HTMLInputElement>('file').addEventListener('change', (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) void openFile(file, engine);
  });

  // Nézet
  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-mode]')) {
    button.addEventListener('click', () => {
      view.mode = button.dataset.mode as ViewMode;
      restyle();
    });
  }
  byId<HTMLInputElement>('outline').addEventListener('change', (e) => {
    view.outline = (e.target as HTMLInputElement).checked;
    restyle();
  });

  // Transzponálás
  const transpose = (direction: 1 | -1) => {
    const next = view.semitones + direction * Number(byId<HTMLSelectElement>('step').value);
    if (Math.abs(next) > MAX_TRANSPOSE) {
      setStatus('Legfeljebb egy oktávval lehet feljebb vagy lejjebb vinni.', true);
      return;
    }
    view.semitones = next;
    render(engine);
    byId('transpose-label').textContent = view.semitones === 0 ? '' : intervalLabel(view.semitones);
  };
  byId('up').addEventListener('click', () => transpose(1));
  byId('down').addEventListener('click', () => transpose(-1));
  on('reset', () => {
    view.semitones = 0;
    byId('transpose-label').textContent = '';
  });

  // Kotta és sor beállításai
  const bindValue = (id: string, apply: (value: string) => void) =>
    byId<HTMLInputElement>(id).addEventListener('change', (e) => {
      const field = e.target as HTMLInputElement;
      editor.update(() => apply(field.value));
      field.blur(); // hogy a billentyűs beírás rögtön folytatódhasson
      redraw();
    });
  bindValue('title', (value) => (editor.score.title = value || 'Névtelen'));
  bindValue('beats', (value) => (editor.score.beats = Math.max(1, Math.min(16, Number(value) || 4))));
  bindValue('beat-type', (value) => (editor.score.beatType = Number(value)));
  bindValue('tempo', (value) => (editor.score.tempo = Math.max(20, Math.min(300, Number(value) || 100))));
  bindValue('fifths', (value) => (editor.score.fifths = Number(value)));
  bindValue('clef', (value) => (editor.staff.clef = value as Clef));
  bindValue('staff-name', (value) => (editor.staff.name = value || editor.staff.name));

  // Sorok
  on('add-staff', () => editor.addStaffAt(editor.score.staves.length));
  on('insert-staff', () => editor.addStaffAt(editor.cursor.staff));
  on('remove-staff', () => editor.removeStaff(editor.cursor.staff));
  byId('staff-list').addEventListener('click', (e) => {
    const button = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-staff]');
    if (!button) return;
    editor.selectStaff(Number(button.dataset.staff));
    redraw();
  });

  // Beírás
  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-note]')) {
    button.addEventListener('click', () => {
      editor.insertNote(button.dataset.note as Step);
      redraw();
    });
  }
  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-duration]')) {
    button.addEventListener('click', () => {
      editor.input.duration = button.dataset.duration as Duration;
      syncPanel();
    });
  }
  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-alter]')) {
    button.addEventListener('click', () => {
      editor.input.alter = Number(button.dataset.alter) as -1 | 0 | 1;
      syncPanel();
    });
  }
  byId('dots').addEventListener('click', () => {
    editor.input.dots = (editor.input.dots + 1) % 3;
    syncPanel();
  });
  byId('octave-up').addEventListener('click', () => setOctave(editor.input.octave + 1));
  byId('octave-down').addEventListener('click', () => setOctave(editor.input.octave - 1));
  on('rest', () => editor.insertRest());
  on('delete', () => editor.deleteBefore());
  on('undo', () => editor.undo());
  on('redo', () => editor.redo());

  byId('voice-list').addEventListener('click', (e) => {
    const button = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-voice]');
    if (!button) return;
    editor.selectVoice(Number(button.dataset.voice));
    redraw();
  });
  on('add-voice', () => editor.addVoice());
  on('remove-voice', () => editor.removeVoice(editor.cursor.voice));

  // Akkord
  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-chord]')) {
    button.addEventListener('click', () => {
      editor.addChordTone(button.dataset.chord as Step);
      redraw();
    });
  }
  on('chord-remove', () => editor.removeChordTone());

  // Előadási jelek
  const bindMarks = <T extends string>(attribute: string, apply: (value: T) => void) => {
    for (const button of document.querySelectorAll<HTMLButtonElement>(`[data-${attribute}]`)) {
      button.addEventListener('click', () => {
        apply(button.dataset[attribute] as T);
        redraw();
      });
    }
  };
  bindMarks<Articulation>('articulation', (name) => editor.toggleArticulation(name));
  bindMarks<Dynamic>('dynamic', (value) => editor.setDynamic(value));
  bindMarks<Wedge>('wedge', (value) => editor.setWedge(value));
  bindMarks<Marker>('marker', (value) => editor.setMarker(value));
  bindMarks<'start' | 'stop'>('slur', (value) => editor.setSlur(value));
  bindMarks<BarlineStyle>('barline', (style) => editor.insertBarline(style));
  byId('tie').addEventListener('click', () => {
    if (!editor.toggleTie()) {
      setStatus('Átkötés csak két egyforma magasságú, egymás utáni hang közé tehető.', true);
      return;
    }
    redraw();
  });

  // Kulcs- és hangnemváltás a darab közben
  on('add-clef-change', () => editor.insertClefChange(byId<HTMLSelectElement>('clef-change').value as Clef));
  on('add-key-change', () => editor.insertKeyChange(Number(byId<HTMLSelectElement>('key-change').value)));

  document.addEventListener('keydown', (e) => handleKey(e, engine));
}

// Webről megnyitva: telepíthető app, ami internet nélkül is indul.
// Fájlból (file://) megnyitva nincs rá szükség – és a böngésző nem is engedi.
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('./sw.js').catch((err) => console.warn('Service worker hiba:', err));
}

main().catch((err) => setStatus(`Hiba indításkor: ${err instanceof Error ? err.message : err}`, true));
