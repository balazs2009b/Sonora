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
    expect(editor.staff.events.map((e) => (e.kind === 'note' ? e.step : '-'))).toEqual(['C', 'D', 'E']);
  });

  it('a beírt hang átveszi a beállításokat', () => {
    editor.input = { duration: 'eighth', dots: 1, alter: 1, octave: 5 };
    editor.insertNote('F');
    expect(editor.staff.events[0]).toEqual({
      kind: 'note',
      step: 'F',
      alter: 1,
      octave: 5,
      duration: 'eighth',
      dots: 1,
    });
  });

  it('a Backspace a kurzor előtti hangot törli', () => {
    editor.insertNote('C');
    editor.insertNote('D');
    editor.deleteBefore();
    expect(editor.staff.events).toHaveLength(1);
    expect(editor.cursor.index).toBe(1);
  });

  it('üres kottán a törlés nem hibázik', () => {
    editor.deleteBefore();
    editor.deleteAfter();
    expect(editor.staff.events).toHaveLength(0);
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
    expect(editor.staff.events).toHaveLength(1);
    editor.redo();
    expect(editor.staff.events).toHaveLength(2);
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
    expect(editor.staff.events).toHaveLength(0);
  });

  it('a visszavonás nem hagyja a kurzort a kottán kívül', () => {
    editor.insertNote('C');
    editor.insertNote('D');
    editor.undo();
    editor.undo();
    expect(editor.cursor.index).toBeLessThanOrEqual(editor.staff.events.length);
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
