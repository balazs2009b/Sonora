import { describe, expect, it } from 'vitest';
import { durationUnits, quarters, splitIntoMeasures, type Duration, type Event } from './model';

const note = (duration: Duration, dots = 0): Event => ({
  kind: 'note',
  pitches: [{ step: 'C', alter: 0, octave: 4 }],
  duration,
  dots,
});

describe('hangértékek', () => {
  it('az alap hosszak negyedhangban', () => {
    expect(quarters(note('whole'))).toBe(4);
    expect(quarters(note('quarter'))).toBe(1);
    expect(quarters(note('16th'))).toBe(0.25);
  });

  it('a pont a felét adja hozzá', () => {
    expect(quarters(note('half', 1))).toBe(3);
    expect(quarters(note('quarter', 1))).toBe(1.5);
    expect(quarters(note('quarter', 2))).toBe(1.75);
  });

  it('a pontozott tizenhatod is egész szám marad', () => {
    expect(durationUnits(note('16th', 1))).toBe(6);
    expect(durationUnits(note('whole'))).toBe(64);
  });
});

describe('ütemekre bontás', () => {
  it('4/4-ben négy negyed egy ütem', () => {
    const measures = splitIntoMeasures(Array.from({ length: 6 }, () => note('quarter')), 4);
    expect(measures.map((m) => m.events.length)).toEqual([4, 2]);
  });

  it('a be nem férő hang új ütemet kezd', () => {
    const measures = splitIntoMeasures([note('half'), note('half', 1)], 4);
    expect(measures.map((m) => m.events.length)).toEqual([1, 1]);
  });

  it('a lebegőpontos hosszak nem csúsznak el', () => {
    const measures = splitIntoMeasures(Array.from({ length: 12 }, () => note('eighth')), 4);
    expect(measures.map((m) => m.events.length)).toEqual([8, 4]);
  });
});

describe('ütemvonalak', () => {
  it('a kézi ütemvonal akkor is lezárja az ütemet, ha nincs tele', () => {
    const measures = splitIntoMeasures([note('quarter'), { kind: 'barline', style: 'double' }, note('quarter')], 4);
    expect(measures).toHaveLength(2);
    expect(measures[0].right).toBe('double');
    expect(measures[1].events).toHaveLength(1);
  });

  it('az ismétlőjel a következő ütem bal oldalára kerül', () => {
    const measures = splitIntoMeasures([note('quarter'), { kind: 'barline', style: 'repeat-start' }, note('quarter')], 4);
    expect(measures[1].left).toBe('repeat-start');
  });

  it('a kotta elején álló ismétlőjel nem hoz létre üres ütemet', () => {
    const measures = splitIntoMeasures([{ kind: 'barline', style: 'repeat-start' }, note('quarter')], 4);
    expect(measures).toHaveLength(1);
    expect(measures[0].left).toBe('repeat-start');
  });

  it('a lezárás után nem marad üres ütem', () => {
    const measures = splitIntoMeasures([note('quarter'), { kind: 'barline', style: 'final' }], 4);
    expect(measures).toHaveLength(1);
    expect(measures[0].right).toBe('final');
  });

  it('a kulcsváltásnak nincs időtartama', () => {
    const measures = splitIntoMeasures([note('whole'), { kind: 'clef', clef: 'F' }, note('whole')], 4);
    expect(measures[0].events).toHaveLength(2); // az egész hang és a kulcsváltás
    expect(measures[1].events).toHaveLength(1);
  });
});
