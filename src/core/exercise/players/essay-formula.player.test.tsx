import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EssayPlayer } from './EssayPlayer';
import { MATH_FIELD_AS_INPUT } from './math-field-chrome';

/**
 * MathLive không dựng trong jsdom, nên `<math-field>` ở đây là phần tử trơ.
 * `MathField` đọc `element.value` khi có `input`, nên đặt thuộc tính rồi bắn sự
 * kiện là đi đúng đường mà một lần gõ thật đi qua. Việc Enter xuống dòng và bàn
 * phím công thức chỉ kiểm được trên trình duyệt.
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

const fields = () => Array.from(container.querySelectorAll('math-field'));
const textareas = () => Array.from(container.querySelectorAll('textarea'));

function typeInto(index: number, latex: string) {
  const field = fields()[index] as HTMLElement & { value?: string };
  field.value = latex;
  act(() => {
    field.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

describe('EssayPlayer — viết bài giải có công thức', () => {
  it('không bật cờ thì vẫn là ô văn bản thường', () => {
    act(() => root.render(<EssayPlayer title="Q" />));
    expect(textareas()).toHaveLength(1);
    expect(fields()).toHaveLength(0);
  });

  it('bật cờ thì thay bằng MỘT trường soạn, không còn ô văn bản', () => {
    // Trước đây là hai ô cạnh nhau (ô công thức + ô văn xuôi) — đó là cái phải bỏ.
    act(() => root.render(<EssayPlayer title="Q" allowFormula />));
    expect(fields()).toHaveLength(1);
    expect(textareas()).toHaveLength(0);
  });

  it('nhiều ý thì mỗi ý một trường, không có ô văn bản nào', () => {
    act(() => root.render(<EssayPlayer title="Q" allowFormula prompts={['Ý một', 'Ý hai']} />));
    expect(fields()).toHaveLength(2);
    expect(textareas()).toHaveLength(0);
  });

  it('bài làm vẫn là chuỗi, và dấu cách MathLive chèn trong $ được chuẩn hoá', () => {
    const onAnswerChange = vi.fn();
    act(() => root.render(<EssayPlayer title="Q" allowFormula onAnswerChange={onAnswerChange} />));
    typeInto(0, 'Giá là $ 54- $ đồng');
    expect(onAnswerChange).toHaveBeenLastCalledWith('Giá là $54-$ đồng');
  });

  it('chèn vào đúng ý ở chế độ nhiều ý', () => {
    const onAnswerChange = vi.fn();
    act(() =>
      root.render(
        <EssayPlayer title="Q" allowFormula prompts={['Ý một', 'Ý hai']} onAnswerChange={onAnswerChange} />,
      ),
    );
    typeInto(1, '\\text{Đáp số}');
    expect(onAnswerChange).toHaveBeenLastCalledWith(['', '\\text{Đáp số}']);
  });

  // Việc đếm từ theo văn bản đã hạ được chốt ở tầng đơn vị
  // (`essay-formula.test.ts` → essayAnswerToPlainText). Ở đây không khẳng định
  // được: `<math-field>` không sinh text trong jsdom nên bộ đếm không đọc ra được.

  it('ô công thức mang ĐÚNG lớp của ô tự luận thường, không phải ô nhập một dòng', () => {
    // Lỗi đã báo hai lần: ô co lại bằng một ô nhập ngắn, "kích thước giống như
    // editor không có công thức". Nguyên nhân là ô công thức tự chọn lớp riêng
    // thay vì dùng chung `textareaClass`. Khoá lại bằng cách so hai nhánh.
    act(() => root.render(<EssayPlayer title="Q" />));
    // `h-auto` là của riêng AutoGrowTextarea (cơ chế tự cao theo nội dung), không
    // thuộc phần style dùng chung — ô công thức tự cao bằng cách khác.
    const lopDungChung = textareas()[0].className.replace(' h-auto', '');

    act(() => root.render(<EssayPlayer title="Q" allowFormula />));
    // Cộng thêm lớp ẩn menu `≡` của MathLive — menu đó có cả "Solve" (giải hộ
    // biểu thức) nên không được để học sinh chạm tới.
    expect(fields()[0].className).toBe(`${MATH_FIELD_AS_INPUT} ${lopDungChung}`);
  });

  it('ô công thức cao bằng nhiều dòng, không co theo nội dung', () => {
    // `math-field` là inline-block nên nếu không đặt gì, ô rộng 240px trong khung
    // 333px và cao đúng một dòng — đo được trên dev.
    act(() => root.render(<EssayPlayer title="Q" allowFormula />));
    const style = (fields()[0] as HTMLElement).style;
    expect(style.display).toBe('block');
    expect(style.width).toBe('100%');
    expect(style.minHeight).toContain('4');
  });

  it('bài đã nộp thì trường bị khoá', () => {
    act(() => root.render(<EssayPlayer title="Q" allowFormula submitted />));
    expect(fields()[0].hasAttribute('read-only')).toBe(true);
  });
});
