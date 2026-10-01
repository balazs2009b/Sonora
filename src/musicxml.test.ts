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
      voices: [
        [
          { kind: 'note', pitches: [{ step: 'C', alter: 1, octave: 4 }], duration: 'quarter', dots: 0 },
          { kind: 'note', pitches: [{ step: 'F', alter: 1, octave: 4 }], duration: 'half', dots: 1 },
          { kind: 'rest', duration: 'eighth', dots: 0 },
        ],
      ],
    },
    {
      name: 'Basszus',
      clef: 'G',
      voices: [[{ kind: 'note', pitches: [{ step: 'B', alter: -1, octave: 3 }], duration: 'whole', dots: 0 }]],
    },
  ];
  return score;
}

const roundTrip = (score: Score) => fromMusicXml(toMusicXml(score));

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

  it('a tempójelzés csak az első soron jelenik meg', () => {
    expect(toMusicXml(sample()).match(/<metronome>/g)).toHaveLength(1);
  });
});

describe('MusicXML oda-vissza', () => {
  it('a beolvasott kotta megegyezik az eredetivel', () => {
    const original = sample();
    expect(roundTrip(original)).toEqual(original);
  });

  it('hibás fájlra érthető hibát ad', () => {
    expect(() => fromMusicXml('<html><body>nem kotta</body></html>')).toThrow(/score-partwise/);
  });

  it('ismeretlen hangértéket kihagy', () => {
    const xml = `<?xml version="1.0"?><score-partwise><part-list>
      <score-part id="P1"><part-name>Teszt</part-name></score-part></part-list>
      <part id="P1"><measure number="1">
        <note><pitch><step>C</step><octave>4</octave></pitch><duration>16</duration><type>quarter</type></note>
        <note><pitch><step>E</step><octave>4</octave></pitch><duration>2</duration><type>128th</type></note>
      </measure></part></score-partwise>`;
    const score = fromMusicXml(xml);
    expect(score.staves[0].voices[0]).toHaveLength(1);
    expect(score.staves[0].name).toBe('Teszt');
  });
});

describe('akkordok', () => {
  it('az akkord további hangjai chord jelöléssel íródnak ki', () => {
    const score = emptyScore();
    score.staves[0].voices[0] = [
      {
        kind: 'note',
        pitches: [
          { step: 'C', alter: 0, octave: 4 },
          { step: 'E', alter: 0, octave: 4 },
          { step: 'G', alter: 0, octave: 4 },
        ],
        duration: 'quarter',
        dots: 0,
      },
    ];
    const xml = toMusicXml(score);
    expect(xml.match(/<chord\/>/g)).toHaveLength(2);
    expect(roundTrip(score).staves[0].voices[0][0]).toEqual(score.staves[0].voices[0][0]);
  });
});

describe('előadási jelek', () => {
  it('átkötés, kötőív, jelek, dinamika és villa túlélik a mentést', () => {
    const score = emptyScore();
    score.staves[0].voices[0] = [
      {
        kind: 'note',
        pitches: [{ step: 'C', alter: 0, octave: 4 }],
        duration: 'quarter',
        dots: 0,
        tie: 'start',
        slur: 'start',
        articulations: ['staccato', 'fermata'],
        dynamic: 'mf',
        wedge: 'crescendo',
        marker: 'segno',
      },
      {
        kind: 'note',
        pitches: [{ step: 'C', alter: 0, octave: 4 }],
        duration: 'quarter',
        dots: 0,
        tie: 'stop',
        slur: 'stop',
      },
    ];
    const xml = toMusicXml(score);
    expect(xml).toContain('<tie type="start"/>');
    expect(xml).toContain('<slur type="start" number="1"/>');
    expect(xml).toContain('<fermata/>');
    expect(xml).toContain('<dynamics><mf/></dynamics>');
    expect(xml).toContain('<wedge type="crescendo"/>');
    expect(xml).toContain('<segno/>');
    expect(roundTrip(score).staves[0].voices[0]).toEqual(score.staves[0].voices[0]);
  });
});

describe('ütemvonalak és váltások', () => {
  it('az ismétlőjelek a megfelelő oldalra kerülnek', () => {
    const score = emptyScore();
    score.staves[0].voices[0] = [
      { kind: 'barline', style: 'repeat-start' },
      { kind: 'note', pitches: [{ step: 'C', alter: 0, octave: 4 }], duration: 'whole', dots: 0 },
      { kind: 'barline', style: 'repeat-end' },
      { kind: 'note', pitches: [{ step: 'D', alter: 0, octave: 4 }], duration: 'whole', dots: 0 },
    ];
    const xml = toMusicXml(score);
    expect(xml).toContain('<barline location="left"><bar-style>heavy-light</bar-style><repeat direction="forward"/>');
    expect(xml).toContain('<repeat direction="backward"/>');
    expect(roundTrip(score).staves[0].voices[0]).toEqual(score.staves[0].voices[0]);
  });

  it('a kulcs- és hangnemváltás túléli a mentést', () => {
    const score = emptyScore();
    score.staves[0].voices[0] = [
      { kind: 'note', pitches: [{ step: 'C', alter: 0, octave: 4 }], duration: 'whole', dots: 0 },
      { kind: 'clef', clef: 'F' },
      { kind: 'key', fifths: -2 },
      { kind: 'note', pitches: [{ step: 'D', alter: 0, octave: 3 }], duration: 'whole', dots: 0 },
    ];
    const xml = toMusicXml(score);
    expect(xml).toContain('<sign>F</sign><line>4</line>');
    expect(xml).toContain('<key><fifths>-2</fifths></key>');
    expect(roundTrip(score).staves[0].voices[0]).toEqual(score.staves[0].voices[0]);
  });
});

describe('több szólam egy soron', () => {
  it('a második szólam backup után, külön voice számmal íródik ki', () => {
    const score = emptyScore();
    score.staves[0].voices = [
      [{ kind: 'note', pitches: [{ step: 'G', alter: 0, octave: 4 }], duration: 'whole', dots: 0 }],
      [{ kind: 'note', pitches: [{ step: 'C', alter: 0, octave: 4 }], duration: 'whole', dots: 0 }],
    ];
    const xml = toMusicXml(score);
    expect(xml).toContain('<backup><duration>64</duration></backup>');
    expect(xml).toContain('<voice>2</voice>');
    expect(roundTrip(score).staves[0].voices).toEqual(score.staves[0].voices);
  });
});
