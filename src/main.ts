// A felhasználói felület: gombok, fájlmegnyitás, nézetváltás, transzponálás, nyomtatás.
import './style.css';
import sampleScore from '../samples/proba.musicxml?raw';
import { intervalLabel, MAX_TRANSPOSE, ScoreEngine, type ScoreSource } from './score';
import { applyView, installGradients, type ViewMode } from './noteheads';

const state = {
  source: null as ScoreSource | null,
  title: '',
  semitones: 0,
  mode: 'color' as ViewMode,
  outline: true,
  pitches: new Map<string, number>(),
};

const byId = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const pagesEl = byId<HTMLElement>('pages');
const statusEl = byId<HTMLElement>('status');
const stepEl = byId<HTMLSelectElement>('step');

function setStatus(text: string, isError = false): void {
  statusEl.textContent = text;
  statusEl.classList.toggle('error', isError);
}

function render(engine: ScoreEngine): void {
  if (!state.source) return;
  try {
    const { pages, pitches } = engine.render(state.source, state.semitones);
    state.pitches = pitches;
    pagesEl.innerHTML = pages.map((svg) => `<div class="page">${svg}</div>`).join('');
    restyle();
    byId('transpose-label').textContent = intervalLabel(state.semitones);
    setStatus(`${state.title} – ${pages.length} oldal`);
  } catch (err) {
    setStatus(err instanceof Error ? err.message : String(err), true);
  }
}

/** Csak a színezést frissíti, újrarajzolás nélkül (gyors). */
function restyle(): void {
  for (const page of pagesEl.querySelectorAll<SVGSVGElement>('.page > svg')) {
    applyView(page, state.mode, state.pitches, state.outline);
  }
  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-mode]')) {
    button.setAttribute('aria-pressed', String(button.dataset.mode === state.mode));
  }
}

async function readFile(file: File): Promise<ScoreSource> {
  return file.name.toLowerCase().endsWith('.mxl')
    ? { kind: 'zip', data: await file.arrayBuffer() }
    : { kind: 'text', data: await file.text() };
}

async function main(): Promise<void> {
  installGradients(document);
  restyle();
  const engine = await ScoreEngine.create();
  setStatus('Nyiss meg egy MusicXML kottát, vagy próbáld ki a minta kottát.');

  byId<HTMLInputElement>('file').addEventListener('change', async (event) => {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    state.source = await readFile(file);
    state.title = file.name;
    state.semitones = 0;
    render(engine);
  });

  byId('sample').addEventListener('click', () => {
    state.source = { kind: 'text', data: sampleScore };
    state.title = 'Minta kotta';
    state.semitones = 0;
    render(engine);
  });

  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-mode]')) {
    button.addEventListener('click', () => {
      state.mode = button.dataset.mode as ViewMode;
      restyle();
    });
  }

  byId<HTMLInputElement>('outline').addEventListener('change', (event) => {
    state.outline = (event.target as HTMLInputElement).checked;
    restyle();
  });

  const transpose = (direction: 1 | -1) => {
    const next = state.semitones + direction * Number(stepEl.value);
    if (Math.abs(next) > MAX_TRANSPOSE) {
      setStatus(`Legfeljebb egy oktávval lehet feljebb vagy lejjebb vinni.`, true);
      return;
    }
    state.semitones = next;
    render(engine);
  };
  byId('up').addEventListener('click', () => transpose(1));
  byId('down').addEventListener('click', () => transpose(-1));
  byId('reset').addEventListener('click', () => {
    state.semitones = 0;
    render(engine);
  });

  byId('print').addEventListener('click', () => window.print());
}

main().catch((err) => setStatus(`Hiba indításkor: ${err instanceof Error ? err.message : err}`, true));
