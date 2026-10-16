import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { EssayPlayer } from './EssayPlayer';
import { renderInteractionPlayer } from './dispatch';

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

function renderPlayer(prompts: string[]) {
  act(() => {
    root.render(
      <EssayPlayer
        title="Câu hỏi tự luận"
        prompts={prompts}
        onAnswerChange={() => undefined}
      />,
    );
  });
}

describe('EssayPlayer rich-text prompts', () => {
  it('renders prompt formatting instead of exposing the serialized HTML', () => {
    renderPlayer(['<strong>Đậm</strong> và <em>nghiêng</em>']);

    const prompt = container.querySelector('p');
    expect(prompt?.textContent).toBe('Đậm và nghiêng');
    expect(prompt?.querySelector('strong')?.textContent).toBe('Đậm');
    expect(prompt?.querySelector('em')?.textContent).toBe('nghiêng');
    expect(prompt?.textContent).not.toContain('<strong>');
  });

  it('renders prompts verbatim — never prepends its own a./b. label', () => {
    renderPlayer(['1/ Theo em, giữa các bạn có sự khác biệt như thế nào?', '2/ Điều gì sẽ xảy ra?']);

    const prompts = Array.from(container.querySelectorAll('p'))
      .map((p) => p.textContent)
      .filter((t) => t?.includes('/'));
    expect(prompts).toEqual([
      '1/ Theo em, giữa các bạn có sự khác biệt như thế nào?',
      '2/ Điều gì sẽ xảy ra?',
    ]);
  });

  it('does not duplicate a label the prompt already carries', () => {
    renderPlayer(['<strong>a.</strong> Nêu ý kiến của em.']);

    const prompt = container.querySelector('p');
    expect(prompt?.textContent).toBe('a. Nêu ý kiến của em.');
    expect(prompt?.textContent).not.toContain('a. a.');
  });
});

describe('EssayPlayer chiều cao ô viết lúc mở', () => {
  it('một đề: 4 dòng, không chiếm hết màn (vẫn kéo giãn được)', () => {
    act(() => {
      root.render(
        <EssayPlayer
          title="Câu hỏi tự luận"
          richContent={{
            blocks: [{ type: 'paragraph', text: 'Viết 1 câu về mùa em yêu thích.' }],
          }}
          onAnswerChange={() => undefined}
        />,
      );
    });

    const textarea = container.querySelector('textarea');
    expect(textarea?.rows).toBe(4);
    // Tay kéo bị bỏ: ô đã tự cao đúng bằng nội dung nên kéo tay chỉ sống đến
    // lần gõ kế tiếp (WEB20/WEB25).
    expect(textarea?.className).toContain('resize-none');
  });

  it('nhiều đề: mỗi ô 2 dòng cho gọn cụm', () => {
    renderPlayer(['a. Em thích mùa nào?', 'b. Vì sao?']);

    const rows = Array.from(container.querySelectorAll('textarea')).map((t) => t.rows);
    expect(rows).toEqual([2, 2]);
  });

  // WEB20/WEB25: `rows` chỉ đặt cỡ LÚC TRỐNG — trước đây gõ quá số dòng đó thì
  // chữ cuộn trong một hộp cố định. Guard này ghim CƠ CHẾ tự giãn ở CẢ HAI
  // đường (một đề và nhiều đề — đường sub question), vì quay về `<textarea>`
  // trơn vẫn xanh tsc và xanh mọi test còn lại.
  it('mọi ô viết đều tự giãn theo nội dung, kể cả trong sub question', () => {
    act(() => {
      root.render(<EssayPlayer title="Câu hỏi tự luận" onAnswerChange={() => undefined} />);
    });
    // jsdom không layout nên `scrollHeight` là 0 — kiểm đúng cơ chế: chiều cao
    // do JS đặt (kẹp theo sàn `rows`) và lớp `h-auto` đè `h-full`.
    const single = container.querySelector<HTMLTextAreaElement>('textarea')!;
    expect(single.className).toContain('h-auto');
    expect(single.style.height).not.toBe('');

    renderPlayer(['a. Em thích mùa nào?', 'b. Vì sao?']);
    const multi = Array.from(container.querySelectorAll<HTMLTextAreaElement>('textarea'));
    expect(multi).toHaveLength(2);
    for (const box of multi) {
      expect(box.className).toContain('h-auto');
      expect(box.style.height).not.toBe('');
    }
  });
});

describe('EssayPlayer chữ mờ trong ô viết', () => {
  it('không khai placeholder → giữ chữ mặc định của player', () => {
    act(() => {
      root.render(<EssayPlayer title="Câu hỏi tự luận" onAnswerChange={() => undefined} />);
    });
    expect(container.querySelector('textarea')?.placeholder).toBe('Viết bài của em ở đây...');

    renderPlayer(['a. Em thích mùa nào?', 'b. Vì sao?']);
    const defaults = Array.from(container.querySelectorAll('textarea')).map((t) => t.placeholder);
    expect(defaults).toEqual(['Viết câu trả lời của em...', 'Viết câu trả lời của em...']);
  });

  it('content khai placeholder → ô đơn và mọi ô của câu nhiều ý đều đổi theo', () => {
    act(() => {
      root.render(
        <EssayPlayer
          title="Câu hỏi tự luận"
          placeholder="Viết bài giải của em vào đây"
          onAnswerChange={() => undefined}
        />,
      );
    });
    expect(container.querySelector('textarea')?.placeholder).toBe('Viết bài giải của em vào đây');

    act(() => {
      root.render(
        <EssayPlayer
          title="Câu hỏi tự luận"
          prompts={['a. Em thích mùa nào?', 'b. Vì sao?']}
          placeholder="…"
          onAnswerChange={() => undefined}
        />,
      );
    });
    const authored = Array.from(container.querySelectorAll('textarea')).map((t) => t.placeholder);
    expect(authored).toEqual(['…', '…']);
  });

  // Đường payload → player: `placeholder` mất ở dispatch thì mọi ca trên vẫn
  // xanh mà content khai xong không thấy gì đổi.
  it('dispatch chuyển `placeholder` từ payload xuống player', () => {
    act(() => {
      root.render(
        renderInteractionPlayer('essay', { placeholder: 'Viết bài giải của em vào đây' }, {}),
      );
    });
    expect(container.querySelector('textarea')?.placeholder).toBe('Viết bài giải của em vào đây');
  });

  it('placeholder toàn khoảng trắng vẫn rơi về chữ mặc định', () => {
    act(() => {
      root.render(
        <EssayPlayer title="Câu hỏi tự luận" placeholder="   " onAnswerChange={() => undefined} />,
      );
    });
    expect(container.querySelector('textarea')?.placeholder).toBe('Viết bài của em ở đây...');
  });
});

describe('EssayPlayer readOnly mode', () => {
  it('renders the prompt with no textarea and no submit button', () => {
    act(() => {
      root.render(
        <EssayPlayer
          title="Câu hỏi tự luận"
          richContent={{
            blocks: [{ type: 'paragraph', text: 'Viết một đoạn văn ngắn kể về gia đình em.' }],
          }}
          readOnly
          onAnswerChange={() => undefined}
        />,
      );
    });

    expect(container.textContent).toContain('Viết một đoạn văn ngắn kể về gia đình em.');
    expect(container.querySelectorAll('textarea').length).toBe(0);
    expect(container.querySelector('button')).toBeNull();
    expect(container.textContent).not.toContain('Lưu câu trả lời');
    expect(container.textContent).not.toContain('Đã ghi nhận, chờ chấm');
  });
});

// Owner 8/8 (bai9 câu 5 Mĩ thuật 3, 5 ô tranh): câu TOÀN ô tranh xếp lưới 2
// cột + ảnh cạnh chỗ viết + hạ trần ảnh từ 3 ô; câu có ô chữ giữ xếp dọc.
describe('EssayPlayer ô tranh xếp lưới', () => {
  const pics = (n: number) =>
    Array.from({ length: n }, (_, i) => ({ url: `/b${i}.png`, label: `(${i + 1})` }));

  it('mọi ô có tranh → lưới 2 cột, trong ô thì ảnh trên - chỗ viết dưới', () => {
    act(() => {
      root.render(<EssayPlayer title="Q" imagePrompts={pics(5)} onAnswerChange={() => undefined} />);
    });
    const grid = container.querySelector('div.grid')!;
    // 5 ô → 3 cột để chỉ còn 2 hàng (3 hàng là tràn khỏi vùng làm bài).
    expect(grid.className).toContain('sm:grid-cols-3');
    expect(grid.children).toHaveLength(5);
    // Trong mỗi ô: ảnh xếp TRÊN chỗ viết (không đặt cạnh nhau).
    const slot = grid.firstElementChild!;
    expect(slot.className).not.toContain('flex-row');
    const img = slot.querySelector('img')!;
    const ta = slot.querySelector('textarea')!;
    expect(img.compareDocumentPosition(ta) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('từ 3 ô trở lên thì ảnh hạ trần 14rem, dưới 3 ô giữ trần mặc định', () => {
    act(() => {
      root.render(<EssayPlayer title="Q" imagePrompts={pics(3)} onAnswerChange={() => undefined} />);
    });
    expect(container.querySelector('img')!.style.maxHeight).toBe('14rem');

    act(() => {
      root.render(<EssayPlayer title="Q" imagePrompts={pics(2)} onAnswerChange={() => undefined} />);
    });
    expect(container.querySelector('img')!.style.maxHeight).not.toBe('14rem');
  });

  it.each([
    [2, 'sm:grid-cols-2'],
    [4, 'sm:grid-cols-2'],
    [5, 'sm:grid-cols-3'],
    [6, 'sm:grid-cols-3'],
    [8, 'sm:grid-cols-4'],
  ])('%i ô tranh → chia cột sao cho tối đa 2 hàng', (n, cls) => {
    act(() => {
      root.render(<EssayPlayer title="Q" imagePrompts={pics(n)} onAnswerChange={() => undefined} />);
    });
    expect(container.querySelector('div.grid')!.className).toContain(cls);
  });

  it('có ô CHỮ thuần thì giữ xếp dọc như cũ', () => {
    act(() => {
      root.render(
        <EssayPlayer
          title="Q"
          prompts={['a. Em thấy gì?', 'b. Vì sao?']}
          onAnswerChange={() => undefined}
        />,
      );
    });
    expect(container.querySelector('div.grid')).toBeNull();
    expect(container.querySelector('div.space-y-5')).not.toBeNull();
  });
});
