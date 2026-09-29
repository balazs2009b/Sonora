import { describe, expect, it } from 'vitest';
import { colorForMidi, NOTE_COLORS, SPLIT_COLORS } from './colors';

describe('colorForMidi', () => {
  it('a törzshangok egyszínűek', () => {
    expect(colorForMidi(60)).toEqual({ kind: 'solid', color: NOTE_COLORS.C }); // c1
    expect(colorForMidi(62)).toEqual({ kind: 'solid', color: NOTE_COLORS.D });
    expect(colorForMidi(71)).toEqual({ kind: 'solid', color: NOTE_COLORS.H });
  });

  it('a köztes hang kettéosztott: alsó és felső szomszéd', () => {
    expect(colorForMidi(61)).toEqual({ kind: 'split', lower: NOTE_COLORS.C, upper: NOTE_COLORS.D, name: 'C-D' });
    expect(colorForMidi(70)).toEqual({ kind: 'split', lower: NOTE_COLORS.A, upper: NOTE_COLORS.H, name: 'A-H' });
  });

  it('oktávtól független', () => {
    expect(colorForMidi(24)).toEqual(colorForMidi(96));
    expect(colorForMidi(-1)).toEqual(colorForMidi(11));
  });

  it('öt köztes hang van', () => {
    expect(SPLIT_COLORS.map((s) => s.name)).toEqual(['C-D', 'D-E', 'F-G', 'G-A', 'A-H']);
  });
});
