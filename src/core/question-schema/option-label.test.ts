/**
 * The one copy of the option-letter rule (issue #660), shared by the players
 * and the editing engine. The letter lives in `options[].id` and nowhere else,
 * so editing it renames the id and must carry the answer key with it.
 */
import { describe, expect, it } from 'vitest';
import {
  optionDisplayLabel,
  optionMarkerLetter,
  setOptionLetter,
} from './option-label';

describe('optionMarkerLetter', () => {
  it('accepts a bare letter and strips trailing "." / ")"', () => {
    expect(optionMarkerLetter('G')).toBe('G');
    expect(optionMarkerLetter('G.')).toBe('G');
    expect(optionMarkerLetter(' G) ')).toBe('G');
    expect(optionMarkerLetter('a')).toBe('a');
  });

  it('rejects everything that is not a marker', () => {
    expect(optionMarkerLetter('AB')).toBeNull();
    expect(optionMarkerLetter('1')).toBeNull();
    expect(optionMarkerLetter('Nấu ăn')).toBeNull();
    expect(optionMarkerLetter('  ')).toBeNull();
    expect(optionMarkerLetter(undefined)).toBeNull();
  });
});

describe('optionDisplayLabel', () => {
  it('reads the letter off the id — the canonical spec shape', () => {
    // §5.1/§5.2: options[].id holds the printed letter and correctAnswer
    // references it, so the letter shown IS the letter graded.
    const ids = ['A', 'B', 'C', 'D', 'E', 'G'];
    expect(ids.map((id, i) => optionDisplayLabel({ id }, i))).toEqual(ids);
  });

  it('preserves case', () => {
    expect(optionDisplayLabel({ id: 'a' }, 0)).toBe('a');
  });

  it('falls back to the positional letter for opaque and numeric ids', () => {
    expect(optionDisplayLabel({ id: 'o1' }, 0)).toBe('A');
    expect(optionDisplayLabel({ id: '2' }, 1)).toBe('B');
    expect(optionDisplayLabel(undefined, 3)).toBe('D');
  });

  it('ignores a `label` field entirely — the id is the only source', () => {
    const withLabel = { id: 'F', label: 'G' } as { id: string };
    expect(optionDisplayLabel(withLabel, 5)).toBe('F');
  });
});

describe('setOptionLetter', () => {
  function question() {
    return {
      type: 'multiple_choice',
      options: ['A', 'B', 'C', 'D', 'E', 'F'].map((id) => ({ id })),
      correctAnswer: ['A', 'F'],
    } as Record<string, unknown>;
  }

  it('renames the id and rewrites the answer key in the same pass', () => {
    const q = question();
    expect(setOptionLetter(q, 5, 'G')).toEqual({ ok: true });
    expect((q.options as { id: string }[]).map((o) => o.id)).toEqual([
      'A',
      'B',
      'C',
      'D',
      'E',
      'G',
    ]);
    expect(q.correctAnswer).toEqual(['A', 'G']);
  });

  it('rewrites a single-choice string answer', () => {
    const q = { options: [{ id: 'o1' }, { id: 'o2' }], correctAnswer: 'o2' } as Record<
      string,
      unknown
    >;
    expect(setOptionLetter(q, 1, 'G')).toEqual({ ok: true });
    expect(q.correctAnswer).toBe('G');
  });

  it('rewrites the legacy correctAnswers / answer fields too', () => {
    const q = {
      options: [{ id: 'A' }, { id: 'F' }],
      correctAnswers: ['F'],
      answer: 'F',
    } as Record<string, unknown>;
    setOptionLetter(q, 1, 'G');
    expect(q.correctAnswers).toEqual(['G']);
    expect(q.answer).toBe('G');
  });

  it('refuses a letter another option already answers to', () => {
    const q = question();
    expect(setOptionLetter(q, 5, 'A')).toEqual({ ok: false, reason: 'duplicate' });
    expect((q.options as { id: string }[])[5].id).toBe('F');
    expect(q.correctAnswer).toEqual(['A', 'F']);
  });

  it('refuses anything that is not one letter, writing nothing', () => {
    const q = question();
    expect(setOptionLetter(q, 5, '')).toEqual({ ok: false, reason: 'not-a-letter' });
    expect(setOptionLetter(q, 5, '1')).toEqual({ ok: false, reason: 'not-a-letter' });
    expect(setOptionLetter(q, 5, 'Nấu ăn')).toEqual({ ok: false, reason: 'not-a-letter' });
    expect((q.options as { id: string }[])[5].id).toBe('F');
  });

  it('normalises punctuation away before storing', () => {
    const q = question();
    setOptionLetter(q, 5, 'G)');
    expect((q.options as { id: string }[])[5].id).toBe('G');
  });

  it('is a no-op when the letter is already the id', () => {
    const q = question();
    expect(setOptionLetter(q, 0, 'A')).toEqual({ ok: true });
    expect(q.correctAnswer).toEqual(['A', 'F']);
  });

  it('never writes a `label` field', () => {
    const q = question();
    setOptionLetter(q, 5, 'G');
    expect((q.options as object[])[5]).toEqual({ id: 'G' });
  });
});
