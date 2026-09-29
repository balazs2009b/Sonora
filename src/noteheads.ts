// A kirajzolt kotta kottafejeinek átszínezése: fekete / színes / kifestős nézet.
import { colorForMidi, SPLIT_COLORS } from './colors';

export type ViewMode = 'black' | 'color' | 'empty';

const SVG_NS = 'http://www.w3.org/2000/svg';
const XLINK_NS = 'http://www.w3.org/1999/xlink';
const BLACK_NOTEHEAD = 'E0A4'; // a negyed- és rövidebb hangok teli feje (SMuFL kód)
const OUTLINE_WIDTH = 12; // körvonal színes nézetben (betűkép-egységben)
const EMPTY_OUTLINE_WIDTH = 28; // körvonal kifestős nézetben

/**
 * A köztes hangok kettéosztott fejéhez egyszer, az egész oldalra létrehozzuk a színátmeneteket.
 * Választóvonal: bal lentről jobb fentre. A vonal fölött a felső, alatta az alsó hang színe.
 */
export function installGradients(doc: Document): void {
  if (doc.getElementById('sonora-gradients')) return;
  const svg = doc.createElementNS(SVG_NS, 'svg');
  svg.id = 'sonora-gradients';
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('style', 'position:absolute;width:0;height:0;overflow:hidden');
  const defs = doc.createElementNS(SVG_NS, 'defs');
  for (const { name, lower, upper } of SPLIT_COLORS) {
    const grad = doc.createElementNS(SVG_NS, 'linearGradient');
    grad.id = gradientId(name);
    // A betűkép függőlegesen tükrözve van rajzolva (scale(1,-1)), ezért a saját
    // koordinátáiban a (0,0) sarok látszik bal lent, az (1,1) jobb fent.
    // A színátmenet iránya merőleges a bal lent → jobb fent választóvonalra.
    grad.setAttribute('x1', '1');
    grad.setAttribute('y1', '0');
    grad.setAttribute('x2', '0');
    grad.setAttribute('y2', '1');
    for (const [offset, color] of [['0', lower], ['0.5', lower], ['0.5', upper], ['1', upper]]) {
      const stop = doc.createElementNS(SVG_NS, 'stop');
      stop.setAttribute('offset', offset);
      stop.setAttribute('stop-color', color);
      grad.appendChild(stop);
    }
    defs.appendChild(grad);
  }
  svg.appendChild(defs);
  doc.body.prepend(svg);
}

function gradientId(name: string): string {
  return `sonora-split-${name}`;
}

/** Egy oldal összes kottafejére alkalmazza a kiválasztott nézetet. */
export function applyView(page: SVGSVGElement, mode: ViewMode, pitches: Map<string, number>, outline: boolean): void {
  for (const note of page.querySelectorAll<SVGGElement>('g.note')) {
    for (const head of note.querySelectorAll<SVGUseElement>('g.notehead > use')) {
      head.removeAttribute('fill');
      head.removeAttribute('stroke');
      head.removeAttribute('stroke-width');

      if (mode === 'empty') {
        if (glyphOf(head) === BLACK_NOTEHEAD) paint(head, '#ffffff', EMPTY_OUTLINE_WIDTH);
      } else if (mode === 'color') {
        const pitch = pitches.get(note.id);
        if (pitch === undefined) continue;
        const color = colorForMidi(pitch);
        const fill = color.kind === 'solid' ? color.color : `url(#${gradientId(color.name)})`;
        paint(head, fill, outline ? OUTLINE_WIDTH : 0);
      }
    }
  }
}

function paint(head: SVGUseElement, fill: string, strokeWidth: number): void {
  head.setAttribute('fill', fill);
  if (strokeWidth > 0) {
    head.setAttribute('stroke', '#000000');
    head.setAttribute('stroke-width', String(strokeWidth));
  }
}

/** A kottafej betűképének kódja, pl. "#E0A4-abc123" → "E0A4". */
function glyphOf(use: SVGUseElement): string {
  const href = use.getAttributeNS(XLINK_NS, 'href') ?? use.getAttribute('href') ?? '';
  return href.replace(/^#/, '').split('-')[0];
}
