import { describe, expect, it } from 'vitest';
import {
  canonicalizeRichContent,
  htmlToInlineRichText,
  htmlToRichContent,
  htmlToRichTextRuns,
  plainTextFromRichContent,
  richContentToHtml,
  richTextRunsToHtml,
  sanitizeRichTextHtml,
  textToHtml,
} from './html';

describe('rich text string convention', () => {
  it('keeps inline marks and paragraph breaks when an editor value is saved to a text field', () => {
    expect(htmlToInlineRichText('<p><strong>Đậm</strong><br><em>Nghiêng</em></p><p>Dòng hai</p>'))
      .toBe('<strong>Đậm</strong><br><em>Nghiêng</em><br>Dòng hai');
  });

  it('hydrates legacy plain text with new lines into editor HTML', () => {
    expect(textToHtml('Dòng một\nDòng hai')).toBe('<p>Dòng một<br>Dòng hai</p>');
  });

  it('keeps blank lines and leading indentation from the editor', () => {
    const content = htmlToRichContent('<p>    Thụt đầu dòng</p><p></p><p>Dòng sau khoảng trắng</p>');
    expect(content.blocks).toEqual([
      { type: 'paragraph', content: [{ text: '    Thụt đầu dòng', annotations: {} }] },
      { type: 'paragraph', content: [] },
      { type: 'paragraph', content: [{ text: 'Dòng sau khoảng trắng', annotations: {} }] },
    ]);
  });

  it('sanitizes persisted markup while preserving the supported inline format', () => {
    expect(richContentToHtml({
      blocks: [{ type: 'paragraph', text: '<strong>Đậm</strong><script>alert(1)</script>' }],
    })).toBe('<p><strong>Đậm</strong></p>');
  });
});

describe('canonical annotation runs', () => {
  it('round-trips every supported mark and Vietnamese text', () => {
    const html = '<p><strong>Đậm</strong> <em>nghiêng</em> <u>gạch</u> <s>xóa</s> <code>mã</code> H<sub>2</sub> x<sup>2</sup> <span style="color: #dc2626">đỏ</span> <a href="https://example.com" target="_blank">link</a></p>';
    const content = htmlToRichContent(html);
    const output = richContentToHtml(content);

    expect(content.blocks[0]).not.toHaveProperty('text');
    expect(output).toContain('<strong>Đậm</strong>');
    expect(output).toContain('<sub>2</sub>');
    expect(output).toMatch(/color: (?:#dc2626|rgb\(220, 38, 38\))/);
    expect(output).toContain('rel="noopener noreferrer"');
    expect(htmlToRichTextRuns(content.blocks[0].content ?? [])).toEqual(content.blocks[0].content);
    expect(htmlToRichContent(output)).toEqual(content);
  });

  it('canonicalizes paragraph-like blocks recursively without changing technical scalars', () => {
    const math = { type: 'math', latex: '\\frac{1}{2}', text: 'legacy math fallback' };
    const code = { type: 'code', code: 'const x = 1;', language: 'ts' };
    const diagram = { type: 'diagram', svg: '<svg />', url: '/uploads/d.svg' };
    const canonical = canonicalizeRichContent({
      blocks: [
        { type: 'paragraph', text: '<strong>Mở đầu</strong>' },
        { type: 'layout', layout: 'two-column', columns: [[{ type: 'quote', text: 'Trích dẫn' }], [math, code, diagram]] },
      ],
    });

    expect(canonical.blocks[0]).toEqual({
      type: 'paragraph',
      content: [{ text: 'Mở đầu', annotations: { bold: true } }],
    });
    expect(canonical.blocks[1].columns?.[0][0]).not.toHaveProperty('text');
    expect(canonical.blocks[1].columns?.[1]).toEqual([math, code, diagram]);
  });

  it('uses one plain-text view for nested layouts and cloze markers', () => {
    expect(plainTextFromRichContent({
      blocks: [{ type: 'layout', columns: [[{
        type: 'paragraph',
        content: [{ text: '___[blank_1]___', annotations: { bold: true } }],
      }]] }],
    })).toBe('___[blank_1]___');
  });

  it('reads the user-provided canonical shape and preserves Vietnamese text', () => {
    expect(htmlToRichTextRuns([
      { text: 'Xin chào ', annotations: {} },
      { text: 'Việt Nam', annotations: { bold: true } },
    ])).toEqual([
      { text: 'Xin chào ', annotations: {} },
      { text: 'Việt Nam', annotations: { bold: true } },
    ]);
  });
});

describe('image width serialization (issue #456)', () => {
  const imageBlock = {
    type: 'image',
    url: '/uploads/books/b1/assets/a.png',
    alt: 'Sơ đồ',
    width: '60%',
    align: 'center',
  } as const;

  it('emits data-width and an inline img width style, stripped from the JSON copy', () => {
    const html = richContentToHtml({ blocks: [imageBlock] });

    expect(html).toContain('data-width="60%"');
    expect(html).toMatch(/<img [^>]*style="width: 60%"/);
    // Width must NOT hide inside data-block-json: a stale copy would resurrect
    // a cleared width on round-trip (the trap align has).
    expect(html).not.toContain(encodeURIComponent('"width"'));
  });

  it('parses data-width from a figure back into block.width', () => {
    const content = htmlToRichContent(
      '<figure data-rich-block="image" data-url="/uploads/a.png" data-width="45%"><img src="/uploads/a.png" /></figure>',
    );

    expect(content.blocks[0]).toEqual({ type: 'image', url: '/uploads/a.png', width: '45%' });
  });

  it('falls back to the img inline style width when data-width is absent', () => {
    const content = htmlToRichContent(
      '<figure data-rich-block="image" data-url="/uploads/a.png"><img src="/uploads/a.png" style="width: 150px" /></figure>',
    );

    expect(content.blocks[0].width).toBe('150px');
  });

  it('still decodes a legacy figure whose width lives only inside data-block-json', () => {
    const legacyJson = encodeURIComponent(
      JSON.stringify({ type: 'image', url: '/uploads/a.png', width: '70%', caption: 'Hình 1' }),
    );
    const content = htmlToRichContent(
      `<figure data-rich-block="image" data-url="/uploads/a.png" data-block-json="${legacyJson}"><img src="/uploads/a.png" /></figure>`,
    );

    expect(content.blocks[0].width).toBe('70%');
    expect(content.blocks[0].caption).toBe('Hình 1');
  });

  it('drops invalid widths on emit and on parse', () => {
    const html = richContentToHtml({ blocks: [{ ...imageBlock, width: '60vw; position: fixed' }] });
    expect(html).not.toContain('data-width');
    expect(html).not.toContain('style="width:');

    const content = htmlToRichContent(
      '<figure data-rich-block="image" data-url="/uploads/a.png" data-width="abc"><img src="/uploads/a.png" /></figure>',
    );
    expect(content.blocks[0]).not.toHaveProperty('width');
  });

  it('round-trips emit → parse with width and alt intact', () => {
    const content = htmlToRichContent(richContentToHtml({ blocks: [imageBlock] }));

    expect(content.blocks[0]).toEqual(imageBlock);
  });
});

describe('rich-text security', () => {
  it('drops unsafe protocols, invalid colors, scripts, and attacker-supplied rel values', () => {
    const sanitized = sanitizeRichTextHtml('<script>alert(1)</script><a href="javascript:alert(1)" target="_blank" rel="opener">x</a><span style="color: url(javascript:alert(1))">y</span>');
    expect(sanitized).not.toContain('script');
    expect(sanitized).not.toContain('javascript:');
    expect(sanitized).not.toContain('rel="opener"');
    expect(sanitized).not.toContain('style=');
  });

  it('removes styles from non-span elements and keeps only a valid span color', () => {
    const sanitized = sanitizeRichTextHtml(
      '<strong style="position: fixed; color: red">đậm</strong>' +
      '<a href="https://example.com" style="display: block">link</a>' +
      '<span style="position: fixed; color: #dc2626">đỏ</span>',
    );

    expect(sanitized).not.toContain('position');
    expect(sanitized).not.toContain('display');
    expect(sanitized).not.toContain('<strong style=');
    expect(sanitized).not.toContain('<a href="https://example.com" style=');
    expect(sanitized).toMatch(/<span style="color: (?:#dc2626|rgb\(220, 38, 38\))">đỏ<\/span>/);
  });

  it('normalizes untrusted canonical annotations before serialization', () => {
    const html = richTextRunsToHtml([{ text: 'x', annotations: {
      color: 'url(javascript:alert(1))',
      link: { href: 'javascript:alert(1)', target: '_blank', rel: 'opener' },
    } }]);
    expect(html).toBe('x');
  });
});

describe('#503 list item inline formatting', () => {
  it('keeps inline marks inside list items through HTML → payload → HTML', () => {
    const html = '<ul><li>Bình thường <strong>đậm</strong></li><li><em>Nghiêng</em></li></ul>';
    const content = htmlToRichContent(html);
    const list = content.blocks[0];

    expect(list.type).toBe('list');
    // Canonical runs carry the marks; plain `items` stays the legacy fallback.
    expect(list.itemsRuns).toEqual([
      [{ text: 'Bình thường ', annotations: {} }, { text: 'đậm', annotations: { bold: true } }],
      [{ text: 'Nghiêng', annotations: { italic: true } }],
    ]);
    expect(list.items).toEqual(['Bình thường đậm', 'Nghiêng']);

    const output = richContentToHtml(content);
    expect(output).toContain('<li>Bình thường <strong>đậm</strong></li>');
    expect(output).toContain('<li><em>Nghiêng</em></li>');
    // Stable across a second round-trip.
    expect(htmlToRichContent(output)).toEqual(content);
  });

  it('migrates a legacy string-only list to canonical runs without dropping items', () => {
    const canonical = canonicalizeRichContent({
      blocks: [{ type: 'list', ordered: false, items: ['Một', 'Hai'] }],
    });
    expect(canonical.blocks[0].itemsRuns).toEqual([
      [{ text: 'Một', annotations: {} }],
      [{ text: 'Hai', annotations: {} }],
    ]);
    expect(canonical.blocks[0].items).toEqual(['Một', 'Hai']);
  });
});
