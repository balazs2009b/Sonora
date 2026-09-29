// A kottamotor (Verovio) köré épített réteg: betöltés, transzponálás, oldalak kirajzolása.
import createVerovioModule from 'verovio/wasm';
import { VerovioToolkit } from 'verovio/esm';

export type ScoreSource = { kind: 'text'; data: string } | { kind: 'zip'; data: ArrayBuffer };

export interface RenderedScore {
  /** Oldalanként egy SVG kép. */
  pages: string[];
  /** Kottafej azonosító → megszólaló hang (MIDI szám). */
  pitches: Map<string, number>;
}

// Félhangok száma → Verovio hangköz-jelölés és magyar név.
const INTERVALS = ['', 'm2', 'M2', 'm3', 'M3', 'P4', 'A4', 'P5', 'm6', 'M6', 'm7', 'M7', 'P8'];
const INTERVAL_NAMES = [
  'eredeti hangnem', 'kis szekund (félhang)', 'nagy szekund (egész hang)', 'kis terc', 'nagy terc',
  'tiszta kvart', 'bővített kvart', 'tiszta kvint', 'kis szext', 'nagy szext', 'kis szeptim', 'nagy szeptim', 'oktáv',
];
export const MAX_TRANSPOSE = 12;

export function intervalCode(semitones: number): string {
  const n = Math.abs(semitones);
  if (n > MAX_TRANSPOSE) throw new RangeError(`Legfeljebb ${MAX_TRANSPOSE} félhanggal lehet transzponálni.`);
  return semitones < 0 ? `-${INTERVALS[n]}` : INTERVALS[n];
}

export function intervalLabel(semitones: number): string {
  if (semitones === 0) return INTERVAL_NAMES[0];
  return `${INTERVAL_NAMES[Math.abs(semitones)]} ${semitones > 0 ? 'fel' : 'le'}`;
}

const BASE_OPTIONS = {
  xmlIdSeed: 1, // azonos azonosítók minden betöltésnél – így párosítható a két betöltés
  svgViewBox: true,
  pageWidth: 2100, // A4, tized milliméterben
  pageHeight: 2970,
  adjustPageHeight: false,
  scale: 100,
};

export class ScoreEngine {
  private constructor(private readonly tk: VerovioToolkit) {}

  static async create(): Promise<ScoreEngine> {
    return new ScoreEngine(new VerovioToolkit(await createVerovioModule()));
  }

  render(source: ScoreSource, semitones: number): RenderedScore {
    const transpose = intervalCode(semitones);

    // 1. Megszólaló hangok: transzponáló hangszernél (pl. B-klarinét) ez eltér a leírttól.
    this.load(source, { transpose, transposeToSoundingPitch: true });
    this.tk.renderToMIDI();
    const pitches = new Map<string, number>();
    for (const [, id] of this.tk.getMEI().matchAll(/<note\b[^>]*\bxml:id="([^"]+)"/g)) {
      const pitch = this.tk.getMIDIValuesForElement(id)?.pitch;
      if (typeof pitch === 'number' && pitch > 0) pitches.set(id, pitch);
    }

    // 2. A megjelenő kotta: ahogy le van írva (a hangszer saját kulcsában).
    this.load(source, { transpose, transposeToSoundingPitch: false });
    const pages: string[] = [];
    for (let page = 1; page <= this.tk.getPageCount(); page++) pages.push(this.tk.renderToSVG(page));
    return { pages, pitches };
  }

  private load(source: ScoreSource, options: Record<string, unknown>): void {
    this.tk.setOptions({ ...BASE_OPTIONS, ...options });
    const ok = source.kind === 'zip' ? this.tk.loadZipDataBuffer(source.data) : this.tk.loadData(source.data);
    if (!ok) throw new Error('A fájlt nem sikerült beolvasni. MusicXML (.musicxml, .xml, .mxl) fájl kell.');
  }
}
