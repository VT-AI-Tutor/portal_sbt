import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FreeDrawPlayer } from "./FreeDrawPlayer";
import { SkinProvider } from "@/core/exercise/skin";
import type { QuestionPlayerSkin } from "@/core/exercise/skin";
import { decodeImage, loadImageViaBlob } from "@/core/content/loadImage";

vi.mock("@/core/content/loadImage", () => ({
  loadImageViaBlob: vi.fn(),
  decodeImage: vi.fn(),
}));

/** Skin tối giản: chỉ khai `chip` (kèm padding, như mọi skin thật). */
const CHIP_SKIN: QuestionPlayerSkin = {
  chip: () => "chip-idle-or-selected px-4 py-2 rounded-full border-4",
};

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function firePointer(el: Element, type: string, clientX: number, clientY: number): void {
  const Ctor = (window.PointerEvent ?? window.MouseEvent) as typeof MouseEvent;
  act(() => {
    el.dispatchEvent(new Ctor(type, { bubbles: true, cancelable: true, clientX, clientY }));
  });
}

/** Canvas đã render + stub pointer capture (jsdom không cài đặt ba hàm này). */
function drawableCanvas(): HTMLCanvasElement {
  const canvas = container.querySelector("canvas")!;
  canvas.setPointerCapture = () => {};
  canvas.hasPointerCapture = () => false;
  canvas.releasePointerCapture = () => {};
  return canvas;
}

/** Một nét vẽ trọn vẹn: nhấn · kéo · nhả. */
function drawStroke(canvas: HTMLCanvasElement): void {
  firePointer(canvas, "pointerdown", 100, 100);
  firePointer(canvas, "pointermove", 200, 180);
  firePointer(canvas, "pointerup", 200, 180);
}

describe("FreeDrawPlayer drawing toolbar", () => {
  it("exposes only the pen, the eraser and the clear button", () => {
    act(() => {
      root.render(<FreeDrawPlayer title="Vẽ hình" />);
    });

    for (const label of ["Bút", "Tẩy", "Xóa bản vẽ"]) {
      expect(container.querySelector(`button[aria-label="${label}"]`)).not.toBeNull();
    }
    // Bảng chọn màu, bảng chọn cỡ nét và các công cụ hình/chữ đã bỏ khỏi SBT.
    for (const label of ["Đường thẳng", "Hình chữ nhật", "Hình tròn", "Mũi tên", "Chữ"]) {
      expect(container.querySelector(`button[aria-label="${label}"]`)).toBeNull();
    }
    const toolbar = container.querySelector<HTMLElement>('[data-testid="freedraw-tools"]')!;
    expect(toolbar).not.toBeNull();
    expect(toolbar.querySelectorAll("button")).toHaveLength(3);
    expect(toolbar.className).toContain("md:flex-col");
    // Không còn lưới 2 cột (và biến thể 4 cột cho màn thấp): ba nút xếp một cột
    // đã thấp hơn khung vẽ.
    expect(toolbar.className).not.toContain("md:grid-cols-2");
    expect(container.querySelector('canvas[width="800"][height="560"]')).not.toBeNull();
  });

  it("lets the skin size all three buttons, clear included", () => {
    // Nút xoá từng nối cứng `w-9` của mình VÀO TRƯỚC class của skin: padding
    // của skin ăn hết bề ngang và icon thùng rác bị bóp về 0px — học sinh thấy
    // một nút trống trơn. jsdom không tính layout nên không đo được bề rộng;
    // khoá ở tầng gây ra nó: có skin thì cỡ hộp chỉ đến từ skin, y như bút/tẩy.
    act(() => {
      root.render(
        <SkinProvider skin={CHIP_SKIN}>
          <FreeDrawPlayer title="Vẽ hình" />
        </SkinProvider>,
      );
    });

    const toolbar = container.querySelector<HTMLElement>('[data-testid="freedraw-tools"]')!;
    for (const label of ["Bút", "Tẩy", "Xóa bản vẽ"]) {
      const btn = toolbar.querySelector<HTMLElement>(`button[aria-label="${label}"]`)!;
      expect(btn.className).toContain("chip-idle-or-selected");
      expect(btn.className).not.toContain("w-8");
      expect(btn.className).not.toContain("md:w-9");
    }
  });

  it("changes the active tool between the pen and the eraser", () => {
    act(() => {
      root.render(<FreeDrawPlayer title="Vẽ hình" />);
    });

    const pen = container.querySelector<HTMLButtonElement>('button[aria-label="Bút"]');
    const eraser = container.querySelector<HTMLButtonElement>('button[aria-label="Tẩy"]');
    expect(pen).not.toBeNull();
    expect(eraser).not.toBeNull();
    expect(pen?.getAttribute("aria-pressed")).toBe("true");

    act(() => eraser?.click());

    expect(eraser?.getAttribute("aria-pressed")).toBe("true");
    expect(pen?.getAttribute("aria-pressed")).toBe("false");
  });

  it("derives the intrinsic canvas height from a valid source aspect ratio", () => {
    act(() => {
      root.render(<FreeDrawPlayer title="Vẽ hình" aspectRatio={1.91} />);
    });

    expect(container.querySelector('canvas[width="800"][height="419"]')).not.toBeNull();
  });

  it("keeps the legacy canvas size when the ratio is missing or invalid", () => {
    act(() => {
      root.render(<FreeDrawPlayer title="Vẽ hình" aspectRatio={0} />);
    });

    expect(container.querySelector('canvas[width="800"][height="560"]')).not.toBeNull();
  });
});

describe("FreeDrawPlayer config fields (issue #571)", () => {
  it("applies canvasHeight in blank mode when no aspectRatio drives the height", () => {
    act(() => {
      root.render(<FreeDrawPlayer title="Vẽ hình" canvasHeight={320} />);
    });

    expect(container.querySelector('canvas[width="800"][height="320"]')).not.toBeNull();
  });

  it("prefers aspectRatio over canvasHeight (image/outline mode wins)", () => {
    act(() => {
      root.render(<FreeDrawPlayer title="Vẽ hình" aspectRatio={1.6} canvasHeight={999} />);
    });

    // 800 / 1.6 = 500 — canvasHeight is ignored when a valid ratio exists.
    expect(container.querySelector('canvas[width="800"][height="500"]')).not.toBeNull();
  });

  it("renders the canvasLabel caption above the canvas", () => {
    act(() => {
      root.render(<FreeDrawPlayer title="Vẽ hình" canvasLabel="Vẽ chân dung của em" />);
    });

    expect(container.textContent).toContain("Vẽ chân dung của em");
  });

  it("renders each textField label with its ruled writing lines", () => {
    act(() => {
      root.render(
        <FreeDrawPlayer
          title="Vẽ hình"
          textFields={[
            { label: "Hãy cùng nhau", lines: 3 },
            { label: "Ghi chú", lines: 1 },
          ]}
        />,
      );
    });

    expect(container.textContent).toContain("Hãy cùng nhau");
    expect(container.textContent).toContain("Ghi chú");
    // 3 + 1 ruled lines total across both frames.
    expect(container.querySelectorAll(".border-dashed").length).toBe(4);
  });

  it("defaults a textField to 2 ruled lines when lines is omitted", () => {
    act(() => {
      root.render(<FreeDrawPlayer title="Vẽ hình" textFields={[{ label: "Viết ở đây" }]} />);
    });

    expect(container.querySelectorAll(".border-dashed").length).toBe(2);
  });

  it("renders no writing frames for legacy payloads without textFields", () => {
    act(() => {
      root.render(<FreeDrawPlayer title="Vẽ hình" />);
    });

    expect(container.querySelectorAll(".border-dashed").length).toBe(0);
  });
});

// Góp ý nghiệm thu 24/08: SBT khoá MỘT màu bút (xanh lá) và MỘT cỡ nét. Không
// còn nút nào trên giao diện đổi hai giá trị đó, nên chỉ test này giữ chúng —
// sửa hằng số mà không sửa test là đổi thầm màu bút của cả bộ sách.
describe("FreeDrawPlayer fixed pen (góp ý 24/08)", () => {
  it("strokes with the fixed green pen at the fixed width", () => {
    const strokes: Array<{ style: string; width: number }> = [];
    let strokeStyle = "";
    let lineWidth = 0;
    const ctx = {
      globalCompositeOperation: "source-over",
      fillStyle: "",
      get strokeStyle() {
        return strokeStyle;
      },
      set strokeStyle(value: string) {
        strokeStyle = value;
      },
      get lineWidth() {
        return lineWidth;
      },
      set lineWidth(value: number) {
        lineWidth = value;
      },
      lineCap: "",
      lineJoin: "",
      fillRect: () => {},
      drawImage: () => {},
      beginPath: () => {},
      moveTo: () => {},
      lineTo: () => {},
      stroke: () => {
        strokes.push({ style: strokeStyle, width: lineWidth });
      },
    } as unknown as CanvasRenderingContext2D;

    const getContext = vi
      .spyOn(HTMLCanvasElement.prototype, "getContext")
      .mockReturnValue(ctx as unknown as ReturnType<HTMLCanvasElement["getContext"]>);
    const toDataURL = vi
      .spyOn(HTMLCanvasElement.prototype, "toDataURL")
      .mockReturnValue("data:image/png;base64,x");
    const rect = vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue({
      x: 0, y: 0, left: 0, top: 0, width: 800, height: 560, right: 800, bottom: 560, toJSON: () => ({}),
    } as DOMRect);

    try {
      act(() => {
        root.render(<FreeDrawPlayer title="Vẽ hình" colors={["#ef4444", "#000000"]} />);
      });

      drawStroke(drawableCanvas());

      expect(strokes.length).toBeGreaterThan(0);
      for (const s of strokes) {
        // Bảng màu tác giả khai (colors) bị bỏ qua: bút luôn xanh lá.
        expect(s.style).toBe("#22c55e");
        expect(s.width).toBe(8);
      }
    } finally {
      getContext.mockRestore();
      toDataURL.mockRestore();
      rect.mockRestore();
    }
  });
});

describe("FreeDrawPlayer tainted canvas (issue #695)", () => {
  it("does not white-fill (erase strokes) when the background finishes loading late", async () => {
    let resolveLoad: (img: HTMLImageElement) => void = () => {};
    vi.mocked(loadImageViaBlob).mockReturnValue(
      new Promise<HTMLImageElement>((resolve) => {
        resolveLoad = resolve;
      }),
    );

    const calls = { fillRect: 0, drawImage: 0 };
    const ctx = {
      globalCompositeOperation: "source-over",
      fillStyle: "",
      fillRect: () => {
        calls.fillRect += 1;
      },
      drawImage: () => {
        calls.drawImage += 1;
      },
    } as unknown as CanvasRenderingContext2D;
    const getContext = vi
      .spyOn(HTMLCanvasElement.prototype, "getContext")
      .mockReturnValue(ctx as unknown as ReturnType<HTMLCanvasElement["getContext"]>);

    try {
      await act(async () => {
        root.render(<FreeDrawPlayer title="Vẽ hình" backgroundImage="/uploads/bg.png" />);
      });

      const fillsBeforeArrival = calls.fillRect;
      expect(fillsBeforeArrival).toBeGreaterThan(0);
      expect(calls.drawImage).toBe(0);

      await act(async () => {
        resolveLoad({ width: 100, height: 100 } as HTMLImageElement);
        await Promise.resolve();
      });

      expect(calls.drawImage).toBeGreaterThan(0);
      expect(calls.fillRect).toBe(fillsBeforeArrival);
    } finally {
      getContext.mockRestore();
    }
  });

  it("does not fall back to a canvas-tainting <img> load when the blob load fails", async () => {
    vi.mocked(loadImageViaBlob).mockRejectedValue(new Error("Không tải được ảnh"));

    const calls = { fillRect: 0, drawImage: 0 };
    const ctx = {
      globalCompositeOperation: "source-over",
      fillStyle: "",
      fillRect: () => {
        calls.fillRect += 1;
      },
      drawImage: () => {
        calls.drawImage += 1;
      },
    } as unknown as CanvasRenderingContext2D;
    const getContext = vi
      .spyOn(HTMLCanvasElement.prototype, "getContext")
      .mockReturnValue(ctx as unknown as ReturnType<HTMLCanvasElement["getContext"]>);

    try {
      await act(async () => {
        root.render(<FreeDrawPlayer title="Vẽ hình" backgroundImage="/uploads/bg.png" />);
        await Promise.resolve();
      });

      expect(vi.mocked(decodeImage)).not.toHaveBeenCalled();
      expect(calls.fillRect).toBeGreaterThan(0);
      expect(calls.drawImage).toBe(0);
    } finally {
      getContext.mockRestore();
    }
  });

  it("erases with destination-out and restores the background instead of drawing a black line", () => {
    let gco = "source-over";
    const strokeGco: string[] = [];
    let fillRectCalls = 0;
    const ctx = {
      get globalCompositeOperation() {
        return gco;
      },
      set globalCompositeOperation(value: string) {
        gco = value;
      },
      fillStyle: "",
      strokeStyle: "",
      lineWidth: 0,
      lineCap: "",
      lineJoin: "",
      fillRect: () => {
        fillRectCalls += 1;
      },
      drawImage: () => {},
      beginPath: () => {},
      moveTo: () => {},
      lineTo: () => {},
      stroke: () => {
        strokeGco.push(gco);
      },
    } as unknown as CanvasRenderingContext2D;
    const getContext = vi
      .spyOn(HTMLCanvasElement.prototype, "getContext")
      .mockReturnValue(ctx as unknown as ReturnType<HTMLCanvasElement["getContext"]>);
    const toDataURL = vi
      .spyOn(HTMLCanvasElement.prototype, "toDataURL")
      .mockReturnValue("data:image/png;base64,x");

    try {
      act(() => {
        root.render(<FreeDrawPlayer title="Vẽ hình" />);
      });

      act(() => container.querySelector<HTMLButtonElement>('button[aria-label="Tẩy"]')?.click());

      drawStroke(drawableCanvas());

      expect(strokeGco).toContain("destination-out");
      expect(strokeGco).not.toContain("source-over");
      expect(fillRectCalls).toBeGreaterThan(0);
      expect(gco).toBe("source-over");
    } finally {
      getContext.mockRestore();
      toDataURL.mockRestore();
    }
  });

  it("does not promise Đã ghi nhận when the snapshot itself throws", () => {
    // Canvas nhiễm thì `toDataURL` ném: không có gì lưu được, nên nút xác nhận
    // KHÔNG được bật nhãn — hứa "đã ghi nhận" cho một bài không tồn tại ở cha
    // còn tệ hơn là không nói gì.
    const ctx = {
      globalCompositeOperation: "source-over",
      fillStyle: "",
      fillRect: () => {},
      drawImage: () => {},
    } as unknown as CanvasRenderingContext2D;
    const getContext = vi
      .spyOn(HTMLCanvasElement.prototype, "getContext")
      .mockReturnValue(ctx as unknown as ReturnType<HTMLCanvasElement["getContext"]>);
    const toDataURL = vi
      .spyOn(HTMLCanvasElement.prototype, "toDataURL")
      .mockImplementation(() => {
        throw new Error("Tainted canvases may not be exported.");
      });
    const onAnswerChange = vi.fn();

    try {
      act(() => {
        root.render(<FreeDrawPlayer title="Vẽ hình" onAnswerChange={onAnswerChange} />);
      });

      const confirm = Array.from(container.querySelectorAll("button")).find(
        (b) => b.textContent?.includes("Nộp câu trả lời"),
      )!;
      act(() => {
        confirm.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      });

      expect(onAnswerChange).not.toHaveBeenCalled();
      expect(container.textContent).not.toContain("Hệ thống đã ghi nhận");
    } finally {
      getContext.mockRestore();
      toDataURL.mockRestore();
    }
  });
});

// Owner 8/8: khung vẽ phải nằm gọn một màn, KỂ CẢ nút "Nộp câu trả lời" — canvas khổ
// dọc/vuông không có trần thì phóng theo bề rộng cột và đẩy nút ra ngoài.
describe("FreeDrawPlayer canvas height budget", () => {
  it("caps the canvas by viewport height while keeping max-w-full (ratio preserved)", () => {
    act(() => {
      root.render(<FreeDrawPlayer title="Vẽ hình" aspectRatio={1} />);
    });
    const canvas = container.querySelector("canvas")!;
    // Trần theo màn hình, có sàn để màn rất thấp vẫn vẽ được.
    expect(canvas.className).toContain("max-h-[max(12rem,calc(100svh-24rem))]");
    // Vẫn bị bó bề rộng cột và cao tự động → hai ràng buộc giữ đúng tỉ lệ.
    expect(canvas.className).toContain("max-w-full");
    expect(canvas.className).toContain("h-auto");
    // Bitmap giữ nguyên tỉ lệ tác giả khai (800×800 cho ratio 1).
    expect(canvas.getAttribute("height")).toBe("800");
  });
});

// Bảng ghi nhận lỗi NXB (Toán 3 tập 1, bài 17 "bánh xe" + 18/20/22): nhãn
// "Đã ghi nhận ✓" bật ngay từ nét đầu tiên nên học sinh tưởng xong và bỏ dở
// hình. Lời "em vẽ xong" phải do HỌC SINH nói — auto-record vẫn chạy nhưng câm.
// (Đảo quyết định Owner 8/8 "practice không cần nút"; chỗ cho hàng nút vẫn nằm
// sẵn trong ngân sách 24rem của khung vẽ nên canvas không nhỏ đi.)
describe("FreeDrawPlayer confirm button", () => {
  // web-own (SBT-61): một chữ "Nộp câu trả lời" cho mọi luồng, kể cả practice.
  it("shows Nộp câu trả lời in practice and when instant feedback is off", () => {
    act(() => {
      root.render(<FreeDrawPlayer title="Vẽ hình" />);
    });
    expect(container.textContent).toContain("Nộp câu trả lời");

    act(() => {
      root.render(<FreeDrawPlayer title="Vẽ hình" instantFeedback={false} />);
    });
    expect(container.textContent).toContain("Nộp câu trả lời");
  });

  it("saves every stroke but only labels it recorded once the student confirms", () => {
    const ctx = {
      globalCompositeOperation: "source-over",
      fillStyle: "",
      strokeStyle: "",
      lineWidth: 0,
      lineCap: "",
      lineJoin: "",
      fillRect: () => {},
      drawImage: () => {},
      beginPath: () => {},
      moveTo: () => {},
      lineTo: () => {},
      stroke: () => {},
    } as unknown as CanvasRenderingContext2D;
    const getContext = vi
      .spyOn(HTMLCanvasElement.prototype, "getContext")
      .mockReturnValue(ctx as unknown as ReturnType<HTMLCanvasElement["getContext"]>);
    // Ảnh chụp đổi theo thứ đang nằm trên khung vẽ, để phân biệt được đáp án
    // "có hình" với đáp án "khung trắng sau khi xoá".
    let snapshot = "data:image/png;base64,co-hinh";
    const toDataURL = vi
      .spyOn(HTMLCanvasElement.prototype, "toDataURL")
      .mockImplementation(() => snapshot);
    const rect = vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue({
      x: 0, y: 0, left: 0, top: 0, width: 800, height: 560, right: 800, bottom: 560, toJSON: () => ({}),
    } as DOMRect);
    const onAnswerChange = vi.fn();

    try {
      act(() => {
        root.render(<FreeDrawPlayer title="Vẽ hình" onAnswerChange={onAnswerChange} />);
      });

      drawStroke(drawableCanvas());

      // Nét vẽ VẪN được lưu (chống mất bài khi chuyển câu)…
      expect(onAnswerChange).toHaveBeenCalledWith("data:image/png;base64,co-hinh");
      // …nhưng chưa có lời nào nói bài đã xong.
      expect(container.textContent).not.toContain("Hệ thống đã ghi nhận");

      const confirm = Array.from(container.querySelectorAll("button")).find(
        (b) => b.textContent?.includes("Nộp câu trả lời"),
      )!;
      act(() => {
        confirm.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      });

      expect(container.textContent).toContain("Hệ thống đã ghi nhận");

      // Xoá sạch khung vẽ thì lời xác nhận cũ không còn đúng — và đáp án giữ ở
      // cha cũng phải theo: không ghi lại thì bài nộp vẫn là hình vừa bỏ đi.
      snapshot = "data:image/png;base64,khung-trang";
      const clear = container.querySelector('[aria-label="Xóa bản vẽ"]')!;
      act(() => {
        clear.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      });
      expect(container.textContent).not.toContain("Hệ thống đã ghi nhận");
      expect(onAnswerChange).toHaveBeenLastCalledWith("data:image/png;base64,khung-trang");
    } finally {
      getContext.mockRestore();
      toDataURL.mockRestore();
      rect.mockRestore();
    }
  });

  it("does not claim Đã ghi nhận for a drawing restored from an earlier visit", () => {
    // Vẽ dở rồi sang câu khác và quay lại: nét vẽ được khôi phục (auto-record)
    // nhưng KHÔNG có nhãn — đáp án chỉ là dataURL, không phân biệt được "vẽ dở"
    // với "đã bấm xong", mà bật nhãn theo ảnh cũ là dựng lại đúng lỗi NXB báo.
    act(() => {
      root.render(<FreeDrawPlayer title="Vẽ hình" answer="data:image/png;base64,x" />);
    });
    expect(container.textContent).not.toContain("Hệ thống đã ghi nhận");
    expect(container.textContent).toContain("Nộp câu trả lời");
  });

  it("still labels a submitted drawing as recorded (màn xem lại bài / kết quả)", () => {
    // `submitted` = canvas khoá, không vẽ thêm được → ảnh cũ chắc chắn là bài
    // đã nộp, không còn cửa hiểu nhầm "đang vẽ dở". Bỏ nhánh này thì màn xem
    // lại bài in câu vẽ trống trơn, không còn dòng xác nhận nào.
    act(() => {
      root.render(<FreeDrawPlayer title="Vẽ hình" answer="data:image/png;base64,x" submitted />);
    });
    expect(container.textContent).toContain("Hệ thống đã ghi nhận");
    expect(container.textContent).not.toContain("Nộp câu trả lời");
  });
});
