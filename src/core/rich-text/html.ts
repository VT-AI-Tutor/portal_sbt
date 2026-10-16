import DOMPurify from 'dompurify';
import type {
  ContentLayout,
  RichContent,
  RichContentBlock,
  RichTextAnnotations,
  RichTextRun,
} from '@/core/question-schema';
import { normalizeContentLayout } from '@/core/rich-text/content-layout';
import { getUploadFileUrl } from '@/core/utils';

export const RICH_TEXT_INLINE_TAGS = [
  'strong', 'b', 'em', 'i', 'u', 's', 'a', 'br', 'sub', 'sup', 'code', 'span',
] as const;
export const RICH_TEXT_INLINE_ATTRIBUTES = ['href', 'target', 'rel', 'style'] as const;

const SAFE_COLOR_RE = /^(?:#[0-9a-f]{3}(?:[0-9a-f]{3})?|rgb\(\s*(?:\d{1,3}\s*,\s*){2}\d{1,3}\s*\)|rgba\(\s*(?:\d{1,3}\s*,\s*){2}\d{1,3}\s*,\s*(?:0|1|0?\.\d+)\s*\)|(?:black|white|red|green|blue|gray|grey|orange|purple|pink|yellow|teal|navy|maroon))$/i;
const SAFE_LINK_PROTOCOL_RE = /^(?:https?:|mailto:|tel:|\/|#)/i;

export function normalizeRichTextColor(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const color = value.trim();
  return SAFE_COLOR_RE.test(color) ? color : undefined;
}

export function normalizeRichTextLink(value: unknown): RichTextAnnotations['link'] | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const link = value as Record<string, unknown>;
  const href = typeof link.href === 'string' ? link.href.trim() : '';
  if (!href || !SAFE_LINK_PROTOCOL_RE.test(href)) return undefined;
  const target = link.target === '_blank' ? '_blank' : undefined;
  return { href, ...(target ? { target, rel: 'noopener noreferrer' } : {}) };
}

export function normalizeRichTextAnnotations(value: unknown): RichTextAnnotations {
  const source = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const normalized: RichTextAnnotations = {};
  for (const key of ['bold', 'italic', 'underline', 'strike', 'code', 'subscript', 'superscript'] as const) {
    if (source[key] === true) normalized[key] = true;
  }
  const color = normalizeRichTextColor(source.color);
  const link = normalizeRichTextLink(source.link);
  if (color) normalized.color = color;
  if (link) normalized.link = link;
  return normalized;
}

export function sanitizeRichTextHtml(value: string): string {
  const sanitized = String(DOMPurify.sanitize(value, {
    ALLOWED_TAGS: [...RICH_TEXT_INLINE_TAGS],
    ALLOWED_ATTR: [...RICH_TEXT_INLINE_ATTRIBUTES],
  }));
  if (typeof DOMParser === 'undefined') return sanitized;
  const doc = new DOMParser().parseFromString(`<div>${sanitized}</div>`, 'text/html');
  const root = doc.body.firstElementChild;
  if (!root) return '';
  root.querySelectorAll('a').forEach((anchor) => {
    const href = anchor.getAttribute('href')?.trim() ?? '';
    if (!SAFE_LINK_PROTOCOL_RE.test(href)) {
      anchor.removeAttribute('href');
      anchor.removeAttribute('target');
      anchor.removeAttribute('rel');
    } else if (anchor.getAttribute('target') === '_blank') {
      anchor.setAttribute('rel', 'noopener noreferrer');
    } else {
      anchor.removeAttribute('target');
      anchor.removeAttribute('rel');
    }
  });
  root.querySelectorAll('[style]').forEach((element) => {
    if (element.tagName.toLowerCase() !== 'span') {
      element.removeAttribute('style');
      return;
    }
    const color = normalizeRichTextColor((element as HTMLElement).style.color);
    if (color) element.setAttribute('style', `color: ${color}`);
    else element.removeAttribute('style');
  });
  return root.innerHTML;
}

function sameAnnotations(left: RichTextAnnotations, right: RichTextAnnotations): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function appendRun(runs: RichTextRun[], text: string, annotations: RichTextAnnotations): void {
  if (!text) return;
  const previous = runs.at(-1);
  if (previous && sameAnnotations(previous.annotations, annotations)) previous.text += text;
  else runs.push({ text, annotations });
}

function annotationsForElement(element: HTMLElement, inherited: RichTextAnnotations): RichTextAnnotations {
  const next = { ...inherited };
  const tag = element.tagName.toLowerCase();
  if (tag === 'strong' || tag === 'b') next.bold = true;
  if (tag === 'em' || tag === 'i') next.italic = true;
  if (tag === 'u') next.underline = true;
  if (tag === 's') next.strike = true;
  if (tag === 'code') next.code = true;
  if (tag === 'sub') next.subscript = true;
  if (tag === 'sup') next.superscript = true;
  if (tag === 'span') {
    const color = normalizeRichTextColor(element.style.color);
    if (color) next.color = color;
  }
  if (tag === 'a') {
    const link = normalizeRichTextLink({
      href: element.getAttribute('href'), target: element.getAttribute('target'), rel: element.getAttribute('rel'),
    });
    if (link) next.link = link;
  }
  return next;
}

/** Read canonical runs or legacy inline HTML through the same validated contract. */
export function htmlToRichTextRuns(value: string | RichTextRun[] | null | undefined): RichTextRun[] {
  if (Array.isArray(value)) {
    const runs: RichTextRun[] = [];
    value.forEach((run) => {
      if (!run || typeof run.text !== 'string') return;
      appendRun(runs, run.text, normalizeRichTextAnnotations(run.annotations));
    });
    return runs;
  }
  if (!value) return [];
  const sanitized = sanitizeRichTextHtml(value);
  const doc = new DOMParser().parseFromString(`<div>${sanitized}</div>`, 'text/html');
  const root = doc.body.firstElementChild;
  const runs: RichTextRun[] = [];
  const visit = (node: Node, annotations: RichTextAnnotations): void => {
    if (node.nodeType === Node.TEXT_NODE) { appendRun(runs, node.textContent ?? '', annotations); return; }
    if (!(node instanceof HTMLElement)) return;
    if (node.tagName.toLowerCase() === 'br') { appendRun(runs, '\n', annotations); return; }
    const next = annotationsForElement(node, annotations);
    node.childNodes.forEach((child) => visit(child, next));
  };
  root?.childNodes.forEach((node) => visit(node, {}));
  return runs;
}

export function plainTextFromRuns(runs?: RichTextRun[] | null): string {
  return htmlToRichTextRuns(runs).map((run) => run.text).join('');
}

/** Text-only view for parsing cloze markers and native controls. */
export function plainTextFromRichContent(content?: RichContent | null): string {
  const visit = (blocks: RichContentBlock[]): string[] => blocks.flatMap((block) => {
    if (block.type === 'layout') return (block.columns ?? []).flatMap(visit);
    if (['paragraph', 'heading', 'quote'].includes(block.type)) {
      return [Array.isArray(block.content) ? plainTextFromRuns(block.content) : plainTextFromHtml(block.text ?? '')];
    }
    return [];
  });
  return visit(content?.blocks ?? []).filter(Boolean).join('\n').trim();
}

export function richTextRunsToHtml(value?: RichTextRun[] | null): string {
  return htmlToRichTextRuns(value).map((run) => {
    const marks = run.annotations;
    let html = escapeHtml(run.text).replace(/\r?\n/g, '<br>');
    if (marks.code) html = `<code>${html}</code>`;
    if (marks.subscript) html = `<sub>${html}</sub>`;
    if (marks.superscript) html = `<sup>${html}</sup>`;
    if (marks.bold) html = `<strong>${html}</strong>`;
    if (marks.italic) html = `<em>${html}</em>`;
    if (marks.underline) html = `<u>${html}</u>`;
    if (marks.strike) html = `<s>${html}</s>`;
    if (marks.color) html = `<span style="color: ${escapeHtml(marks.color)}">${html}</span>`;
    if (marks.link) html = `<a href="${escapeHtml(marks.link.href)}"${marks.link.target ? ' target="_blank" rel="noopener noreferrer"' : ''}>${html}</a>`;
    return html;
  }).join('');
}

function inlineHtml(value: string): string {
  if (!value) return '';
  return sanitizeRichTextHtml(value).replace(/\r?\n/g, '<br>');
}

function blockTextHtml(block: RichContentBlock): string {
  return Array.isArray(block.content) ? richTextRunsToHtml(block.content) : inlineHtml(block.text ?? '');
}

/** Lazy migration: only human-readable paragraph-like blocks become runs. */
export function canonicalizeRichContent(content?: RichContent | null): RichContent {
  return {
    ...(content ?? { blocks: [] }),
    blocks: (content?.blocks ?? []).map((block) => {
      if (block.type === 'layout') {
        return { ...block, columns: (block.columns ?? []).map((column) => canonicalizeRichContent({ blocks: column }).blocks) };
      }
      if (block.type === 'list') {
        // #503: give legacy string-only lists canonical per-item runs so inline
        // marks round-trip. Existing plain `items` stay as the legacy fallback.
        if (block.itemsRuns) return block;
        return { ...block, itemsRuns: (block.items ?? []).map((item) => htmlToRichTextRuns(item)) };
      }
      if (!['paragraph', 'heading', 'quote'].includes(block.type)) return block;
      const next = { ...block, content: htmlToRichTextRuns(block.content ?? block.text ?? '') };
      delete next.text;
      return next;
    }),
  };
}

/**
 * Inline-HTML view of the human-readable blocks — the display counterpart of
 * `plainTextFromRichContent`, for surfaces that render a single inline string
 * (`RichTextValue`) rather than a full block tree: table cells, labels, chips.
 * Paragraph-like blocks keep their marks and are joined by `<br>`; media and
 * preserved blocks are left to whoever renders them (e.g. `contentImageUrl`).
 */
export function inlineHtmlFromRichContent(content?: RichContent | null): string {
  const visit = (blocks: RichContentBlock[]): string[] => blocks.flatMap((block) => {
    if (block.type === 'layout') return (block.columns ?? []).flatMap(visit);
    if (['paragraph', 'heading', 'quote'].includes(block.type)) return [blockTextHtml(block)];
    return [];
  });
  return visit(content?.blocks ?? []).filter((part) => part.trim() !== '').join('<br>');
}

export function plainTextFromHtml(html: string): string {
  if (!html.trim()) return '';
  const doc = new DOMParser().parseFromString(html, 'text/html');
  doc.body.querySelectorAll('br').forEach((br) => br.replaceWith('\n'));
  return (doc.body.textContent ?? '').replace(/\u00a0/g, ' ').trim();
}

export function textToHtml(value: unknown): string {
  // Persisted prompt/label fields are historically plain strings, but older
  // payloads can contain rich-text runs or `{ text }` objects. Keep malformed
  // values from throwing while the structured editor is mounting.
  const text =
    typeof value === 'string'
      ? value
      : Array.isArray(value)
        ? richTextRunsToHtml(value as RichTextRun[])
        : value && typeof value === 'object' && typeof (value as { text?: unknown }).text === 'string'
          ? (value as { text: string }).text
          : '';
  const trimmed = text.trim();
  if (!trimmed) return '<p></p>';
  return `<p>${inlineHtml(trimmed)}</p>`;
}

/** Convert one string field edited as block HTML back to inline rich text. */
export function htmlToInlineRichText(html: string): string {
  if (!html.trim()) return '';
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const parts: string[] = [];

  for (const node of Array.from(doc.body.childNodes)) {
    if (node.nodeType === Node.TEXT_NODE) {
      parts.push(escapeHtml(node.textContent ?? ''));
      continue;
    }
    if (!(node instanceof HTMLElement)) continue;
    const tag = node.tagName.toLowerCase();
    if (tag === 'br') {
      parts.push('<br>');
      continue;
    }
    if (/^(p|h[1-6]|div|blockquote|li)$/.test(tag)) {
      parts.push(node.innerHTML);
      parts.push('<br>');
      continue;
    }
    parts.push(node.outerHTML);
  }

  return sanitizeRichTextHtml(parts.join('').replace(/(?:<br>)+$/i, ''));
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Prefer stable relative upload paths for persistence. */
export function normalizeStoredMediaUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return trimmed;
  if (trimmed.startsWith('/uploads/')) return trimmed;
  try {
    const parsed = new URL(trimmed);
    if (parsed.pathname.startsWith('/uploads/')) {
      return `${parsed.pathname}${parsed.search}`;
    }
  } catch {
    // not an absolute URL
  }
  return trimmed;
}

function mediaUrlFromElement(element: HTMLElement): string | null {
  const dataUrl = element.getAttribute('data-url');
  if (dataUrl?.trim()) return normalizeStoredMediaUrl(dataUrl);
  const src = element.getAttribute('src');
  if (src?.trim()) return normalizeStoredMediaUrl(src);
  const img = element.querySelector('img');
  if (img?.getAttribute('src')?.trim()) {
    return normalizeStoredMediaUrl(img.getAttribute('src')!);
  }
  return null;
}

const PRESERVED_BLOCK_TYPES = new Set(['math', 'code', 'diagram', 'divider']);

/** Valid CSS width for a media block: plain number + %, px, rem or em. */
export const RICH_MEDIA_WIDTH_RE = /^\d+(\.\d+)?(%|px|rem|em)$/i;

/** Validate a stored/authored media width; anything else is dropped. */
export function normalizeRichMediaWidth(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const width = value.trim();
  return RICH_MEDIA_WIDTH_RE.test(width) ? width : undefined;
}

/**
 * Remove the legacy `width` copy from an encoded data-block-json attribute.
 * Width is a first-class `data-width` attribute now; a stale copy inside the
 * JSON would resurrect a cleared width on round-trip (the same trap `align`
 * has). Returns the input unchanged when there is nothing to strip.
 */
export function stripWidthFromEncodedBlockJson(value: unknown): string | null {
  if (typeof value !== 'string' || !value) return null;
  try {
    const parsed = JSON.parse(decodeURIComponent(value)) as unknown;
    if (!parsed || typeof parsed !== 'object' || !('width' in parsed)) return value;
    const rest = { ...(parsed as Record<string, unknown>) };
    delete rest.width;
    return encodeURIComponent(JSON.stringify(rest));
  } catch {
    return value;
  }
}

function encodePreservedBlock(block: RichContentBlock): string {
  return encodeURIComponent(JSON.stringify(block));
}

function decodePreservedBlock(value: string | null, expectedType?: string): RichContentBlock | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(decodeURIComponent(value)) as unknown;
    if (!parsed || typeof parsed !== 'object') return null;
    const block = parsed as RichContentBlock;
    if (typeof block.type !== 'string') return null;
    if (expectedType ? block.type !== expectedType : !PRESERVED_BLOCK_TYPES.has(block.type)) return null;
    return block;
  } catch {
    return null;
  }
}

function isMediaElement(element: HTMLElement): boolean {
  const tag = element.tagName.toLowerCase();
  const richBlock = element.getAttribute('data-rich-block');
  if (richBlock === 'image' || richBlock === 'audio' || richBlock === 'video') return true;
  if (tag === 'img' || tag === 'audio' || tag === 'video') return true;
  if (tag === 'figure' && element.querySelector('img')) return true;
  return false;
}

export type RichTextAlign = 'left' | 'center' | 'right' | 'justify';

function parseTextAlign(element: HTMLElement): RichTextAlign | undefined {
  const raw = element.style.textAlign || element.getAttribute('data-text-align') || '';
  const align = raw.trim().toLowerCase();
  if (align === 'center' || align === 'right' || align === 'justify') return align;
  return undefined;
}

function textAlignAttr(align?: RichTextAlign): string {
  if (!align || align === 'left') return '';
  return ` style="text-align: ${align}"`;
}

function elementToMediaBlock(element: HTMLElement): RichContentBlock | null {
  const richBlock = element.getAttribute('data-rich-block');
  const tag = element.tagName.toLowerCase();

  if (richBlock === 'image' || tag === 'img' || (tag === 'figure' && element.querySelector('img'))) {
    const url = mediaUrlFromElement(element);
    if (!url) return null;
    const alt =
      element.getAttribute('data-alt') ??
      element.getAttribute('alt') ??
      element.querySelector('img')?.getAttribute('alt') ??
      undefined;
    const align = parseTextAlign(element);
    const img = element instanceof HTMLImageElement ? element : element.querySelector('img');
    // First-class width: data-width attr, falling back to the img inline style.
    // Spread AFTER `preserved` so it wins; `preserved.width` stays as the
    // legacy fallback for old HTML that only carried width inside the JSON.
    const width = normalizeRichMediaWidth(element.getAttribute('data-width') ?? img?.style.width);
    const preserved = decodePreservedBlock(element.getAttribute('data-block-json'), 'image');
    return {
      ...(preserved ?? { type: 'image' }),
      type: 'image',
      url,
      alt: alt || preserved?.alt || undefined,
      ...(align ? { align } : {}),
      ...(width ? { width } : {}),
    };
  }
  if (richBlock === 'audio' || tag === 'audio') {
    const url = mediaUrlFromElement(element);
    if (!url) return null;
    const align = parseTextAlign(element);
    const preserved = decodePreservedBlock(element.getAttribute('data-block-json'), 'audio');
    return { ...(preserved ?? { type: 'audio' }), type: 'audio', url, ...(align ? { align } : {}) };
  }
  if (richBlock === 'video' || tag === 'video') {
    const url = mediaUrlFromElement(element);
    if (!url) return null;
    const align = parseTextAlign(element);
    const preserved = decodePreservedBlock(element.getAttribute('data-block-json'), 'video');
    return { ...(preserved ?? { type: 'video' }), type: 'video', url, ...(align ? { align } : {}) };
  }
  return null;
}

function elementToTextBlock(element: HTMLElement): RichContentBlock | null {
  const tag = element.tagName.toLowerCase();
  if (tag === 'p') {
    const mediaOnly = element.querySelector(
      ':scope > figure[data-rich-block="image"], :scope > img[src], :scope > audio, :scope > video',
    );
    if (mediaOnly && element.textContent?.replace(/\s/g, '') === '') {
      return elementToMediaBlock(mediaOnly as HTMLElement);
    }
    const align = parseTextAlign(element);
    // Keep paragraphs verbatim, including leading/trailing spaces and blank lines
    // (empty <p> → empty runs). Book scans use intentional indentation and spacing
    // that QA must reproduce; the renderer already draws paragraphs pre-wrap.
    return { type: 'paragraph', content: htmlToRichTextRuns(element.innerHTML), ...(align ? { align } : {}) };
  }
  if (/^h[1-6]$/.test(tag)) {
    const text = element.innerHTML.trim();
    if (!text) return null;
    const align = parseTextAlign(element);
    return { type: 'heading', content: htmlToRichTextRuns(text), level: Number(tag[1]), ...(align ? { align } : {}) };
  }
  if (tag === 'ul' || tag === 'ol') {
    // #503: keep each item's inline marks by parsing its HTML into runs.
    // `items` (plain text) stays as the legacy fallback, aligned 1:1 with runs.
    const entries = Array.from(element.querySelectorAll(':scope > li'))
      .map((li) => htmlToRichTextRuns(li.innerHTML))
      .map((runs) => ({ runs, text: runs.map((run) => run.text).join('') }))
      .filter((entry) => entry.text.trim() !== '');
    return entries.length
      ? {
          type: 'list',
          ordered: tag === 'ol',
          items: entries.map((entry) => entry.text),
          itemsRuns: entries.map((entry) => entry.runs),
        }
      : null;
  }
  if (tag === 'blockquote') {
    const text = element.innerHTML.trim();
    const author = element.getAttribute('data-quote-author')?.trim() || undefined;
    const align = parseTextAlign(element);
    return text ? {
      type: 'quote',
      content: htmlToRichTextRuns(text),
      ...(author ? { author } : {}),
      ...(align ? { align } : {}),
    } : null;
  }
  const fallback = element.textContent?.trim() ?? '';
  return fallback ? { type: 'paragraph', content: htmlToRichTextRuns(fallback) } : null;
}

function collectBlocksFromNode(node: Node, blocks: RichContentBlock[]): void {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.textContent?.trim();
    if (text) blocks.push({ type: 'paragraph', content: htmlToRichTextRuns(text) });
    return;
  }
  if (!(node instanceof HTMLElement)) return;

  if (node.getAttribute('data-rich-block') === 'layout') {
    const layout = normalizeContentLayout(node.getAttribute('data-content-layout'));
    const columns: RichContentBlock[][] = [];
    const columnEls = node.querySelectorAll(':scope > [data-rich-column]');
    if (columnEls.length > 0) {
      columnEls.forEach((colEl) => {
        const colBlocks: RichContentBlock[] = [];
        for (const child of Array.from(colEl.childNodes)) {
          collectBlocksFromNode(child, colBlocks);
        }
        columns.push(colBlocks);
      });
    } else {
      const colBlocks: RichContentBlock[] = [];
      for (const child of Array.from(node.childNodes)) {
        collectBlocksFromNode(child, colBlocks);
      }
      columns.push(colBlocks);
    }
    blocks.push({ type: 'layout', layout, columns });
    return;
  }

  if (node.getAttribute('data-rich-block') === 'preserved') {
    const preserved = decodePreservedBlock(node.getAttribute('data-block-json'));
    if (preserved) blocks.push(preserved);
    return;
  }

  if (isMediaElement(node)) {
    const media = elementToMediaBlock(node);
    if (media) blocks.push(media);
    return;
  }

  const tag = node.tagName.toLowerCase();
  if (tag === 'div' || tag === 'article' || tag === 'section') {
    for (const child of Array.from(node.childNodes)) {
      collectBlocksFromNode(child, blocks);
    }
    return;
  }

  const textBlock = elementToTextBlock(node);
  if (textBlock) blocks.push(textBlock);
}

export function htmlToRichContent(html: string): RichContent {
  const trimmed = html.trim();
  if (!trimmed) return { blocks: [] };

  const doc = new DOMParser().parseFromString(trimmed, 'text/html');
  const blocks: RichContentBlock[] = [];

  for (const node of Array.from(doc.body.childNodes)) {
    collectBlocksFromNode(node, blocks);
  }

  if (!blocks.length) {
    const text = plainTextFromHtml(trimmed);
    if (text) blocks.push({ type: 'paragraph', content: htmlToRichTextRuns(text) });
  }

  return { blocks };
}

/** Resolve `/uploads/...` img src in inline HTML paragraphs for display. */
export function resolveMediaUrlsInHtml(html: string): string {
  if (!html.includes('<img')) return html;
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html');
  const root = doc.body.firstElementChild;
  if (!root) return html;
  root.querySelectorAll('img[src]').forEach((img) => {
    const src = img.getAttribute('src');
    if (!src) return;
    const resolved = getUploadFileUrl(normalizeStoredMediaUrl(src)) ?? src;
    img.setAttribute('src', resolved);
  });
  return root.innerHTML;
}

export function richContentToHtml(content?: RichContent | null): string {
  if (!content?.blocks?.length) return '<p></p>';

  const parts = content.blocks.map((block) => {
    switch (block.type) {
      case 'heading': {
        const level = block.level ?? 2;
        return `<h${level}${textAlignAttr(block.align)}>${blockTextHtml(block)}</h${level}>`;
      }
      case 'quote':
        return `<blockquote${block.author ? ` data-quote-author="${escapeHtml(block.author)}"` : ''}${textAlignAttr(block.align)}><p>${blockTextHtml(block)}</p></blockquote>`;
      case 'list': {
        const tag = block.ordered ? 'ol' : 'ul';
        // #503: emit inline marks from canonical `itemsRuns` when present;
        // otherwise escape legacy plain-text `items` (they carry no markup).
        const items = block.itemsRuns
          ? block.itemsRuns.map((runs) => `<li>${richTextRunsToHtml(runs)}</li>`).join('')
          : (block.items ?? []).map((item) => `<li>${escapeHtml(item)}</li>`).join('');
        return `<${tag}>${items}</${tag}>`;
      }
      case 'image': {
        if (!block.url) return '';
        const stored = normalizeStoredMediaUrl(block.url);
        const display = getUploadFileUrl(stored) ?? stored;
        const width = normalizeRichMediaWidth(block.width);
        // Width lives in data-width + the img style, and is STRIPPED from the
        // JSON copy: a stale width inside data-block-json would resurrect a
        // cleared width on round-trip (the trap align already has).
        const jsonBlock = { ...block, url: stored };
        delete jsonBlock.width;
        const widthAttr = width ? ` data-width="${escapeHtml(width)}"` : '';
        const widthStyle = width ? ` style="width: ${escapeHtml(width)}"` : '';
        return `<figure data-rich-block="image" data-url="${escapeHtml(stored)}" data-alt="${escapeHtml(block.alt ?? block.altText ?? '')}"${widthAttr} data-block-json="${escapeHtml(encodePreservedBlock(jsonBlock))}"${textAlignAttr(block.align)}><img src="${escapeHtml(display)}" alt="${escapeHtml(block.alt ?? block.altText ?? '')}"${widthStyle} /></figure>`;
      }
      // Same src rule as `image`: data-url keeps the stored path, the element
      // gets the resolved one. Emitting the raw stored path here made every
      // host-relative "/storage/…" clip fail to load (MEDIA_ELEMENT_ERROR).
      case 'audio': {
        if (!block.url) return '';
        const stored = normalizeStoredMediaUrl(block.url);
        const display = getUploadFileUrl(stored) ?? stored;
        return `<audio data-rich-block="audio" data-url="${escapeHtml(stored)}" data-block-json="${escapeHtml(encodePreservedBlock({ ...block, url: stored }))}" controls preload="metadata" src="${escapeHtml(display)}"${textAlignAttr(block.align)}></audio>`;
      }
      case 'video': {
        if (!block.url) return '';
        const stored = normalizeStoredMediaUrl(block.url);
        const display = getUploadFileUrl(stored) ?? stored;
        return `<video data-rich-block="video" data-url="${escapeHtml(stored)}" data-block-json="${escapeHtml(encodePreservedBlock({ ...block, url: stored }))}" controls preload="metadata" src="${escapeHtml(display)}"${textAlignAttr(block.align)}></video>`;
      }
      case 'math':
      case 'code':
      case 'diagram':
      case 'divider':
        return `<div data-rich-block="preserved" data-block-type="${escapeHtml(block.type)}" data-block-json="${escapeHtml(encodePreservedBlock(block))}"></div>`;
      case 'layout': {
        const variant = normalizeContentLayout(block.layout) as ContentLayout;
        const columns = block.columns ?? [];
        const colsHtml = columns
          .map(
            (col, index) =>
              `<div data-rich-column="${index}" class="ev-rich-column">${richContentToHtml({ blocks: col })}</div>`,
          )
          .join('');
        return `<div data-rich-block="layout" data-content-layout="${escapeHtml(variant)}" class="ev-rich-layout ev-rich-layout--${escapeHtml(variant)}">${colsHtml}</div>`;
      }
      case 'paragraph':
      default: {
        const align = textAlignAttr(block.align);
        return `<p${align}>${blockTextHtml(block)}</p>`;
      }
    }
  });

  return parts.join('') || '<p></p>';
}

export function richContentFromQuestionLike(input: {
  question_text?: string;
  payload?: Record<string, unknown> | null;
}): RichContent {
  const payload = input.payload;
  if (payload && typeof payload.content === 'object' && payload.content !== null) {
    const content = payload.content as RichContent;
    if (Array.isArray(content.blocks) && content.blocks.length > 0) {
      return content;
    }
  }
  return htmlToRichContent(textToHtml(input.question_text ?? ''));
}
