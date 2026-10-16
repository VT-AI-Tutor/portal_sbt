import { describe, expect, it } from 'vitest';
import { deriveDiagramFillFillable } from './diagram-fill-fillable';

const base = (extra: Record<string, unknown>): Record<string, unknown> => ({
  type: 'diagram_fill',
  ...extra,
});

describe('deriveDiagramFillFillable', () => {
  it('flags self-assessed placeholder nodes (the imported-corpus case)', () => {
    const payload = base({
      selfAssessment: true,
      nodes: [
        { id: 'n1', x: 0.7, y: 0.1, placeholder: 'Ống tiêu hoá:…' },
        { id: 'n2', x: 0.7, y: 0.3, placeholder: 'Việc nên làm…' },
        { id: 'n3', x: 0.2, y: 0.9, placeholder: 'Tim;…' },
      ],
    });
    const result = deriveDiagramFillFillable(payload);
    expect(result.changed).toBe(true);
    expect(result.skipReason).toBeNull();
    expect(result.flaggedNodeIds).toEqual(['n1', 'n2', 'n3']);
    expect((result.payload.nodes as Record<string, unknown>[]).every((n) => n.fillable === true)).toBe(true);
  });

  it('flags nodes whose id is a correctAnswer key (graded case)', () => {
    const payload = base({
      nodes: [
        { id: 'n1', label: 'Ô 1' },
        { id: 'n2', label: 'Kết quả' },
      ],
      correctAnswer: { n1: 'Nguyên nhân' },
    });
    const result = deriveDiagramFillFillable(payload);
    expect(result.changed).toBe(true);
    expect(result.flaggedNodeIds).toEqual(['n1']);
    const nodes = result.payload.nodes as Record<string, unknown>[];
    expect(nodes[0].fillable).toBe(true);
    expect(nodes[1].fillable).toBeUndefined(); // n2 not an answer key → left as label
  });

  it('does nothing when a fillable node already exists', () => {
    const payload = base({
      selfAssessment: true,
      nodes: [{ id: 'n1', fillable: true, placeholder: 'x' }, { id: 'n2', placeholder: 'y' }],
    });
    const result = deriveDiagramFillFillable(payload);
    expect(result.changed).toBe(false);
    expect(result.skipReason).toBe('already_fillable');
    expect(result.payload).toBe(payload);
  });

  it('cannot derive without correctAnswer and without selfAssessment', () => {
    const payload = base({
      nodes: [{ id: 'n1', placeholder: 'x' }, { id: 'n2', placeholder: 'y' }],
    });
    const result = deriveDiagramFillFillable(payload);
    expect(result.changed).toBe(false);
    expect(result.skipReason).toBe('no_correct_answer');
  });

  it('does not flag self-assessed nodes that carry a real label and no placeholder', () => {
    const payload = base({
      selfAssessment: true,
      nodes: [
        { id: 'n1', label: 'Nhãn cố định' }, // real label, no placeholder → fixed
        { id: 'n2', placeholder: 'điền…' }, // blank → flagged
      ],
    });
    const result = deriveDiagramFillFillable(payload);
    expect(result.changed).toBe(true);
    expect(result.flaggedNodeIds).toEqual(['n2']);
  });

  it('ignores non-diagram_fill payloads', () => {
    const result = deriveDiagramFillFillable({ type: 'single_choice', nodes: [] });
    expect(result.changed).toBe(false);
    expect(result.skipReason).toBe('not_diagram_fill');
  });

  it('never mutates the input payload', () => {
    const nodes = [{ id: 'n1', placeholder: 'x' }];
    const payload = base({ selfAssessment: true, nodes });
    const snapshot = JSON.stringify(payload);
    deriveDiagramFillFillable(payload);
    expect(JSON.stringify(payload)).toBe(snapshot);
    expect((payload.nodes as Record<string, unknown>[])[0].fillable).toBeUndefined();
  });
});
