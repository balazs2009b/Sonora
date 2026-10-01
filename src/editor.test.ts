import { beforeEach, describe, expect, it } from 'vitest';
import { Editor } from './editor';

let editor: Editor;
beforeEach(() => {
  editor = new Editor();
});

describe('beírás és törlés', () => {
  it('a hangok a kurzor helyére kerülnek', () => {
    editor.insertNote('C');
    editor.insertNote('E');
    editor.moveBy(-1);
    editor.insertNote('D');
    expect(editor.events.map((e) => (e.kind === 'note' ? e.pitches[0].step : '-'))).toEqual(['C', 'D', 'E']);
  });

  it('a beírt hang átveszi a beállításokat', () => {
    editor.input = { duration: 'eighth', dots: 1, alter: 1, octave: 5 };
    editor.insertNote('F');
    expect(editor.events[0]).toEqual({
      kind: 'note',
      pitches: [{ step: 'F', alter: 1, octave: 5 }],
      duration: 'eighth',
      dots: 1,
    });
  });

  it('a Backspace a kurzor előtti hangot törli', () => {
    editor.insertNote('C');
    editor.insertNote('D');
    editor.deleteBefore();
    expect(editor.events).toHaveLength(1);
    expect(editor.cursor.index).toBe(1);
  });

  it('üres kottán a törlés nem hibázik', () => {
    editor.deleteBefore();
    editor.deleteAfter();
    expect(editor.events).toHaveLength(0);
  });

  it('a kurzor nem megy a kotta elé vagy mögé', () => {
    editor.insertNote('C');
    editor.moveBy(-5);
    expect(editor.cursor.index).toBe(0);
    editor.moveBy(5);
    expect(editor.cursor.index).toBe(1);
  });
});

describe('undo és redo', () => {
  it('visszavonja és újra elvégzi a beírást', () => {
    editor.insertNote('C');
    editor.insertNote('D');
    editor.undo();
    expect(editor.events).toHaveLength(1);
    editor.redo();
    expect(editor.events).toHaveLength(2);
  });

  it('új módosítás után nincs mit újra elvégezni', () => {
    editor.insertNote('C');
    editor.undo();
    editor.insertNote('E');
    expect(editor.canRedo).toBe(false);
  });

  it('üres előzménnyel nem csinál semmit', () => {
    editor.undo();
    editor.redo();
    expect(editor.events).toHaveLength(0);
  });

  it('a visszavonás nem hagyja a kurzort a kottán kívül', () => {
    editor.insertNote('C');
    editor.insertNote('D');
    editor.undo();
    editor.undo();
    expect(editor.cursor.index).toBeLessThanOrEqual(editor.events.length);
  });
});

describe('sorok', () => {
  it('új sor szúrható be bárhová', () => {
    editor.addStaffAt(0);
    expect(editor.score.staves).toHaveLength(2);
    expect(editor.cursor.staff).toBe(0);
  });

  it('az utolsó sort nem lehet törölni', () => {
    editor.removeStaff(0);
    expect(editor.score.staves).toHaveLength(1);
  });

  it('a sor törlése után a kurzor létező sorra mutat', () => {
    editor.addStaffAt(1);
    editor.selectStaff(1);
    editor.removeStaff(1);
    expect(editor.cursor.staff).toBe(0);
  });
});

describe('akkordok', () => {
  it('további hang kerül a kurzor előtti hanghoz, alulról rendezve', () => {
    editor.insertNote('E');
    editor.addChordTone('G');
    editor.addChordTone('C');
    const note = editor.currentNote()!;
    expect(note.pitches.map((p) => p.step)).toEqual(['C', 'E', 'G']);
  });

  it('ugyanazt a hangot nem veszi fel kétszer', () => {
    editor.insertNote('C');
    expect(editor.addChordTone('C')).toBe(false);
    expect(editor.currentNote()!.pitches).toHaveLength(1);
  });

  it('üres kottán nincs mihez akkordot tenni', () => {
    expect(editor.addChordTone('C')).toBe(false);
  });

  it('egyetlen hangot nem vesz el', () => {
    editor.insertNote('C');
    expect(editor.removeChordTone()).toBe(false);
    editor.addChordTone('E');
    expect(editor.removeChordTone()).toBe(true);
    expect(editor.currentNote()!.pitches).toHaveLength(1);
  });
});

describe('jelek', () => {
  it('a jel be- és kikapcsolható', () => {
    editor.insertNote('C');
    editor.toggleArticulation('staccato');
    expect(editor.currentNote()!.articulations).toEqual(['staccato']);
    editor.toggleArticulation('staccato');
    expect(editor.currentNote()!.articulations).toBeUndefined();
  });

  it('a dinamikai jel ugyanazzal a gombbal levehető', () => {
    editor.insertNote('C');
    editor.setDynamic('f');
    expect(editor.currentNote()!.dynamic).toBe('f');
    editor.setDynamic('f');
    expect(editor.currentNote()!.dynamic).toBeUndefined();
  });

  it('ütemvonalra nem tesz jelet', () => {
    editor.insertBarline('double');
    expect(editor.toggleArticulation('accent')).toBe(false);
    expect(editor.setDynamic('p')).toBe(false);
  });

  it('a jelek is visszavonhatók', () => {
    editor.insertNote('C');
    editor.toggleArticulation('fermata');
    editor.undo();
    expect(editor.currentNote()!.articulations).toBeUndefined();
  });
});

describe('átkötés', () => {
  it('két azonos magasságú hang közé kerül', () => {
    editor.insertNote('C');
    editor.insertNote('C');
    editor.moveBy(-1);
    expect(editor.toggleTie()).toBe(true);
    expect(editor.events[0]).toMatchObject({ tie: 'start' });
    expect(editor.events[1]).toMatchObject({ tie: 'stop' });
  });

  it('különböző magasságú hangok közé nem', () => {
    editor.insertNote('C');
    editor.insertNote('D');
    editor.moveBy(-1);
    expect(editor.toggleTie()).toBe(false);
  });

  it('a lánc közepén lévő hang mindkét oldalt megtartja', () => {
    for (let i = 0; i < 3; i++) editor.insertNote('C');
    editor.moveBy(-2); // az első hang után
    editor.toggleTie();
    editor.moveBy(1); // a második hang után
    editor.toggleTie();
    expect(editor.events[1]).toMatchObject({ tie: 'both' });
    editor.toggleTie(); // a második átkötés visszavonása
    expect(editor.events[1]).toMatchObject({ tie: 'stop' });
  });
});

describe('szólamok', () => {
  it('új szólam üresen indul, és külön tárolja a hangokat', () => {
    editor.insertNote('C');
    editor.addVoice();
    expect(editor.events).toHaveLength(0);
    editor.insertNote('G');
    expect(editor.staff.voices[0]).toHaveLength(1);
    expect(editor.staff.voices[1]).toHaveLength(1);
  });

  it('az utolsó szólamot nem lehet törölni', () => {
    editor.removeVoice(0);
    expect(editor.staff.voices).toHaveLength(1);
  });

  it('másik sorra lépve az első szólamra áll', () => {
    editor.addVoice();
    editor.addStaffAt(1);
    editor.selectStaff(0);
    expect(editor.cursor.voice).toBe(0);
  });
});
