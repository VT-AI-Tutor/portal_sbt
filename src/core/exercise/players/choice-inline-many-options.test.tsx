/**
 * Bố cục NGANG là MẶC ĐỊNH cho câu chọn chữ (Owner 5/8: "để default hiển thị
 * các options inline").
 *
 * Luật: tác giả KHÔNG khai `display.layout` (manifest cắm `authored: false`) →
 * thẻ phương án xếp ngang có wrap (`flex flex-wrap`, pill ôm nội dung) — bất kể
 * SỐ LƯỢNG hay ĐỘ DÀI. Phương án ngắn xếp cạnh nhau; phương án là câu văn (pill
 * rộng) tự xuống dòng riêng, nên inline vẫn an toàn cho ca chữ dài. Ngưỡng cũ
 * (≥5 phương án ngắn, avg ≤40 ký tự) đã bỏ.
 *
 * Ngoại lệ giữ nguyên: layout tác giả khai LUÔN thắng; phương án có ẢNH giữ bố
 * cục dọc (bề rộng thẻ do ảnh quyết định — xem test "phương án có ẢNH").
 *
 * jsdom không layout được — test khoá CLASS container + class thẻ +
 * `data-display-layout`, đúng cách các test bố cục khác trong thư mục này làm.
 */
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SingleChoicePlayer } from "./SingleChoicePlayer";
import { MultiChoicePlayer } from "./MultiChoicePlayer";
import { GradeModeContext, type GradeModeValue } from "./shared";
import { normalizeDisplayLayout } from "@/core/exercise/display-layout";

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

const render = (node: ReactNode, grade?: GradeModeValue) => {
  act(() => {
    root.render(
      grade ? <GradeModeContext.Provider value={grade}>{node}</GradeModeContext.Provider> : node,
    );
  });
};

/** Layout mặc định của manifest khi tác giả không khai display.layout. */
const FALLBACK_LIST = { ...normalizeDisplayLayout("list"), authored: false };

/** Phương án NGẮN như ca `b7_q1` (trung bình ~15 ký tự). */
const short = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ id: `o${i}`, text: `Phòng số ${i}.` }));

/** Phương án là CÂU VĂN (trung bình ~95 ký tự) — vùng "phản tác dụng". */
const longText = (n: number) =>
  Array.from({ length: n }, (_, i) => ({
    id: `o${i}`,
    text:
      `Giữ gìn vệ sinh trường lớp giúp không khí trong lành và bảo vệ sức khoẻ ` +
      `của tất cả học sinh trong trường (${i}).`,
  }));

const box = () => container.querySelector<HTMLElement>("[data-display-layout]")!;
const options = () => [...box().children] as HTMLElement[];

describe("Nhiều phương án ngắn → bố cục ngang (không có layout tác giả khai)", () => {
  it("MultiChoicePlayer: 13 phương án ngắn (ca b7_q1) → flex-wrap, thẻ KHÔNG w-full", () => {
    render(
      <MultiChoicePlayer
        title="Trường học của em có những phòng nào?"
        options={short(13)}
        correctIds={["o0"]}
        layout={FALLBACK_LIST}
      />,
    );
    expect(box().className).toContain("flex-wrap");
    expect(box().className).not.toContain("flex-col");
    expect(box().dataset.displayLayout).toBe("inline");
    expect(options()).toHaveLength(13);
    for (const opt of options()) expect(opt.className).not.toContain("w-full");
  });

  it("SingleChoicePlayer: 5 phương án ngắn (trên 4) → giống HỆT layout `inline` tác giả khai", () => {
    // Chrome không phải phát minh mới: bố cục tự động phải cho ra đúng cùng
    // class thẻ + class container như khi tác giả tự khai display.layout =
    // "inline" (skin nào cũng vậy — studio rounded-xl, học sinh pill joyful).
    render(<SingleChoicePlayer title="Q" options={short(5)} correctId="o0" layout="inline" />);
    const authoredContainer = box().className;
    const authoredCard = options()[0].className;

    render(
      <SingleChoicePlayer title="Q" options={short(5)} correctId="o0" layout={FALLBACK_LIST} />,
    );
    expect(box().className).toBe(authoredContainer);
    expect(box().className).toContain("flex-wrap");
    expect(box().dataset.displayLayout).toBe("inline");
    const first = options()[0];
    expect(first.className).toBe(authoredCard);
    // Nhãn "A." theo sách + a11y giữ nguyên ở bố cục mới.
    expect(first.textContent).toContain("A.");
    expect(box().getAttribute("role")).toBe("radiogroup");
    expect(first.getAttribute("role")).toBe("radio");
    expect(first.getAttribute("aria-checked")).toBe("false");
  });

  it("pill: nội dung phương án bỏ margin-top đầu để căn giữa dọc với nhãn A./B.", () => {
    render(
      <SingleChoicePlayer title="Q" options={short(4)} correctId="o0" layout={FALLBACK_LIST} />,
    );
    // bodyCls mở đầu bằng `mt-1`; pill căn giữa (`items-center`) nên phải trung
    // hoà margin-top đầu, không thì chữ/số lệch xuống dưới nhãn (jsdom không đo
    // layout — khoá bằng class neutralizer, đúng lối các test bố cục khác).
    const bodyWrap = options()[0].querySelector<HTMLElement>(".flex-1");
    expect(bodyWrap?.className).toContain("[&>*:first-child]:mt-0");
  });

  it("đúng 4 phương án → INLINE mặc định (không còn dọc)", () => {
    render(
      <SingleChoicePlayer title="Q" options={short(4)} correctId="o0" layout={FALLBACK_LIST} />,
    );
    expect(box().className).toContain("flex-wrap");
    expect(box().className).not.toContain("flex-col");
    expect(box().dataset.displayLayout).toBe("inline");
  });

  it("layout `list` do TÁC GIẢ khai → vẫn dọc dù có 13 phương án", () => {
    render(<SingleChoicePlayer title="Q" options={short(13)} correctId="o0" layout="list" />);
    expect(box().className).toContain("flex-col");
    expect(box().dataset.displayLayout).toBe("list");
  });

  it("layout `grid_2` do TÁC GIẢ khai → vẫn lưới 2 cột", () => {
    render(<MultiChoicePlayer title="Q" options={short(13)} correctIds={["o0"]} layout="grid_2" />);
    expect(box().className).toContain("sm:grid-cols-2");
    expect(box().dataset.displayLayout).toBe("grid_2");
  });

  it("phương án DÀI (câu văn) → vẫn INLINE mặc định; pill rộng tự xuống dòng riêng", () => {
    render(
      <SingleChoicePlayer title="Q" options={longText(6)} correctId="o0" layout={FALLBACK_LIST} />,
    );
    expect(box().className).toContain("flex-wrap");
    expect(box().dataset.displayLayout).toBe("inline");
  });

  it("phương án có ẢNH → giữ bố cục cũ (bề rộng thẻ do ảnh quyết định)", () => {
    const withImage = short(6).map((opt, i) =>
      i === 0 ? { ...opt, imageUrl: "/hinh.png" } : opt,
    );
    render(
      <SingleChoicePlayer title="Q" options={withImage} correctId="o0" layout={FALLBACK_LIST} />,
    );
    expect(box().className).toContain("flex-col");
  });
});

describe("Bố cục ngang không phá hide-correct / restore", () => {
  it("SingleChoicePlayer: khôi phục lựa chọn đã lưu qua prop `answer`", () => {
    render(
      <SingleChoicePlayer
        title="Q"
        options={short(6)}
        correctId="o0"
        answer="o3"
        layout={FALLBACK_LIST}
      />,
    );
    expect(box().className).toContain("flex-wrap");
    expect(options()[3].getAttribute("aria-checked")).toBe("true");
    expect(options()[1].getAttribute("aria-checked")).toBe("false");
  });

  it("SingleChoicePlayer: revealCorrect=false → ô đúng CHƯA chọn không xanh, ô sai đã chọn đỏ", () => {
    render(
      <SingleChoicePlayer
        title="Q"
        options={short(6)}
        correctId="o0"
        answer="o2"
        submitted
        layout={FALLBACK_LIST}
      />,
      { mode: "parent", result: "incorrect", revealCorrect: false },
    );
    expect(box().className).toContain("flex-wrap");
    expect(options()[0].className).not.toContain("bg-green-50");
    expect(options()[2].className).toContain("bg-red-50");
  });

  it("MultiChoicePlayer: khôi phục nhiều lựa chọn + revealCorrect mặc định vẫn tô ô đúng", () => {
    render(
      <MultiChoicePlayer
        title="Q"
        options={short(7)}
        correctIds={["o1", "o4"]}
        answer={["o1"]}
        submitted
        layout={FALLBACK_LIST}
      />,
      { mode: "parent", result: "incorrect" },
    );
    expect(box().className).toContain("flex-wrap");
    expect(options()[1].getAttribute("aria-checked")).toBe("true");
    expect(options()[4].className).toContain("bg-green-50");
  });
});
