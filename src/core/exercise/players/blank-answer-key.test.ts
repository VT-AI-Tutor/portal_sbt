/**
 * BLANK_ANSWER_KEY_UNREACHABLE — a `correctAnswer` key with no marker in `content`.
 *
 * The failure this guards (WEB14 class): grading walks the keys of `correctAnswer`
 * (`grading.ts` → `recordEvery`), so a key that never renders an input makes the
 * question impossible to get right, while the player — which counts only rendered
 * blanks — still tells the student "đúng".
 *
 * Fixtures are the REAL shapes found by a catalog-wide audit (53 books / 1352
 * lessons) rather than invented ones, and are written with unambiguous three-
 * underscore / curly markers on purpose: the assertions must not change meaning
 * when the tolerant-underscore parser (ship/web14-tolerant-blank-markers) merges.
 */
import { describe, expect, it } from 'vitest';
import { validateQuestionPayloadCapabilities } from './capability-validation';

const para = (text: string) => ({ blocks: [{ type: 'paragraph', text }] });

const codesOf = (payload: Record<string, unknown>) =>
  validateQuestionPayloadCapabilities(payload).map((i) => i.code);

describe('BLANK_ANSWER_KEY_UNREACHABLE', () => {
  it('flags a key that no marker in content can reach (vbt-toan-2-tap-2 bai30)', () => {
    // Content renders `blank_1`; the key and blanks[] both say `blank_43`.
    // Student sees one inert box and can never score the question.
    const issues = validateQuestionPayloadCapabilities({
      type: 'cloze',
      content: para('Quả bóng {blank_1} rơi vào lỗ.'),
      blanks: [{ id: 'blank_43' }],
      correctAnswer: { blank_43: ['không thể'] },
    });
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      code: 'BLANK_ANSWER_KEY_UNREACHABLE',
      severity: 'warning',
      field: 'correctAnswer',
      path: '$',
    });
    expect(issues[0].message).toContain('"blank_43"');
  });

  it('flags only the missing subset, not the whole key (vbt-toan-4-tap-2 bai68 d)', () => {
    // Part d) lost the markers for blank_d_1 and blank_d_3 in authoring.
    const issues = validateQuestionPayloadCapabilities({
      type: 'cloze',
      content: para('d) 6 528 : 32 {blank_d_2} {blank_d_4} {blank_d_5}'),
      correctAnswer: {
        blank_d_1: ['6 528'],
        blank_d_2: ['32'],
        blank_d_3: ['204'],
        blank_d_4: ['0'],
        blank_d_5: ['204'],
      },
    });
    expect(issues.map((i) => i.code)).toEqual(['BLANK_ANSWER_KEY_UNREACHABLE']);
    // Only the unreachable pair is named as the problem; the reachable ids still
    // appear later in the message as "Marker đọc được", which is deliberate.
    expect(issues[0].message).toContain('khoá chấm "blank_d_1", "blank_d_3" không có marker');
    expect(issues[0].message).toContain('Marker đọc được: "blank_d_2", "blank_d_4", "blank_d_5"');
  });

  it('stays silent on ungraded working boxes — content may hold MORE blanks than the key', () => {
    // "Đặt tính rồi tính": blank_1..3 are scratch rows the author deliberately
    // leaves ungraded; only the result (blank_4) is scored. Warning here would be
    // noise on a very common shape and would train authors to ignore the check.
    expect(codesOf({
      type: 'cloze',
      content: para('56 × 24 {blank_1} {blank_2} {blank_3} {blank_4}'),
      blanks: [{ id: 'blank_1' }, { id: 'blank_2' }, { id: 'blank_3' }, { id: 'blank_4' }],
      correctAnswer: { blank_4: ['1 344', '1344'] },
    })).toEqual([]);
  });

  it('stays silent when content has no markers at all (parseCloze synthesizes inputs)', () => {
    // The no-marker fallback builds one input per answer key, so every key is
    // reachable — flagging would be wrong.
    expect(codesOf({
      type: 'fill_blank',
      content: para('Điền đáp án thích hợp.'),
      blanks: [{ id: 'blank_1' }, { id: 'blank_2' }],
      correctAnswer: { blank_1: ['3'], blank_2: ['5'] },
    })).toEqual([]);
  });

  it('stays silent when every key is reachable', () => {
    expect(codesOf({
      type: 'cloze',
      content: para('Thủ đô Việt Nam là ___[blank_1]___ và ___[blank_2]___.'),
      correctAnswer: { blank_1: ['Hà Nội'], blank_2: ['HN'] },
    })).toEqual([]);
  });

  it('ignores types that locate blanks outside prose', () => {
    // diagram_fill keys by `nodes[]`, crossword by `entries[]` — content markers
    // are not how those find their inputs, so this detector must not fire.
    expect(codesOf({
      type: 'diagram_fill',
      content: para('a) Cách 1: 5 + 8 = 10 + {a_blank_1} = {a_blank_2}'),
      nodes: [
        { id: 'a_blank_1', fillable: true },
        { id: 'a_blank_2', fillable: true },
      ],
      correctAnswer: { a_blank_1: ['3'], a_blank_2: ['13'] },
    })).not.toContain('BLANK_ANSWER_KEY_UNREACHABLE');
  });

  it('reaches nested sub-questions of a question_group', () => {
    const issues = validateQuestionPayloadCapabilities({
      type: 'question_group',
      content: { blocks: [] },
      display: { interactionType: 'group', layout: 'grid_2' },
      questions: [{
        type: 'cloze',
        content: para('Quả bóng {blank_1} rơi vào lỗ.'),
        correctAnswer: { blank_43: ['không thể'] },
      }],
    });
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      code: 'BLANK_ANSWER_KEY_UNREACHABLE',
      path: '$.questions[0]',
    });
  });

  it('finds markers inside rich-text runs, not just plain paragraph text', () => {
    expect(codesOf({
      type: 'cloze',
      content: {
        blocks: [{
          type: 'paragraph',
          content: [
            { text: 'Thủ đô là ', annotations: [] },
            { text: '___[blank_1]___', annotations: [] },
          ],
        }],
      },
      correctAnswer: { blank_1: ['Hà Nội'] },
    })).toEqual([]);
  });
});
