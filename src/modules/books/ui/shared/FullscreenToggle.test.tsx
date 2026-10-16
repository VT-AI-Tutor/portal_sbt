/**
 * @vitest-environment jsdom
 */
/**
 * Nút toàn màn hình dùng chung cho mọi viewer của bài học.
 *
 * Trước bản này chỉ PDF có nút, và nó nằm lọt trong một overlay riêng render LẠI
 * trình xem PDF. Cách đó không dùng được cho màn làm bài: overlay sẽ mount một
 * runner thứ hai và bài đang làm mất `attemptId` cùng đáp án. Nên cơ chế mới đổi
 * class trên chính thẻ đang có, và nút này là lối vào duy nhất — hai biến thể chỉ
 * khác chỗ đặt.
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FullscreenToggle } from './FullscreenToggle';

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

const btn = () => container.querySelector('button')!;

describe('FullscreenToggle', () => {
  it('chưa bật thì mời PHÓNG TO', () => {
    act(() => root.render(<FullscreenToggle active={false} onToggle={() => {}} />));
    expect(btn().getAttribute('aria-label')).toBe('Toàn màn hình');
  });

  it('đang bật thì mời THOÁT — nút phải đổi nghĩa, không chỉ đổi icon', () => {
    act(() => root.render(<FullscreenToggle active onToggle={() => {}} />));
    expect(btn().getAttribute('aria-label')).toBe('Thoát toàn màn hình');
  });

  it('bấm thì gọi onToggle', () => {
    const onToggle = vi.fn();
    act(() => root.render(<FullscreenToggle active={false} onToggle={onToggle} />));
    act(() => btn().click());
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  /**
   * Bản đầu dùng nút NỔI `absolute top-2 right-2` cho màn làm bài, và nó **đè lên
   * nút "Thoát"** của runner — nút Thoát nằm trong thanh flex chứ không định vị
   * tuyệt đối, nên mọi vị trí "góc trên bên phải" đều va vào nó. Nay nút cắm THẲNG
   * vào thanh runner qua `headerAction`, nên KHÔNG biến thể nào được định vị tuyệt đối.
   */
  it('KHÔNG biến thể nào định vị tuyệt đối — đó là thứ từng đè lên nút Thoát', () => {
    for (const variant of ['toolbar', 'compact'] as const) {
      act(() => root.render(<FullscreenToggle active={false} onToggle={() => {}} variant={variant} />));
      expect(btn().className, variant).not.toContain('absolute');
      expect(btn().className, variant).not.toContain('fixed');
    }
  });

  it('biến thể compact không co giãn trong thanh runner', () => {
    act(() => root.render(<FullscreenToggle active={false} onToggle={() => {}} variant="compact" />));
    expect(btn().className).toContain('shrink-0');
    expect(btn().className).toContain('size-9');
  });

  it('giữ nút nổi trên lớp phủ fullscreen và nhận click', () => {
    for (const variant of ['toolbar', 'compact'] as const) {
      act(() => root.render(<FullscreenToggle active={false} onToggle={() => {}} variant={variant} />));
      expect(btn().className).toContain('relative');
      expect(btn().className).toContain('z-10');
      expect(btn().className).toContain('pointer-events-auto');
    }
  });

  /**
   * Owner 07/8: nút chỉ dùng icon. `aria-label` KHÔNG hiện trên màn nên vẫn giữ —
   * bỏ nó thì người dùng trình đọc màn hình mất hẳn nút này, mà icon thì họ không
   * "nghe" được.
   */
  it('CHỈ icon — không chữ nào hiện ra, nhưng vẫn có aria-label', () => {
    for (const variant of ['toolbar', 'compact'] as const) {
      for (const active of [false, true]) {
        act(() => root.render(<FullscreenToggle active={active} onToggle={() => {}} variant={variant} />));
        expect(btn().textContent, `${variant}/${active}`).toBe('');
        expect(btn().querySelector('svg'), `${variant}/${active}`).toBeTruthy();
        expect(btn().getAttribute('aria-label'), `${variant}/${active}`).toBe(
          active ? 'Thoát toàn màn hình' : 'Toàn màn hình',
        );
      }
    }
  });
});
