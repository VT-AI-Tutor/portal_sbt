/**
 * `useAvailableHeight` — đo CHỖ TRỐNG THẬT còn lại cho một khối trong vùng
 * cuộn của host, thay cho những con số `calc(100svh - Xrem)` đoán mò.
 *
 * jsdom không layout: mọi `getBoundingClientRect` / `clientHeight` đều là 0.
 * Nên các bài dưới đây DỰNG HÌNH HỌC GIẢ — vá rect và clientHeight theo một
 * kịch bản cụ thể — rồi kiểm ĐÚNG PHÉP TÍNH và ĐÚNG LỚP CUỘN được chọn. Đó là
 * hai thứ đã sai trong lúc làm và tốn nhiều vòng sửa nhất:
 *  1. bám nhầm lớp cuộn cao-theo-nội-dung (PlayerShell) → đo xong co nội dung
 *     thì lớp đó co theo, vòng sau đo nhỏ hơn, ảnh tụt tới sàn;
 *  2. quên trừ padding của vùng cuộn → nội dung nhỉnh hơn màn vài pixel.
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useRef } from "react";
import { useAvailableHeight, stickyPort } from "./shared";

let container: HTMLDivElement;
let root: Root;

/** ResizeObserver giả — jsdom không có; hook chỉ cần nó tồn tại để chạy. */
class NoopResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

beforeEach(() => {
  vi.stubGlobal("ResizeObserver", NoopResizeObserver);
  // Vòng tự hiệu chỉnh chạy bằng requestAnimationFrame — cho nó chạy ngay để
  // test không phải chờ khung hình thật.
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
    cb(0);
    return 0;
  });
  vi.stubGlobal("cancelAnimationFrame", () => {});
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

/** Gán hình học giả cho một phần tử (jsdom trả 0 cho mọi phép đo thật). */
function fakeBox(
  el: HTMLElement,
  box: { top: number; height: number },
  extra?: { clientHeight?: number; scrollHeight?: number },
) {
  el.getBoundingClientRect = () =>
    ({
      top: box.top,
      bottom: box.top + box.height,
      height: box.height,
      left: 0,
      right: 0,
      width: 0,
      x: 0,
      y: box.top,
      toJSON: () => ({}),
    }) as DOMRect;
  if (extra?.clientHeight !== undefined) {
    Object.defineProperty(el, "clientHeight", {
      configurable: true,
      value: extra.clientHeight,
    });
  }
  if (extra?.scrollHeight !== undefined) {
    Object.defineProperty(el, "scrollHeight", {
      configurable: true,
      value: extra.scrollHeight,
    });
  }
}

/**
 * Dựng đúng cây của runner thật:
 *
 *   port  (vùng cuộn của host — chiều cao BỊ CHẶN, có padding dưới)
 *     └── content  (khối nội dung, cao theo nội dung)
 *           ├── đề bài
 *           └── target  ← khối cần đo
 *           └── hàng nút
 *
 * `shellScroller` mô phỏng lớp `overflow-y-auto` của PlayerShell: cũng khai
 * cuộn nhưng chiều cao BẰNG nội dung, tức không chặn gì — hook phải BỎ QUA nó.
 */
function buildTree(opts: {
  portClientHeight: number;
  portPaddingBottom: number;
  contentTop: number;
  contentHeight: number;
  targetTop: number;
  targetHeight: number;
  withShellScroller: boolean;
}) {
  const port = document.createElement("div");
  port.style.overflowY = "auto";
  port.style.paddingBottom = `${opts.portPaddingBottom}px`;
  fakeBox(port, { top: opts.contentTop, height: opts.portClientHeight }, {
    clientHeight: opts.portClientHeight,
    scrollHeight: Math.max(opts.portClientHeight, opts.contentHeight),
  });

  const content = document.createElement("div");
  fakeBox(content, { top: opts.contentTop, height: opts.contentHeight });
  port.appendChild(content);

  let host: HTMLElement = content;
  if (opts.withShellScroller) {
    const shellScroller = document.createElement("div");
    shellScroller.style.overflowY = "auto";
    // Cao ĐÚNG BẰNG nội dung của nó → không chặn gì → phải bị bỏ qua.
    fakeBox(shellScroller, { top: opts.contentTop, height: opts.contentHeight }, {
      clientHeight: opts.contentHeight,
      scrollHeight: opts.contentHeight,
    });
    const inner = document.createElement("div");
    fakeBox(inner, { top: opts.contentTop, height: opts.contentHeight });
    shellScroller.appendChild(inner);
    content.appendChild(shellScroller);
    host = inner;
  }

  const target = document.createElement("div");
  fakeBox(target, { top: opts.targetTop, height: opts.targetHeight });
  host.appendChild(target);

  document.body.appendChild(port);
  return { port, target };
}

function renderProbe(target: HTMLElement, onValue: (v: number | null) => void) {
  function Probe() {
    const ref = useRef<HTMLElement | null>(target);
    const value = useAvailableHeight(ref);
    onValue(value);
    return null;
  }
  act(() => {
    root.render(<Probe />);
  });
}

describe("useAvailableHeight", () => {
  it("trả chỗ trống = chiều cao vùng cuộn − padding − phần trên − phần dưới", () => {
    // Vùng cuộn 544 (padding dưới 8); khối cần đo cách mép nội dung 100px,
    // dưới nó còn 88px (hàng nút). Chỗ trống đúng ra = 544 − 8 − 100 − 88.
    const { target } = buildTree({
      portClientHeight: 544,
      portPaddingBottom: 8,
      contentTop: 0,
      contentHeight: 700,
      targetTop: 100,
      targetHeight: 512,
      withShellScroller: false,
    });
    let value: number | null = null;
    renderProbe(target, (v) => {
      value = v;
    });
    expect(value).toBe(544 - 8 - 100 - 88);
  });

  it("BỎ QUA lớp cuộn cao-theo-nội-dung, bám lớp bị chặn chiều cao", () => {
    // Đây là bẫy đã làm ảnh tụt tới sàn: PlayerShell cũng khai overflow-y-auto
    // nhưng cao bằng nội dung. Nếu hook bám nó, chỗ trống tính ra bằng chính
    // chiều cao khối → co khối lại thì vòng đo sau nhỏ hơn, lặp tới sàn.
    const { target } = buildTree({
      portClientHeight: 544,
      portPaddingBottom: 8,
      contentTop: 0,
      contentHeight: 700,
      targetTop: 100,
      targetHeight: 512,
      withShellScroller: true,
    });
    let value: number | null = null;
    renderProbe(target, (v) => {
      value = v;
    });
    // Vẫn ra con số của vùng cuộn THẬT (544), không phải của lớp giả (700).
    expect(value).toBe(348);
  });

  it("đề bài dài ra thì chỗ trống hụt đi đúng bấy nhiêu", () => {
    const withStem = (stemHeight: number) => {
      document.body.innerHTML = "";
      const { target } = buildTree({
        portClientHeight: 544,
        portPaddingBottom: 8,
        contentTop: 0,
        // Đề bài dài thêm thì KHỐI NỘI DUNG cũng cao thêm đúng bấy nhiêu —
        // phần dưới khối (hàng nút) giữ nguyên 88px.
        contentHeight: stemHeight + 512 + 88,
        targetTop: stemHeight,
        targetHeight: 512,
        withShellScroller: false,
      });
      let value: number | null = null;
      renderProbe(target, (v) => {
        value = v;
      });
      act(() => root.unmount());
      root = createRoot(container);
      return value;
    };
    // Đề bài 100 → 348; dài thêm 60px thì chỗ cho lưới hụt đúng 60px.
    expect(withStem(100)).toBe(348);
    expect(withStem(160)).toBe(288);
  });

  it("không thấp hơn sàn tối thiểu dù chỗ trống âm", () => {
    const { target } = buildTree({
      portClientHeight: 200,
      portPaddingBottom: 8,
      contentTop: 0,
      contentHeight: 900,
      targetTop: 400,
      targetHeight: 400,
      withShellScroller: false,
    });
    let value: number | null = null;
    renderProbe(target, (v) => {
      value = v;
    });
    expect(value).toBe(120);
  });
});

/**
 * Chốt khung cuộn có HYSTERESIS — guard cho ca màn NHÁY (`43556966/bai15`).
 * jsdom không layout nên đo thật luôn trả null; khoá PHÉP CHỌN ở đây.
 */
describe("stickyPort — chỉ đổi khung theo hướng LÊN", () => {
  const node = (clientHeight: number, connected = true) =>
    ({ clientHeight, isConnected: connected }) as unknown as HTMLElement;

  it("nhận khung đầu tiên, rồi chỉ nâng lên khung cao hơn", () => {
    const nho = node(515);
    const to = node(715);
    expect(stickyPort(null, nho)).toBe(nho);
    // Ứng viên cao hơn → nâng lên.
    expect(stickyPort(nho, to)).toBe(to);
    // Ứng viên thấp hơn → GIỮ, đây là chỗ cắt vòng dao động gây nháy.
    expect(stickyPort(to, nho)).toBe(to);
  });

  it("chênh 1px không đủ để đổi khung (chống rung quanh ngưỡng)", () => {
    const a = node(520);
    expect(stickyPort(a, node(521))).toBe(a);
    expect(stickyPort(a, node(560))).not.toBe(a);
  });

  it("khung đang giữ rời DOM thì nhận ứng viên mới dù thấp hơn", () => {
    const roiDom = node(715, false);
    const moi = node(515);
    expect(stickyPort(roiDom, moi)).toBe(moi);
  });

  it("không có ứng viên thì giữ khung cũ, trừ khi nó đã rời DOM", () => {
    const dangGiu = node(600);
    expect(stickyPort(dangGiu, null)).toBe(dangGiu);
    expect(stickyPort(node(600, false), null)).toBeNull();
    expect(stickyPort(null, null)).toBeNull();
  });
});
