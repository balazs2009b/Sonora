import { describe, expect, it } from 'vitest';
import { durationUnits, quarters, splitIntoMeasures, type Event } from './model';

const note = (duration: Event['duration'], dots = 0): Event => ({
  kind: 'note',
  step: 'C',
  alter: 0,
  octave: 4,
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
    expect(measures.map((m) => m.length)).toEqual([4, 2]);
  });

  it('a be nem férő hang új ütemet kezd', () => {
    const measures = splitIntoMeasures([note('half'), note('half', 1)], 4);
    expect(measures.map((m) => m.length)).toEqual([1, 1]);
  });

  it('a lebegőpontos hosszak nem csúsznak el', () => {
    const measures = splitIntoMeasures(Array.from({ length: 12 }, () => note('eighth')), 4);
    expect(measures.map((m) => m.length)).toEqual([8, 4]);
  });
});
