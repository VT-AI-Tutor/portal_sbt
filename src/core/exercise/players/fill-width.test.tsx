/**
 * Per-blank display width — `blanks[].width` (CSS length string) flows through
 * parseCloze() into the cloze/fill_blank inputs. Rendering-only hint: defaults
 * stay "7rem" (inline marker path) / "10rem" (synthesized labeled path), and
 * non-string widths are ignored. Never influences grading.
 *
 * Hai vai của con số đó, từ khi ô điền tự giãn (AutoGrowInput):
 *  - tác giả KHAI (`width` / `input.size`) → trên surface HỌC SINH (skin mặc
 *    định của repo này) đó chỉ là SÀN: ô mở ra đúng cỡ ấy rồi vẫn nở theo chữ,
 *    vì hộp khoá nuốt mất đáp án dài học sinh vừa gõ. Surface studio (trình
 *    soạn) mới còn khoá cứng — xem describe "ranh giới" cuối file;
 *  - KHÔNG khai → SÀN suy TỪ ĐÁP ÁN ("giống sách", Owner 12/8 —
 *    {@link blankAnswerWidth}), ô rộng thêm theo chữ; không suy được đáp án
 *    (câu tự chấm không key) thì mới rơi về cỡ mặc định 7rem/10rem.
 * Cỡ nằm trên khung `inline-grid` bọc ô, không nằm trên chính `<input>`.
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { renderInteractionPlayer, sizeToWidth } from "./dispatch";
import { SkinProvider } from "../skin/context";
import { blankAnswerWidth } from "./shared";

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

const inputs = () =>
  Array.from(container.querySelectorAll<HTMLInputElement>("input[type='text']"));

/** Khung `inline-grid` bọc ô — nơi mang cỡ (sàn/trần) của ô điền. */
const boxes = () =>
  inputs().map((el) => {
    const box = el.parentElement as HTMLElement;
    expect(box.className).toContain("inline-grid");
    return box;
  });

describe("parseCloze blanks[].width", () => {
  it("inline marker path: honors blanks[].width and keeps the 7rem default", () => {
    act(() => {
      root.render(
        renderInteractionPlayer(
          "cloze",
          {
            content: { blocks: [{ type: "paragraph", text: "{blank_1} và {blank_2} nhé." }] },
            blanks: [{ id: "blank_1", width: "12rem" }, { id: "blank_2" }],
            correctAnswer: { blank_1: "a", blank_2: "b" },
          },
          {},
        ),
      );
    });
    expect(inputs().length).toBe(2);
    // Khai width → trên surface HỌC SINH (skin mặc định của repo này) con số đó
    // là SÀN chứ không phải trần: ô mở đúng 12rem rồi còn nở thêm theo chữ.
    expect(boxes()[0].style.minWidth).toBe("12rem");
    expect(boxes()[0].style.maxWidth).toBe("");
    // Không khai → sàn suy từ đáp án ("b" 1 ký tự → chạm sàn 6ch), không có
    // trần để ô còn giãn được.
    expect(boxes()[1].style.maxWidth).toBe("");
    expect(boxes()[1].style.minWidth).toContain("6ch");
  });

  it("synthesized fallback path: honors blanks[].width and keeps the 10rem default", () => {
    act(() => {
      root.render(
        renderInteractionPlayer(
          "fill_blank",
          {
            selfAssessment: true,
            content: { blocks: [{ type: "paragraph", text: "Không có marker nào." }] },
            blanks: [
              { id: "blank_1", label: "a. Câu một:", width: "15rem" },
              { id: "blank_2", label: "b. Câu hai:" },
            ],
          },
          {},
        ),
      );
    });
    expect(inputs().length).toBe(2);
    expect(boxes()[0].style.minWidth).toBe("15rem");
    expect(boxes()[0].style.maxWidth).toBe("");
    expect(boxes()[1].style.maxWidth).toBe("");
    expect(boxes()[1].style.minWidth).toContain("10rem");
  });

  it("ignores non-string widths (falls back to the default)", () => {
    act(() => {
      root.render(
        renderInteractionPlayer(
          "cloze",
          {
            content: { blocks: [{ type: "paragraph", text: "{blank_1} thôi." }] },
            blanks: [{ id: "blank_1", width: 12 }],
            correctAnswer: { blank_1: "a" },
          },
          {},
        ),
      );
    });
    expect(boxes()[0].style.maxWidth).toBe("");
    // Đáp án "a" (1 ký tự) → sàn suy từ đáp án chạm 6ch, không còn 7rem.
    expect(boxes()[0].style.minWidth).toContain("6ch");
  });
});

const textareas = () => Array.from(container.querySelectorAll("textarea"));

describe("parseCloze blanks[].input (issue #444)", () => {
  it("sizeToWidth maps the four presets and rejects everything else", () => {
    expect(sizeToWidth("short")).toBe("4rem");
    expect(sizeToWidth("medium")).toBe("7rem");
    expect(sizeToWidth("long")).toBe("14rem");
    expect(sizeToWidth("full")).toBe("100%");
    expect(sizeToWidth(undefined)).toBeUndefined();
  });

  it("inline marker path: input.size maps to the preset width; legacy width overrides it", () => {
    act(() => {
      root.render(
        renderInteractionPlayer(
          "cloze",
          {
            content: {
              blocks: [{ type: "paragraph", text: "{blank_1} và {blank_2} và {blank_3} nhé." }],
            },
            blanks: [
              { id: "blank_1", input: { size: "long" } },
              { id: "blank_2", width: "12rem", input: { size: "short" } },
              { id: "blank_3", input: { size: "short" } },
            ],
            correctAnswer: { blank_1: "a", blank_2: "b", blank_3: "c" },
          },
          {},
        ),
      );
    });
    expect(inputs().length).toBe(3);
    expect(boxes()[0].style.minWidth).toBe("14rem");
    // width (legacy #437 + drag handle) wins over input.size.
    expect(boxes()[1].style.minWidth).toBe("12rem");
    expect(boxes()[2].style.minWidth).toBe("4rem");
  });

  it("synthesized fallback path: input.size maps to the preset width and keeps the 10rem default", () => {
    act(() => {
      root.render(
        renderInteractionPlayer(
          "fill_blank",
          {
            selfAssessment: true,
            content: { blocks: [{ type: "paragraph", text: "Không có marker nào." }] },
            blanks: [
              { id: "blank_1", label: "a. Câu một:", input: { size: "long" } },
              { id: "blank_2", label: "b. Câu hai:" },
              { id: "blank_3", label: "c. Câu ba:", width: "15rem", input: { size: "short" } },
            ],
          },
          {},
        ),
      );
    });
    expect(inputs().length).toBe(3);
    expect(boxes()[0].style.minWidth).toBe("14rem");
    expect(boxes()[1].style.maxWidth).toBe("");
    expect(boxes()[1].style.minWidth).toContain("10rem");
    // width (legacy) wins over input.size on the fallback path too.
    expect(boxes()[2].style.minWidth).toBe("15rem");
  });

  it("inline marker path: mode multiline renders a textarea with the given rows", () => {
    act(() => {
      root.render(
        renderInteractionPlayer(
          "cloze",
          {
            content: { blocks: [{ type: "paragraph", text: "Trả lời: {blank_1}" }] },
            blanks: [{ id: "blank_1", input: { mode: "multiline", size: "full", rows: 3 } }],
            correctAnswer: { blank_1: "a" },
          },
          {},
        ),
      );
    });
    expect(inputs().length).toBe(0);
    expect(textareas().length).toBe(1);
    expect(textareas()[0].rows).toBe(3);
    expect(textareas()[0].className).toContain("w-full");
  });

  it("multiline defaults to 2 rows and drops invalid rows values", () => {
    act(() => {
      root.render(
        renderInteractionPlayer(
          "cloze",
          {
            content: { blocks: [{ type: "paragraph", text: "{blank_1} rồi {blank_2}" }] },
            blanks: [
              { id: "blank_1", input: { mode: "multiline" } },
              { id: "blank_2", input: { mode: "multiline", rows: -3 } },
            ],
            correctAnswer: { blank_1: "a", blank_2: "b" },
          },
          {},
        ),
      );
    });
    expect(textareas().length).toBe(2);
    expect(textareas()[0].rows).toBe(2);
    expect(textareas()[1].rows).toBe(2);
  });

  it("b28_q4 shape: 4 labeled blanks without markers → 3 inputs + 1 full-width textarea", () => {
    act(() => {
      root.render(
        renderInteractionPlayer(
          "fill_blank",
          {
            id: "b28_q4",
            selfAssessment: true,
            content: { blocks: [{ type: "paragraph", text: "PHIẾU KỂ CHUYỆN LỊCH SỬ" }] },
            blanks: [
              { id: "blank_1", label: "– Tên nhân vật:", input: { size: "long" } },
              { id: "blank_2", label: "– Sự kiện tiêu biểu:", input: { size: "long" } },
              { id: "blank_3", label: "– Chi tiết ấn tượng:", input: { size: "long" } },
              {
                id: "blank_4",
                label: "– Bài học em học được:",
                input: { mode: "multiline", size: "full", rows: 4 },
              },
            ],
          },
          {},
        ),
      );
    });
    expect(inputs().length).toBe(3);
    expect(boxes().every((el) => el.style.minWidth === "14rem")).toBe(true);
    expect(textareas().length).toBe(1);
    expect(textareas()[0].rows).toBe(4);
    expect(textareas()[0].className).toContain("w-full");
  });

  it("payload without input renders exactly as before (backward compat)", () => {
    act(() => {
      root.render(
        renderInteractionPlayer(
          "cloze",
          {
            content: { blocks: [{ type: "paragraph", text: "{blank_1} thôi." }] },
            blanks: [{ id: "blank_1" }],
            correctAnswer: { blank_1: "a" },
          },
          {},
        ),
      );
    });
    expect(textareas().length).toBe(0);
    expect(inputs().length).toBe(1);
    expect(boxes()[0].style.maxWidth).toBe("");
    // Đáp án "a" (1 ký tự) → sàn suy từ đáp án chạm 6ch, không còn 7rem.
    expect(boxes()[0].style.minWidth).toContain("6ch");
  });
});

/**
 * Ô điền TỰ RỘNG theo chữ — lớp lỗi này không kêu ở đâu cả: quay về `<input>`
 * width cứng thì tsc vẫn xanh, mọi test còn lại vẫn xanh, câu vẫn render đủ ô;
 * chỉ có học sinh gõ đáp án dài mới thấy chữ mình biến mất. Nên phải ghim.
 *
 * Ca thật: `18-toan-4/bai1` câu 3 "Viết các số sau thành tổng" — đáp án
 * "20 000 + 4 000 + 500 + 70 + 3" dài 29 ký tự trong ô mặc định 7rem (~8–9 ký
 * tự nhìn thấy). Kho có 8 343 ô blank, KHÔNG ô nào khai width, 16,5% có đáp án
 * dài hơn 8 ký tự.
 */
describe("ô điền tự rộng theo chữ (AutoGrowInput)", () => {
  const renderBlank = (blank: Record<string, unknown>) =>
    act(() => {
      root.render(
        renderInteractionPlayer(
          "cloze",
          {
            content: { blocks: [{ type: "paragraph", text: "a) 24 573 = {blank_1}" }] },
            blanks: [{ id: "blank_1", ...blank }],
            correctAnswer: { blank_1: "20 000 + 4 000 + 500 + 70 + 3" },
          },
          {},
        ),
      );
    });

  /** Bản sao chữ vô hình — chính nó kéo rộng rãnh grid, nên nó LÀ cơ chế. */
  const mirror = () => container.querySelector<HTMLElement>("span[aria-hidden='true'].invisible");

  it("ô mặc định: bản sao đo mang đúng chữ đang gõ, và không có trần chặn nở", () => {
    renderBlank({});
    const el = inputs()[0];
    act(() => {
      // React theo dõi `value` qua setter riêng — gán thẳng `el.value` bị nuốt,
      // phải gọi setter gốc rồi mới bắn `input` thì onChange mới chạy.
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(
        el,
        "20 000 + 4 000 + 500 + 70 + 3",
      );
      el.dispatchEvent(new Event("input", { bubbles: true }));
    });
    // Bản sao chữ phải chạy theo giá trị: đứng yên = ô không bao giờ rộng ra.
    expect(mirror()?.textContent).toContain("20 000 + 4 000 + 500 + 70 + 3");
    expect(mirror()?.className).toContain("whitespace-pre");
    // Không trần → nở được; `max-w-full` giữ nó không tràn khỏi dòng.
    expect(boxes()[0].style.maxWidth).toBe("");
    expect(boxes()[0].className).toContain("max-w-full");
    // Ô nhập bám rãnh grid chứ không tự đặt bề rộng.
    expect(el.className).toContain("w-full");
    expect(el.style.width).toBe("");
  });

  it("ô nhập khai size=1 — nếu không, ô TRỐNG tự phình quá sàn", () => {
    renderBlank({});
    // `size` mặc định của <input> là 20 ký tự và rãnh grid `auto` tính theo cỡ
    // nội tại đó, KHÔNG theo `width:100%`. Bỏ `size=1` thì ô trống rộng ~218px
    // thay vì đứng đúng sàn 112px — đo thật trên /dev/players, jsdom không
    // dựng layout nên chỉ ghim được thuộc tính.
    expect(inputs()[0].size).toBe(1);
  });

  it("bản sao đo dùng ĐÚNG className của ô nhập (khác đi là đo sai hộp)", () => {
    renderBlank({});
    const inputClasses = inputs()[0].className.split(" ").filter(Boolean);
    const mirrorClasses = new Set(mirror()!.className.split(" "));
    // Mọi class của ô nhập trừ phần riêng của mỗi bên phải có ở bản sao.
    for (const c of inputClasses) {
      if (c === "w-full" || c === "min-w-0") continue;
      expect(mirrorClasses.has(c)).toBe(true);
    }
  });

  it("tác giả khai width → SÀN đúng con số ấy, nhưng vẫn nở được", () => {
    renderBlank({ width: "12rem" });
    // Ô vẫn MỞ RA ở 12rem như ý đồ tác giả…
    expect(boxes()[0].style.minWidth).toBe("12rem");
    // …chỉ khác là không còn trần nuốt chữ, và `width` cứng cũng phải biến mất
    // — chỉ bỏ mỗi `maxWidth` thì rãnh grid vẫn bị ghim và ô đứng im.
    expect(boxes()[0].style.maxWidth).toBe("");
    expect(boxes()[0].style.width).toBe("");
  });
});

/**
 * Ranh giới của luật "width tác giả khai chỉ là SÀN": nó chỉ đúng trên surface
 * HỌC SINH và chỉ với ô GÕ TAY. Ba ca dưới là ba nửa còn lại — nếu ai đó gỡ
 * điều kiện cho gọn thì chính chúng kêu, chứ không phải người dùng kêu.
 */
describe("ranh giới: chỗ nào width tác giả khai vẫn là hộp KHOÁ", () => {
  const renderIn = (skin: "studio" | "playful", blank: Record<string, unknown>) =>
    act(() => {
      root.render(
        <SkinProvider skin={skin}>
          {renderInteractionPlayer(
            "cloze",
            {
              content: { blocks: [{ type: "paragraph", text: "a) 24 573 = {blank_1}" }] },
              blanks: [{ id: "blank_1", ...blank }],
              correctAnswer: { blank_1: "20 000 + 4 000 + 500 + 70 + 3" },
            },
            {},
          )}
        </SkinProvider>,
      );
    });

  it("surface studio vẫn KHOÁ — người soạn phải thấy đúng con số mình đặt", () => {
    renderIn("studio", { width: "12rem" });
    // (`width: min(12rem, 42cqi)` cũng được đặt, nhưng jsdom không phân tích
    // được hàm `min()` nên chỉ đọc lại được trần — đủ để ghim "không nở".)
    expect(boxes()[0].style.maxWidth).toBe("12rem");
  });

  it("dropdown vẫn KHOÁ — <select> không có cơ chế nở, bỏ trần chỉ làm phình", () => {
    renderIn("playful", { width: "12rem", options: ["a", "bbbbbbbbbbbbbbbbbbbbbbbb"] });
    const select = container.querySelector("select");
    expect(select).not.toBeNull();
    expect(select!.style.maxWidth).toBe("12rem");
  });

  it("input.size 'full' giữ nguyên — ô đã chiếm trọn dòng, thành sàn vô nghĩa", () => {
    renderIn("playful", { input: { size: "full" } });
    expect(boxes()[0].style.maxWidth).toBe("100%");
  });
});

/**
 * Bề rộng ô suy TỪ ĐÁP ÁN — "giống sách": chỗ trống dài ngắn theo đáp án
 * (Owner 12/8, chốt bám sát độ dài thay vì gom bậc).
 *
 * Khoá cả PHÉP TÍNH (thuần, không cần layout) lẫn ĐƯỜNG DẪN qua dispatch, vì
 * jsdom không layout nên chỉ đọc được chuỗi style chứ không đo được pixel.
 */
describe("bề rộng ô điền suy từ đáp án", () => {
  it("lấy đáp án DÀI NHẤT + 2ch, kẹp trong [6ch, 24ch]", () => {
    // Ngắn → chạm sàn 6ch để hàng ô điền không lởm chởm.
    expect(blankAnswerWidth(["3"])).toBe("6ch");
    expect(blankAnswerWidth(["15"])).toBe("6ch");
    expect(blankAnswerWidth(["một"])).toBe("6ch");
    // Vừa → bám sát độ dài: 8 ký tự + 2 = 10ch.
    expect(blankAnswerWidth(["mười lăm"])).toBe("10ch");
    // Nhiều biến thể → theo cái DÀI NHẤT, không cắt chữ biến thể dài.
    expect(blankAnswerWidth(["15", "mười lăm"])).toBe("10ch");
    // Dài → dừng ở trần 24ch, phần dư để AutoGrowInput tự giãn.
    expect(blankAnswerWidth(["20 000 + 4 000 + 500 + 70 + 3"])).toBe("24ch");
  });

  it("không suy được thì trả undefined để caller giữ nguyên cỡ mặc định", () => {
    expect(blankAnswerWidth(undefined)).toBeUndefined();
    expect(blankAnswerWidth([])).toBeUndefined();
    expect(blankAnswerWidth(["", "   "])).toBeUndefined();
  });

  it("đáp án dài đẩy SÀN ô rộng ra, đáp án ngắn thì không", () => {
    act(() => {
      root.render(
        renderInteractionPlayer(
          "cloze",
          {
            content: { blocks: [{ type: "paragraph", text: "{blank_1} và {blank_2}." }] },
            blanks: [{ id: "blank_1" }, { id: "blank_2" }],
            correctAnswer: { blank_1: "7", blank_2: "hai mươi mốt" },
          },
          {},
        ),
      );
    });
    expect(boxes()[0].style.minWidth).toContain("6ch");
    expect(boxes()[1].style.minWidth).toContain("14ch");
    // Vẫn là SÀN: không khoá trần, ô còn giãn theo chữ học sinh gõ.
    expect(boxes()[0].style.maxWidth).toBe("");
    expect(boxes()[1].style.maxWidth).toBe("");
  });

  it("width tác giả khai vẫn THẮNG đáp án (Tầng 2 bộ rules player)", () => {
    act(() => {
      root.render(
        renderInteractionPlayer(
          "cloze",
          {
            content: { blocks: [{ type: "paragraph", text: "{blank_1}." }] },
            blanks: [{ id: "blank_1", width: "12rem" }],
            correctAnswer: { blank_1: "7" },
          },
          {},
        ),
      );
    });
    expect(boxes()[0].style.minWidth).toBe("12rem");
    expect(boxes()[0].style.minWidth).not.toContain("ch");
  });

  it("câu TỰ CHẤM (không có key) giữ nguyên cỡ mặc định như trước", () => {
    act(() => {
      root.render(
        renderInteractionPlayer(
          "fill_blank",
          {
            selfAssessment: true,
            content: { blocks: [{ type: "paragraph", text: "{blank_1} nhé." }] },
            blanks: [{ id: "blank_1" }],
          },
          {},
        ),
      );
    });
    expect(boxes()[0].style.minWidth).toContain("7rem");
    expect(boxes()[0].style.minWidth).not.toContain("ch");
  });
});
