import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { EssayPlayer, essaySlots, type EssayImagePrompt } from './EssayPlayer';
import { renderInteractionPlayer } from './dispatch';

/**
 * `imagePrompts` carries the workbook frames a "Quan sát tranh / các tranh dưới
 * đây" essay asks about. Before this, nothing on the player path read the field
 * (only the editor did), so every such question rendered as a bare textarea and
 * QA rejected it "Không có ảnh" — the pictures were in the payload and served
 * fine, just never drawn.
 */
let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const PROMPTS: EssayImagePrompt[] = [
  { url: 'https://api.evovi.vn/uploads/books/b/assets/bai16_q2_tranh1.png', alt: 'Tranh 1: bố đưa lì xì', label: 'Tranh 1' },
  { url: 'https://api.evovi.vn/uploads/books/b/assets/bai16_q2_tranh2.png', alt: 'Tranh 2: mẹ tặng áo', label: 'Tranh 2' },
];

function render(props: Partial<React.ComponentProps<typeof EssayPlayer>>) {
  act(() => {
    root.render(
      <EssayPlayer title="Viết những lời em sẽ nói" onAnswerChange={() => undefined} {...props} />,
    );
  });
}

describe('EssayPlayer imagePrompts', () => {
  it('renders one picture + its label per prompt, with a textarea each', () => {
    render({ imagePrompts: PROMPTS });

    const imgs = Array.from(container.querySelectorAll('img'));
    expect(imgs.map((i) => i.getAttribute('src'))).toEqual(PROMPTS.map((p) => p.url));
    expect(imgs.map((i) => i.getAttribute('alt'))).toEqual(['Tranh 1: bố đưa lì xì', 'Tranh 2: mẹ tặng áo']);
    expect(container.textContent).toContain('Tranh 1');
    expect(container.textContent).toContain('Tranh 2');
    // Label-only pictures still drive multi-prompt mode: one answer slot each.
    expect(container.querySelectorAll('textarea')).toHaveLength(2);
  });

  it('reports the answer as one entry per picture', () => {
    let answer: unknown;
    render({ imagePrompts: PROMPTS, onAnswerChange: (a) => { answer = a; } });

    const areas = container.querySelectorAll('textarea');
    act(() => {
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!;
      setter.call(areas[1], 'Con cảm ơn mẹ');
      areas[1].dispatchEvent(new Event('input', { bubbles: true }));
    });

    expect(answer).toEqual(['', 'Con cảm ơn mẹ']);
  });

  it('still shows the pictures in display-only (readOnly) mode, without inputs', () => {
    render({ imagePrompts: PROMPTS, readOnly: true });

    expect(container.querySelectorAll('img')).toHaveLength(2);
    expect(container.querySelectorAll('textarea')).toHaveLength(0);
  });

  it('leaves a question with neither prompts nor pictures in single-textarea mode', () => {
    render({});

    expect(container.querySelectorAll('img')).toHaveLength(0);
    expect(container.querySelectorAll('textarea')).toHaveLength(1);
  });
});

describe('essay dispatch', () => {
  // `resolveAssetUrl` chỉ ghép base khi có cấu hình API base — máy dev có
  // .env.local nên xanh, checkout sạch/CI thì base rỗng, src giữ nguyên
  // "/uploads/..." và assertion "không được là đường dẫn trần" đỏ vĩnh viễn.
  // Pin base ngay trong test (runtime config thắng mọi nguồn khác) để ca này
  // kiểm ĐÚNG điều nó muốn kiểm — dispatch có rebase ảnh sang origin API —
  // ở mọi môi trường.
  const API_ORIGIN = 'http://api.test';
  let savedConfig: unknown;
  beforeEach(() => {
    savedConfig = (window as { __APP_CONFIG__?: unknown }).__APP_CONFIG__;
    (window as { __APP_CONFIG__?: unknown }).__APP_CONFIG__ = {
      CATALOG_API_BASE_URL: API_ORIGIN,
    };
  });
  afterEach(() => {
    (window as { __APP_CONFIG__?: unknown }).__APP_CONFIG__ = savedConfig;
  });

  // Shape taken verbatim from prod b16_q2 (VBT Hoạt động trải nghiệm 1): stored
  // urls are bare `/uploads/...` paths, and web/API are separate domains in
  // prod, so dispatch must resolve them to the API origin before the <img>.
  const PAYLOAD = {
    id: 'b16_q2',
    type: 'essay',
    manualGrading: true,
    content: {
      blocks: [
        {
          type: 'paragraph',
          content: [{ text: 'Viết những lời em sẽ nói khi em được nhận quà trong các tranh dưới đây:' }],
        },
      ],
    },
    imagePrompts: [
      { url: '/uploads/books/6a60377f27dd0c46380749cd/assets/bai16_q2_tranh1.png', alt: 'Tranh 1', label: 'Tranh 1' },
      { url: '/uploads/books/6a60377f27dd0c46380749cd/assets/bai16_q2_tranh2.png', alt: 'Tranh 2', label: 'Tranh 2' },
    ],
  };

  it('renders the picture prompts of a real essay payload, with resolved urls', () => {
    act(() => {
      root.render(renderInteractionPlayer('essay', PAYLOAD as never, {} as never));
    });

    const srcs = Array.from(container.querySelectorAll('img')).map((i) => i.getAttribute('src') ?? '');
    expect(srcs).toHaveLength(2);
    expect(srcs.every((s) => s.endsWith('/uploads/books/6a60377f27dd0c46380749cd/assets/bai16_q2_tranh1.png') || s.endsWith('_tranh2.png'))).toBe(true);
    // Never a bare same-origin path: that 404s to index.html in prod.
    expect(srcs.every((s) => s.startsWith(`${API_ORIGIN}/uploads/`))).toBe(true);
    expect(container.textContent).toContain('các tranh dưới đây');
  });
});

describe('essaySlots', () => {
  it('zips text prompts with pictures by index', () => {
    expect(essaySlots(['a', 'b'], PROMPTS)).toEqual([
      { text: 'a', image: PROMPTS[0] },
      { text: 'b', image: PROMPTS[1] },
    ]);
  });

  it('falls back to the picture label when there is no text prompt', () => {
    expect(essaySlots(undefined, PROMPTS).map((s) => s.text)).toEqual(['Tranh 1', 'Tranh 2']);
  });

  it('keeps the longer list when the two disagree, and drops url-less entries', () => {
    const slots = essaySlots(['a', 'b', 'c'], [PROMPTS[0], { url: '' } as EssayImagePrompt]);
    expect(slots).toHaveLength(3);
    expect(slots[1].image).toBeUndefined();
    expect(slots[2]).toEqual({ text: 'c', image: undefined });
  });
});
