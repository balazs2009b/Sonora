// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { fromMusicXml, toMusicXml } from './musicxml';
import { emptyScore, type Score } from './model';

function sample(): Score {
  const score = emptyScore();
  score.title = 'Próba & teszt';
  score.fifths = 1; // G-dúr: az F eleve kereszt
  score.tempo = 120;
  score.staves = [
    {
      name: 'Zongora',
      clef: 'F',
      events: [
        { kind: 'note', step: 'C', alter: 1, octave: 4, duration: 'quarter', dots: 0 },
        { kind: 'note', step: 'F', alter: 1, octave: 4, duration: 'half', dots: 1 },
        { kind: 'rest', duration: 'eighth', dots: 0 },
      ],
    },
    { name: 'Basszus', clef: 'G', events: [{ kind: 'note', step: 'B', alter: -1, octave: 3, duration: 'whole', dots: 0 }] },
  ];
  return score;
}

describe('MusicXML írás', () => {
  it('a cím különleges karaktereit védi', () => {
    expect(toMusicXml(sample())).toContain('<work-title>Próba &#38; teszt</work-title>');
  });

  it('módosítójelet csak akkor ír ki, ha nem következik az előjegyzésből', () => {
    const xml = toMusicXml(sample());
    expect(xml).toContain('<accidental>sharp</accidental>'); // a Cisz kiírva
    expect(xml.match(/<accidental>sharp<\/accidental>/g)).toHaveLength(1); // a Fisz nem
  });

  it('minden szólamból külön part lesz', () => {
    const xml = toMusicXml(sample());
    expect(xml).toContain('<part id="P1">');
    expect(xml).toContain('<part id="P2">');
    expect(xml).toContain('<sign>F</sign>');
  });
});

describe('MusicXML oda-vissza', () => {
  it('a beolvasott kotta megegyezik az eredetivel', () => {
    const original = sample();
    const parsed = fromMusicXml(toMusicXml(original));
    expect(parsed).toEqual(original);
  });

  it('hibás fájlra érthető hibát ad', () => {
    expect(() => fromMusicXml('<html><body>nem kotta</body></html>')).toThrow(/score-partwise/);
  });

  it('az akkordok második hangját és a második szólamot kihagyja', () => {
    const xml = `<?xml version="1.0"?><score-partwise><part-list>
      <score-part id="P1"><part-name>Teszt</part-name></score-part></part-list>
      <part id="P1"><measure number="1">
        <note><pitch><step>C</step><octave>4</octave></pitch><duration>16</duration><type>quarter</type></note>
        <note><chord/><pitch><step>E</step><octave>4</octave></pitch><duration>16</duration><type>quarter</type></note>
        <note><voice>2</voice><pitch><step>G</step><octave>4</octave></pitch><duration>16</duration><type>quarter</type></note>
      </measure></part></score-partwise>`;
    const score = fromMusicXml(xml);
    expect(score.staves[0].events).toHaveLength(1);
    expect(score.staves[0].name).toBe('Teszt');
  });
});
