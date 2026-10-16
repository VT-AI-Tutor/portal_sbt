import { describe, expect, it } from 'vitest';
import {
  blockingCapabilityIssues,
  validateImportedQuestionCapabilities,
  validateQuestionPayloadCapabilities,
} from './capability-validation';
import { resolveMatchingPayload } from '@/core/question-schema/matching';

const content = { blocks: [] };

describe('renderer capability validation', () => {
  it('accepts question_group/grid_2 and validates nested questions', () => {
    expect(validateQuestionPayloadCapabilities({
      type: 'question_group',
      content,
      display: { interactionType: 'group', layout: 'grid_2' },
      questions: [{ type: 'single_choice', content, display: { interactionType: 'button', layout: 'grid_4' } }],
    })).toEqual([]);
  });

  it.each([
    [{ type: 'future_type', content }, 'UNKNOWN_TYPE'],
    [{ type: 'single_choice', content, display: { interactionType: 'future' } }, 'UNKNOWN_INTERACTION'],
    [{ type: 'question_group', content, display: { interactionType: 'group', layout: 'grid_9' } }, 'UNSUPPORTED_LAYOUT'],
    [{ type: 'single_choice', content, display: { interactionType: 'dropdown', layout: 'sideways' } }, 'UNSUPPORTED_LAYOUT'],
  ] as const)('rejects unsupported renderer combinations with %s', (payload, code) => {
    expect(validateQuestionPayloadCapabilities(payload)[0]).toMatchObject({ code, path: '$' });
  });

  it('requires all three chain columns, unique ids, and adjacent edges', () => {
    const issues = validateQuestionPayloadCapabilities({
      type: 'matching',
      content,
      display: { interactionType: 'chain' },
      leftItems: [{ id: 'same' }],
      middleItems: [{ id: 'same' }],
      rightItems: [],
      correctAnswer: [{ item: 'same', target: 'ghost' }],
    });

    expect(issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'MISSING_REQUIRED_FIELD', field: 'rightItems' }),
      expect.objectContaining({ code: 'DUPLICATE_MATCHING_ID' }),
      expect.objectContaining({ code: 'INVALID_CHAIN_EDGE' }),
    ]));
  });

  it('accepts the complete left-to-middle and middle-to-right answer contract', () => {
    expect(validateQuestionPayloadCapabilities({
      type: 'matching',
      content,
      display: { interactionType: 'chain' },
      leftItems: [{ id: 'L1' }],
      middleItems: [{ id: 'M1' }],
      rightItems: [{ id: 'R1' }],
      correctAnswer: [
        { item: 'L1', target: 'M1' },
        { item: 'M1', target: 'R1' },
      ],
    })).toEqual([]);
  });

  it('allows record-only chain questions without an answer key', () => {
    expect(validateQuestionPayloadCapabilities({
      type: 'matching',
      content,
      display: { interactionType: 'chain' },
      leftItems: [{ id: 'L1' }],
      middleItems: [{ id: 'M1' }],
      rightItems: [{ id: 'R1' }],
    })).toEqual([]);
  });

  // Ý nhiễu (phương án sách có in nhưng đáp án không dùng) là nội dung hợp lệ —
  // issue #800. Trước đây mọi ô không được nối đều bị chặn lưu.
  it.each([
    ['ý nhiễu cột phải (b26_q3)', { rightItems: [{ id: 'R1' }, { id: 'R2' }] }],
    ['ý nhiễu cột trái', { leftItems: [{ id: 'L1' }, { id: 'L2' }] }],
    ['ý nhiễu cột giữa', { middleItems: [{ id: 'M1' }, { id: 'M2' }] }],
  ] as const)('accepts a chain answer key that leaves %s uncovered', (_label, overrides) => {
    expect(validateQuestionPayloadCapabilities({
      type: 'matching',
      content,
      display: { interactionType: 'chain' },
      leftItems: [{ id: 'L1' }],
      middleItems: [{ id: 'M1' }],
      rightItems: [{ id: 'R1' }],
      correctAnswer: [
        { item: 'L1', target: 'M1' },
        { item: 'M1', target: 'R1' },
      ],
      ...overrides,
    })).toEqual([]);
  });

  it.each([
    ['trái→giữa', [{ item: 'M1', target: 'R1' }], 'không có cạnh nào trái→giữa'],
    ['giữa→phải', [{ item: 'L1', target: 'M1' }], 'không có cạnh nào giữa→phải'],
    ['cả hai chặng', [], 'không có cạnh nào trái→giữa'],
  ] as const)('rejects a chain answer key with no %s edge at all', (_label, correctAnswer, detail) => {
    const issues = validateQuestionPayloadCapabilities({
      type: 'matching',
      content,
      display: { interactionType: 'chain' },
      leftItems: [{ id: 'L1' }],
      middleItems: [{ id: 'M1' }],
      rightItems: [{ id: 'R1' }],
      correctAnswer,
    });

    expect(issues).toContainEqual(expect.objectContaining({
      code: 'INCOMPLETE_CHAIN_ANSWER_KEY',
      field: 'correctAnswer',
    }));
    expect(issues.find(({ code }) => code === 'INCOMPLETE_CHAIN_ANSWER_KEY')?.message)
      .toContain(detail);
  });

  describe('canonical columns chain payloads (issue #446)', () => {
    const canonicalChain = (overrides: Record<string, unknown> = {}) => ({
      id: 'b28_q2',
      type: 'matching',
      content,
      display: { interactionType: 'chain' },
      columns: [
        { id: 'left', items: [{ id: 'L1', text: 'Trái' }] },
        { id: 'middle', items: [{ id: 'M1', text: 'Giữa' }] },
        { id: 'right', items: [{ id: 'R1', text: 'Phải' }] },
      ],
      correctAnswer: [
        { item: 'L1', target: 'M1' },
        { item: 'M1', target: 'R1' },
      ],
      ...overrides,
    });

    it('accepts a columns-only chain payload without mirror fields (b28_q2 regression)', () => {
      expect(validateQuestionPayloadCapabilities(canonicalChain())).toEqual([]);
    });

    it('reports a missing middle column on canonical payloads', () => {
      const issues = validateQuestionPayloadCapabilities(canonicalChain({
        columns: [
          { id: 'left', items: [{ id: 'L1' }] },
          { id: 'middle', items: [] },
          { id: 'right', items: [{ id: 'R1' }] },
        ],
        correctAnswer: undefined,
      }));

      expect(issues).toContainEqual(expect.objectContaining({
        code: 'MISSING_REQUIRED_FIELD',
        field: 'middleItems',
      }));
    });

    it('detects duplicate ids across canonical columns', () => {
      const issues = validateQuestionPayloadCapabilities(canonicalChain({
        columns: [
          { id: 'left', items: [{ id: 'same' }] },
          { id: 'middle', items: [{ id: 'same' }] },
          { id: 'right', items: [{ id: 'R1' }] },
        ],
        correctAnswer: undefined,
      }));

      expect(issues).toContainEqual(expect.objectContaining({ code: 'DUPLICATE_MATCHING_ID' }));
    });

    it('rejects non-adjacent left-to-right edges on canonical payloads', () => {
      const issues = validateQuestionPayloadCapabilities(canonicalChain({
        correctAnswer: [{ item: 'L1', target: 'R1' }],
      }));

      expect(issues).toContainEqual(expect.objectContaining({
        code: 'INVALID_CHAIN_EDGE',
        field: 'correctAnswer',
      }));
    });

    it('sees the same data as the renderer resolver (anti-drift)', () => {
      const payload = canonicalChain();

      expect(validateQuestionPayloadCapabilities(payload)).toEqual([]);

      const resolved = resolveMatchingPayload(payload);
      expect(resolved.leftItems).toHaveLength(1);
      expect(resolved.middleItems).toHaveLength(1);
      expect(resolved.rightItems).toHaveLength(1);
      expect(resolved.correctEdges).toEqual([
        { item: 'L1', target: 'M1' },
        { item: 'M1', target: 'R1' },
      ]);
    });
  });

  it('reports exact nested paths for import-envelope payloads', () => {
    const issues = validateImportedQuestionCapabilities({
      chapters: [{ lessons: [{ questions: [{
        question_type: 'single_choice',
        payload: { type: 'single_choice', content, display: { interactionType: 'dropdown', layout: 'grid_9' } },
      }] }] }],
    });

    expect(issues[0]).toMatchObject({
      code: 'UNSUPPORTED_LAYOUT',
      path: '$.chapters[0].lessons[0].questions[0].payload',
    });
    expect(issues[0].message).toContain('single_choice/dropdown');
  });

  it('rejects diagram_fill whose correctAnswer keys have no fillable nodes', () => {
    const issues = validateQuestionPayloadCapabilities({
      type: 'diagram_fill',
      content,
      nodes: [
        { id: 'c1', x: 0.187, y: 0.612, width: 0.075, placeholder: '?' },
        { id: 'c2', x: 0.4, y: 0.612, width: 0.075, placeholder: '?' },
      ],
      edges: [],
      correctAnswer: { c1: 'a', c2: ['b', 'c'] },
    });

    expect(issues).toContainEqual(expect.objectContaining({
      code: 'DIAGRAM_FILL_NO_FILLABLE',
      type: 'diagram_fill',
      field: 'nodes',
      path: '$',
    }));
    expect(issues.find(({ code }) => code === 'DIAGRAM_FILL_NO_FILLABLE')?.message)
      .toContain('c1');
  });

  it('rejects diagram_fill with neither fillable nodes nor a correctAnswer', () => {
    const issues = validateQuestionPayloadCapabilities({
      type: 'diagram_fill',
      content,
      nodes: [{ id: 'n1', x: 0.2, y: 0.3 }],
      edges: [],
    });

    expect(issues).toContainEqual(expect.objectContaining({ code: 'DIAGRAM_FILL_NO_FILLABLE' }));
    expect(issues.find(({ code }) => code === 'DIAGRAM_FILL_NO_FILLABLE')?.message)
      .toContain('chưa có correctAnswer');
  });

  it('accepts diagram_fill with fillable nodes, and with an empty node list', () => {
    expect(validateQuestionPayloadCapabilities({
      type: 'diagram_fill',
      content,
      nodes: [
        { id: 'n1', x: 0.2, y: 0.3, fillable: true },
        { id: 'n3', x: 0.45, y: 0.7, label: 'Kết quả' },
      ],
      edges: [],
      correctAnswer: { n1: 'Nguyên nhân' },
    })).toEqual([]);
    expect(validateQuestionPayloadCapabilities({
      type: 'diagram_fill',
      content,
      nodes: [],
      edges: [],
    })).toEqual([]);
  });

  // -------------------------------------------------------------------------
  // GAP-229 — bảng v2 (spec §5.16.6)
  // -------------------------------------------------------------------------
  describe('table_completion v2 diagnostics (GAP-229)', () => {
    const tableQuestion = (table: unknown, extra: Record<string, unknown> = {}) => ({
      type: 'table_completion',
      content,
      display: { interactionType: 'fill' },
      table,
      ...extra,
    });
    const codesOf = (payload: Record<string, unknown>) =>
      validateQuestionPayloadCapabilities(payload).map(({ code }) => code);

    /**
     * BỘ KIỂM HỒI QUY BẢO VỆ 47 CÂU HỎI ĐANG CHẠY (125 hàng).
     *
     * Bảng v1 (`headers[]`, không có `columns[]`) phải KHÔNG BAO GIỜ sinh chẩn
     * đoán, kể cả khi hàng thiếu ô so với số cột. Nếu bất kỳ trường hợp nào dưới
     * đây báo lỗi thì thay đổi này đã làm hỏng nội dung thật đang phát hành.
     */
    describe('v1 tables stay lenient forever (47 live questions / 125 short rows)', () => {
      const v1Headers = [
        { id: 'c1', label: 'Cột 1' },
        { id: 'c2', label: 'Cột 2' },
        { id: 'c3', label: 'Cột 3' },
        { id: 'c4', label: 'Cột 4' },
      ];
      const cell = (columnId: string, cellType = 'static') => ({ columnId, cellType, text: columnId });

      it.each([
        [
          'archetype A — hàng chỉ có 1 ô trên bảng 4 cột',
          [{ id: 'r1', cells: [cell('c1')] }],
        ],
        [
          'archetype B — thiếu ô ở ĐẦU hàng (76/125 hàng thuộc nhóm này)',
          [{ id: 'r1', cells: [cell('c3'), cell('c4')] }],
        ],
        [
          'archetype C — thiếu ô ở CUỐI hàng',
          [{ id: 'r1', cells: [cell('c1'), cell('c2')] }],
        ],
        [
          'archetype D — thủng ô ở GIỮA hàng',
          [{ id: 'r1', cells: [cell('c1'), cell('c4')] }],
        ],
        [
          'hàng isGroupHeader 1 ô trên bảng 4 cột',
          [
            { id: 'g1', isGroupHeader: true, cells: [cell('c1')] },
            { id: 'r1', cells: [cell('c1'), cell('c2'), cell('c3'), cell('c4')] },
          ],
        ],
        [
          'hàng rỗng hoàn toàn',
          [{ id: 'r1', cells: [] }],
        ],
        [
          'nhiều archetype trộn lẫn trong một bảng',
          [
            { id: 'r1', cells: [cell('c1')] },
            { id: 'r2', cells: [cell('c3'), cell('c4')] },
            { id: 'r3', cells: [cell('c1'), cell('c2')] },
            { id: 'r4', cells: [cell('c1'), cell('c4')] },
          ],
        ],
      ])('%s → không có chẩn đoán nào', (_label, rows) => {
        expect(validateQuestionPayloadCapabilities(tableQuestion({ headers: v1Headers, rows }))).toEqual([]);
      });

      it('stays silent even on v1 data that would be illegal under v2', () => {
        // id cột trùng, id hàng trùng, columnId mồ côi, span sai kiểu, ô gộp
        // trong nhóm tick — tất cả đều là lỗi v2, nhưng v1 vẫn khoan dung.
        expect(validateQuestionPayloadCapabilities(tableQuestion({
          headers: [{ id: 'c1', label: 'A' }, { id: 'c1', label: 'B' }, { id: 'c3', label: 'C' }],
          tickGroups: [['c1', 'c3']],
          rows: [
            { id: 'dup', cells: [{ columnId: 'khong-ton-tai', cellType: 'static' }] },
            { id: 'dup', cells: [{ columnId: 'c1', cellType: 'tick', colSpan: 0, rowSpan: '2' }] },
          ],
        }))).toEqual([]);
      });

      it('stays silent on a v1 table with no headers at all', () => {
        expect(validateQuestionPayloadCapabilities(tableQuestion({
          rows: [{ id: 'r1', cells: [cell('c1'), cell('c2')] }],
        }))).toEqual([]);
      });
    });

    describe('well-formed v2 tables produce zero issues', () => {
      const columns = [{ id: 'c1', label: 'A' }, { id: 'c2', label: 'B' }, { id: 'c3', label: 'C' }];

      it('accepts a plain grid with a header tier', () => {
        expect(validateQuestionPayloadCapabilities(tableQuestion({
          columns,
          headerRows: [{ id: 'h1', cells: columns.map(({ id }) => ({ columnId: id, cellType: 'static', text: id })) }],
          rows: [{ id: 'r1', cells: columns.map(({ id }) => ({ columnId: id, cellType: 'static' })) }],
        }))).toEqual([]);
      });

      it('accepts headerRows: [] (186 corpus tables have no column-name tier)', () => {
        expect(validateQuestionPayloadCapabilities(tableQuestion({
          columns,
          headerRows: [],
          rows: [{ id: 'r1', cells: columns.map(({ id }) => ({ columnId: id, cellType: 'static' })) }],
        }))).toEqual([]);
      });

      it('accepts colSpan', () => {
        expect(validateQuestionPayloadCapabilities(tableQuestion({
          columns,
          rows: [
            { id: 'r1', cells: [{ columnId: 'c1', cellType: 'static', colSpan: 2 }, { columnId: 'c3', cellType: 'input' }] },
            { id: 'r2', cells: [{ columnId: 'c1', cellType: 'static', colSpan: 3 }] },
          ],
        }))).toEqual([]);
      });

      it('accepts rowSpan carried over the following rows', () => {
        expect(validateQuestionPayloadCapabilities(tableQuestion({
          columns,
          rows: [
            {
              id: 'r1',
              cells: [
                { columnId: 'c1', cellType: 'static', rowSpan: 3 },
                { columnId: 'c2', cellType: 'static' },
                { columnId: 'c3', cellType: 'input' },
              ],
            },
            { id: 'r2', cells: [{ columnId: 'c2', cellType: 'static' }, { columnId: 'c3', cellType: 'input' }] },
            { id: 'r3', cells: [{ columnId: 'c2', cellType: 'static' }, { columnId: 'c3', cellType: 'input' }] },
          ],
        }))).toEqual([]);
      });

      it('accepts colSpan and rowSpan on the same cell', () => {
        expect(validateQuestionPayloadCapabilities(tableQuestion({
          columns,
          rows: [
            { id: 'r1', cells: [{ columnId: 'c1', cellType: 'static', colSpan: 2, rowSpan: 2 }, { columnId: 'c3', cellType: 'input' }] },
            { id: 'r2', cells: [{ columnId: 'c3', cellType: 'input' }] },
          ],
        }))).toEqual([]);
      });

      it('accepts tickGroups when no spanning cell anchors inside a group', () => {
        expect(validateQuestionPayloadCapabilities(tableQuestion({
          columns,
          tickGroups: [['c2', 'c3']],
          rows: [
            { id: 'g1', cells: [{ columnId: 'c1', cellType: 'static', colSpan: 3, text: 'Nhóm 1' }] },
            { id: 'r1', cells: [{ columnId: 'c1', cellType: 'static' }, { columnId: 'c2', cellType: 'tick' }, { columnId: 'c3', cellType: 'tick' }] },
          ],
        }))).toEqual([]);
      });

      it('accepts a v2 table with columns but no rows yet', () => {
        expect(validateQuestionPayloadCapabilities(tableQuestion({ columns, rows: [] }))).toEqual([]);
      });
    });

    describe('each of the ten TABLE_* codes fires on malformed v2 data', () => {
      const twoColumns = [{ id: 'c1' }, { id: 'c2' }];
      const threeColumns = [{ id: 'c1' }, { id: 'c2' }, { id: 'c3' }];
      const findIssue = (payload: Record<string, unknown>, code: string) =>
        validateQuestionPayloadCapabilities(payload).find((issue) => issue.code === code);

      it('TABLE_MISSING_COLUMNS — columns is an empty array', () => {
        const issue = findIssue(
          tableQuestion({ columns: [], rows: [{ id: 'r1', cells: [{ columnId: 'c1' }] }] }),
          'TABLE_MISSING_COLUMNS',
        );
        expect(issue).toMatchObject({ type: 'table_completion', interactionType: 'fill', field: 'table.columns', path: '$' });
        expect(issue?.message).toContain('mảng rỗng');
        expect(issue?.message).toContain('Vị trí: $.');
      });

      it('TABLE_MISSING_COLUMNS — headerRows authored without any columns', () => {
        const issue = findIssue(
          tableQuestion({
            headerRows: [{ id: 'h1', cells: [{ columnId: 'c1' }] }],
            rows: [{ id: 'r1', cells: [{ columnId: 'c1' }] }],
          }),
          'TABLE_MISSING_COLUMNS',
        );
        expect(issue?.message).toContain('headerRows');
      });

      it('TABLE_DUPLICATE_COLUMN_ID', () => {
        const issue = findIssue(
          tableQuestion({
            columns: [{ id: 'c1' }, { id: 'c1' }],
            rows: [{ id: 'r1', cells: [{ columnId: 'c1' }, { columnId: 'c1' }] }],
          }),
          'TABLE_DUPLICATE_COLUMN_ID',
        );
        expect(issue).toMatchObject({ field: 'table.columns' });
        expect(issue?.message).toContain('"c1" (2 lần)');
      });

      it('TABLE_DUPLICATE_ROW_ID', () => {
        const issue = findIssue(
          tableQuestion({
            columns: twoColumns,
            rows: [
              { id: 'r1', cells: [{ columnId: 'c1' }, { columnId: 'c2' }] },
              { id: 'r1', cells: [{ columnId: 'c1' }, { columnId: 'c2' }] },
            ],
          }),
          'TABLE_DUPLICATE_ROW_ID',
        );
        expect(issue).toMatchObject({ field: 'table.rows' });
        expect(issue?.message).toContain('"r1" (2 lần)');
        expect(issue?.message).toContain('rowId__columnId');
      });

      it('TABLE_UNKNOWN_COLUMN', () => {
        const issue = findIssue(
          tableQuestion({
            columns: twoColumns,
            rows: [{ id: 'r1', cells: [{ columnId: 'c1' }, { columnId: 'ma-quy' }] }],
          }),
          'TABLE_UNKNOWN_COLUMN',
        );
        expect(issue).toMatchObject({ field: 'table.rows' });
        expect(issue?.message).toContain('"ma-quy"');
        expect(issue?.message).toContain('hàng "r1"');
      });

      it('TABLE_ANCHOR_MISMATCH — cells declared out of column order', () => {
        const issue = findIssue(
          tableQuestion({
            columns: twoColumns,
            rows: [{ id: 'r1', cells: [{ columnId: 'c2' }, { columnId: 'c1' }] }],
          }),
          'TABLE_ANCHOR_MISMATCH',
        );
        expect(issue?.message).toContain('columnId="c2"');
        expect(issue?.message).toContain('cột 1 ("c1")');
      });

      it('TABLE_ROW_WIDTH_MISMATCH — row too narrow', () => {
        const issue = findIssue(
          tableQuestion({
            columns: threeColumns,
            rows: [{ id: 'r1', cells: [{ columnId: 'c1' }, { columnId: 'c2' }] }],
          }),
          'TABLE_ROW_WIDTH_MISMATCH',
        );
        expect(issue).toMatchObject({ field: 'table.rows' });
        expect(issue?.message).toContain('phủ đúng 3 cột');
        expect(issue?.message).toContain('thiếu 1 ô tại cột 3 ("c3")');
      });

      it('TABLE_ROW_WIDTH_MISMATCH — row too wide', () => {
        const issue = findIssue(
          tableQuestion({
            columns: twoColumns,
            rows: [{ id: 'r1', cells: [{ columnId: 'c1', colSpan: 2 }, { columnId: 'c2' }] }],
          }),
          'TABLE_ROW_WIDTH_MISMATCH',
        );
        expect(issue?.message).toContain('thừa 1 ô tràn khỏi mép phải');
      });

      it('TABLE_ROW_WIDTH_MISMATCH — reported per section, header rows included', () => {
        const issues = validateQuestionPayloadCapabilities(tableQuestion({
          columns: twoColumns,
          headerRows: [{ id: 'h1', cells: [{ columnId: 'c1' }] }],
          rows: [{ id: 'r1', cells: [{ columnId: 'c1' }] }],
        })).filter(({ code }) => code === 'TABLE_ROW_WIDTH_MISMATCH');

        expect(issues.map(({ field }) => field)).toEqual(['table.headerRows', 'table.rows']);
        expect(issues[0].message).toContain('hàng tiêu đề');
        expect(issues[1].message).toContain('thân bảng');
      });

      it('TABLE_CELL_OVERLAP — a wide cell runs into rowSpan territory', () => {
        const issue = findIssue(
          tableQuestion({
            columns: threeColumns,
            rows: [
              { id: 'r1', cells: [{ columnId: 'c1' }, { columnId: 'c2', rowSpan: 2 }, { columnId: 'c3' }] },
              { id: 'r2', cells: [{ columnId: 'c1', colSpan: 3 }] },
            ],
          }),
          'TABLE_CELL_OVERLAP',
        );
        expect(issue?.message).toContain('hàng "r2"');
        expect(issue?.message).toContain('cột 2 ("c2")');
      });

      it('TABLE_ROWSPAN_OVERFLOW — rowSpan on the last row', () => {
        const issue = findIssue(
          tableQuestion({
            columns: twoColumns,
            rows: [
              { id: 'r1', cells: [{ columnId: 'c1' }, { columnId: 'c2' }] },
              { id: 'r2', cells: [{ columnId: 'c1', rowSpan: 2 }, { columnId: 'c2' }] },
            ],
          }),
          'TABLE_ROWSPAN_OVERFLOW',
        );
        expect(issue?.message).toContain('ô "r2/c1"');
        expect(issue?.message).toContain('vượt quá hàng cuối 1 hàng');
      });

      it('TABLE_INVALID_SPAN — the resolver clamps these, so the raw payload is the only witness', () => {
        const issue = findIssue(
          tableQuestion({
            columns: twoColumns,
            rows: [{ id: 'r1', cells: [{ columnId: 'c1', colSpan: 0 }, { columnId: 'c2', rowSpan: 1.5 }] }],
          }),
          'TABLE_INVALID_SPAN',
        );
        expect(issue).toMatchObject({ field: 'table.rows' });
        expect(issue?.message).toContain('2 ô sai');
        expect(issue?.message).toContain('colSpan=0');
        expect(issue?.message).toContain('rowSpan=1.5');
      });

      it('TABLE_INVALID_SPAN — a numeric string is still not an integer span', () => {
        expect(codesOf(tableQuestion({
          columns: twoColumns,
          rows: [{ id: 'r1', cells: [{ columnId: 'c1' }, { columnId: 'c2', rowSpan: '1' }] }],
        }))).toContain('TABLE_INVALID_SPAN');
      });

      it('TABLE_TICKGROUP_SPAN_AMBIGUOUS', () => {
        const issue = findIssue(
          tableQuestion({
            columns: threeColumns,
            tickGroups: [['c2', 'c3']],
            rows: [{ id: 'r1', cells: [{ columnId: 'c1' }, { columnId: 'c2', cellType: 'tick', colSpan: 2 }] }],
          }),
          'TABLE_TICKGROUP_SPAN_AMBIGUOUS',
        );
        expect(issue?.message).toContain('ô "c2"');
        expect(issue?.message).toContain('[c2, c3]');
      });

      it('covers all ten codes across the fixtures above', () => {
        const seen = new Set<string>([
          ...codesOf(tableQuestion({ columns: [], rows: [] })),
          ...codesOf(tableQuestion({
            columns: [{ id: 'c1' }, { id: 'c1' }, { id: 'c3' }],
            tickGroups: [['c3']],
            rows: [
              { id: 'r1', cells: [{ columnId: 'c1' }, { columnId: 'c1' }, { columnId: 'c3', colSpan: 0 }] },
              { id: 'r1', cells: [{ columnId: 'c3' }, { columnId: 'c1' }] },
              { id: 'r3', cells: [{ columnId: 'c1' }, { columnId: 'c1', rowSpan: 2 }, { columnId: 'c3', colSpan: 2, cellType: 'tick' }] },
              { id: 'r4', cells: [{ columnId: 'ghost' }, { columnId: 'c1', colSpan: 3 }] },
            ],
          })),
          ...codesOf(tableQuestion({
            columns: twoColumns,
            rows: [{ id: 'r1', cells: [{ columnId: 'c1', rowSpan: 2 }, { columnId: 'c2' }] }],
          })),
        ]);

        expect([...seen].filter((code) => code.startsWith('TABLE_')).sort()).toEqual([
          'TABLE_ANCHOR_MISMATCH',
          'TABLE_CELL_OVERLAP',
          'TABLE_DUPLICATE_COLUMN_ID',
          'TABLE_DUPLICATE_ROW_ID',
          'TABLE_INVALID_SPAN',
          'TABLE_MISSING_COLUMNS',
          'TABLE_ROWSPAN_OVERFLOW',
          'TABLE_ROW_WIDTH_MISMATCH',
          'TABLE_TICKGROUP_SPAN_AMBIGUOUS',
          'TABLE_UNKNOWN_COLUMN',
        ]);
      });
    });

    it('finds a bad v2 table nested inside a question_group with the right path', () => {
      const issues = validateQuestionPayloadCapabilities({
        type: 'question_group',
        content,
        display: { interactionType: 'group', layout: 'grid_2' },
        questions: [
          { type: 'single_choice', content, display: { interactionType: 'button', layout: 'grid_4' } },
          tableQuestion({ columns: [{ id: 'c1' }, { id: 'c2' }], rows: [{ id: 'r1', cells: [{ columnId: 'c1' }] }] }),
        ],
      });

      expect(issues).toContainEqual(expect.objectContaining({
        code: 'TABLE_ROW_WIDTH_MISMATCH',
        path: '$.questions[1]',
      }));
      expect(issues[0].message).toContain('Vị trí: $.questions[1].');
    });

    it('finds a bad v2 table through subQuestions and children too', () => {
      for (const key of ['subQuestions', 'children'] as const) {
        const issues = validateQuestionPayloadCapabilities({
          type: 'question_group',
          content,
          display: { interactionType: 'group', layout: 'grid_2' },
          [key]: [tableQuestion({ columns: [{ id: 'c1' }, { id: 'c2' }], rows: [{ id: 'r1', cells: [{ columnId: 'c1' }] }] })],
        });
        expect(issues).toContainEqual(expect.objectContaining({
          code: 'TABLE_ROW_WIDTH_MISMATCH',
          path: `$.${key}[0]`,
        }));
      }
    });

    it('reports a bad v2 table found inside a book-import envelope', () => {
      const issues = validateImportedQuestionCapabilities({
        chapters: [{ lessons: [{ questions: [{
          question_type: 'table_completion',
          payload: {
            type: 'table_completion',
            content,
            table: { columns: [{ id: 'c1' }, { id: 'c2' }], rows: [{ id: 'r1', cells: [{ columnId: 'c1' }] }] },
          },
        }] }] }],
      });

      expect(issues[0]).toMatchObject({
        code: 'TABLE_ROW_WIDTH_MISMATCH',
        path: '$.chapters[0].lessons[0].questions[0].payload',
      });
    });

    it('never throws on malformed or garbage table data', () => {
      const garbage: unknown[] = [
        undefined,
        null,
        42,
        'bảng',
        [],
        { columns: 'nope', rows: 'nope' },
        { columns: [null, 3, 'x'], rows: null },
        { columns: [{ id: 'c1' }], rows: [null, { cells: 'x' }, {}, { id: '', cells: [null, 7] }] },
        { columns: [{}], headerRows: 'x', rows: [{ cells: [{ columnId: null, colSpan: {} }] }] },
        { columns: [{ id: 'c1' }], rows: [{ id: 'r1', cells: [{ columnId: 'c1', rowSpan: Number.NaN }] }] },
        { columns: [{ id: 'c1' }], tickGroups: 'nope', rows: [] },
        { columns: [{ id: 'c1' }], tickGroups: [null, [], ['c1']], rows: [] },
        { headerRows: [], rows: [] },
      ];

      for (const table of garbage) {
        expect(() => validateQuestionPayloadCapabilities(tableQuestion(table))).not.toThrow();
      }
      expect(() => validateQuestionPayloadCapabilities(tableQuestion(undefined))).not.toThrow();
    });

    it('leaves other question types untouched even when they carry a table field', () => {
      expect(validateQuestionPayloadCapabilities({
        type: 'checkbox_table',
        content,
        table: { columns: [], rows: [{ id: 'r1', cells: [] }] },
      })).toEqual([]);
    });
  });
});

describe('payload rỗng — hiển thị được nhưng không trả lời được (issue #810)', () => {
  const coloring = (extra: Record<string, unknown>) => ({ type: 'coloring', content, ...extra });
  const crossword = (extra: Record<string, unknown>) => ({ type: 'crossword', content, ...extra });

  it('flags a coloring payload with no regions at all', () => {
    const issues = validateQuestionPayloadCapabilities(coloring({ colors: ['#f00'] }));
    expect(issues).toContainEqual(expect.objectContaining({
      code: 'COLORING_NO_REGIONS',
      severity: 'warning',
      type: 'coloring',
      field: 'regions',
      path: '$',
    }));
    expect(issues[0].message).toContain('chưa có trường "regions"');
  });

  it('flags regions that the renderer drops, not just an empty array', () => {
    // The raw array is non-empty, so a `payload.regions.length` check would pass
    // while the player still paints nothing — this is why the detector reads
    // through resolveColoringConfig.
    const issues = validateQuestionPayloadCapabilities(coloring({ regions: [null, {}, { id: '  ' }] }));
    expect(issues[0]).toMatchObject({ code: 'COLORING_NO_REGIONS', path: '$' });
    expect(issues[0].message).toContain('Có 3 phần tử');
  });

  it('flags a crossword payload whose entries resolve to nothing', () => {
    expect(validateQuestionPayloadCapabilities(crossword({ size: { rows: 10, cols: 8 }, entries: [] }))[0])
      .toMatchObject({ code: 'CROSSWORD_NO_ENTRIES', severity: 'warning', field: 'entries', path: '$' });
    expect(validateQuestionPayloadCapabilities(crossword({ entries: [null, 'e1'] }))[0].message)
      .toContain('Có 2 phần tử');
  });

  it('stays silent on payloads that do have answerable content', () => {
    expect(validateQuestionPayloadCapabilities(coloring({ regions: [{ id: 'r1', label: 'Ô 1' }] }))).toEqual([]);
    expect(validateQuestionPayloadCapabilities(crossword({
      entries: [{ id: 'e1', startRow: 0, startCol: 0, direction: 'across', length: 3 }],
      correctAnswer: { e1: 'ABC' },
    }))).toEqual([]);
  });

  it('is a warning, so it never blocks save or import', () => {
    const issues = validateQuestionPayloadCapabilities(coloring({ regions: [] }));
    expect(issues).toHaveLength(1);
    expect(blockingCapabilityIssues(issues)).toEqual([]);
  });

  it('keeps every pre-existing issue blocking by default', () => {
    const issues = validateQuestionPayloadCapabilities({ type: 'future_type', content });
    expect(issues[0].severity).toBe('error');
    expect(blockingCapabilityIssues(issues)).toHaveLength(1);
  });

  it('reports nested children with their own path', () => {
    const issues = validateQuestionPayloadCapabilities({
      type: 'question_group',
      content,
      display: { interactionType: 'group', layout: 'grid_2' },
      questions: [coloring({ regions: [] })],
    });
    expect(issues).toContainEqual(expect.objectContaining({
      code: 'COLORING_NO_REGIONS',
      path: '$.questions[0]',
    }));
  });

  it('leaves other question types untouched', () => {
    expect(validateQuestionPayloadCapabilities({ type: 'essay', content, regions: [], entries: [] })).toEqual([]);
  });

  it('never throws on garbage', () => {
    const garbage: unknown[] = ['nope', 7, {}, [], null, { id: 1 }];
    for (const value of garbage) {
      expect(() => validateQuestionPayloadCapabilities(coloring({ regions: value }))).not.toThrow();
      expect(() => validateQuestionPayloadCapabilities(crossword({ entries: value, correctAnswer: value }))).not.toThrow();
    }
  });
});

describe('matching triad — cùng luật cấu trúc với chain, chỉ khác cardinality (§5.9.3)', () => {
  const triad = (correctAnswer: unknown) => ({
    type: 'matching',
    display: { interactionType: 'triad' },
    columns: [
      { id: 'left', items: [{ id: 'L1' }, { id: 'L2' }] },
      { id: 'middle', items: [{ id: 'M1' }] },
      { id: 'right', items: [{ id: 'R1' }, { id: 'R2' }] },
    ],
    correctAnswer,
  });

  it('chấp nhận một ô giữa toả nhiều cạnh sang cả hai bên', () => {
    expect(validateQuestionPayloadCapabilities(triad([
      { item: 'L1', target: 'M1' },
      { item: 'L2', target: 'M1' },
      { item: 'M1', target: 'R1' },
      { item: 'M1', target: 'R2' },
    ]))).toEqual([]);
  });

  it('chấp nhận ô giữa chỉ nối một phía — dạng chain không diễn đạt được', () => {
    expect(validateQuestionPayloadCapabilities(triad([{ item: 'L1', target: 'M1' }]))).toEqual([]);
  });

  it('cùng đáp án một phía đó gắn chain thì vẫn bị chặn', () => {
    const asChain = { ...triad([{ item: 'L1', target: 'M1' }]), display: { interactionType: 'chain' } };
    expect(validateQuestionPayloadCapabilities(asChain).map((issue) => issue.code))
      .toContain('INCOMPLETE_CHAIN_ANSWER_KEY');
  });

  it('vẫn chặn cạnh nhảy cột hoặc ngược hướng', () => {
    const codes = validateQuestionPayloadCapabilities(triad([{ item: 'L1', target: 'R1' }]))
      .map((issue) => issue.code);
    expect(codes).toContain('INVALID_CHAIN_EDGE');
  });

  it('hard cut: `hub` no longer resolves — UNKNOWN_INTERACTION, not the triad structural rules', () => {
    const asHub = { ...triad([{ item: 'L1', target: 'M1' }]), display: { interactionType: 'hub' } };
    expect(validateQuestionPayloadCapabilities(asHub)[0]).toMatchObject({
      code: 'UNKNOWN_INTERACTION',
      path: '$',
    });
  });
});

describe('matching — cạnh đáp án trỏ tới ô không tồn tại', () => {
  const base = {
    type: 'matching',
    leftItems: [{ id: 'L1' }, { id: 'L2' }],
    rightItems: [{ id: 'R1' }, { id: 'R2' }],
  };

  it('báo lỗi khi đáp án trỏ tới id ngoài mọi cột', () => {
    const issues = validateQuestionPayloadCapabilities({
      ...base,
      correctAnswer: [
        { item: 'L1', target: 'R1' },
        { item: 'L1', target: 'R9' },
      ],
    });
    const dangling = issues.filter((issue) => issue.code === 'DANGLING_MATCHING_EDGE');
    expect(dangling).toHaveLength(1);
    expect(dangling[0].message).toContain('L1→R9');
  });

  it('đáp án hợp lệ thì im lặng', () => {
    const issues = validateQuestionPayloadCapabilities({
      ...base,
      correctAnswer: [{ item: 'L1', target: 'R1' }, { item: 'L2', target: 'R2' }],
    });
    expect(issues.filter((issue) => issue.code === 'DANGLING_MATCHING_EDGE')).toEqual([]);
  });
})
