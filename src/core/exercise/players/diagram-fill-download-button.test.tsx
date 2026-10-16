import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderInteractionPlayer } from "./dispatch";
import { QuestionPlayer, type PlayerQuestion } from "@/core/exercise/QuestionPlayer";

/**
 * web-own: nút "Tải ảnh bài làm" của câu diagram_fill có ảnh nền.
 *
 * File RIÊNG (studio không có) nên bước copy khi sync không đè — cùng lý do và
 * cùng kiểu với diagram-fill-answer-reveal.test.tsx.
 *
 * Ca quan trọng nhất là ca ĐANG TẢI: máy chủ ảnh đo được 4,9 KB/s ngày
 * 22/09/2026, tấm phiếu 2MB mất khoảng 7 phút. Trong suốt khoảng đó canvas
 * chưa có gì để vẽ, nên nút phải TỰ KHOÁ — để bấm được rồi mới báo lỗi là bắt
 * học sinh đoán xem mình làm sai ở đâu.
 */

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

/** Thư mục ảnh của VBT Đạo đức 2 — câu b5_q7_a nằm trong danh sách được tải. */
const DD2_ASSETS =
  "https://cdn.example.com/sbt/book-assets/63aa91ed-14dd-4b73-a377-ac3a3e33821d/assets/images/";
/** Cùng phiếu sau khi upload lại asset: thư mục UUID đổi, tên file giữ nguyên. */
const REUPLOADED_IMAGE =
  "https://cdn.example.com/sbt/book-assets/5b0e2c1d-0000-4000-8000-000000000000/assets/images/bai5_q7.png";

const PAYLOAD = {
  id: "b5_q7_a",
  backgroundImage: `${DD2_ASSETS}bai5_q7.png`,
  nodes: [
    { id: "sang_t2", label: "Sáng - Thứ Hai", fillable: true, x: 0.215, y: 0.6, width: 0.09, height: 0.11 },
    { id: "sang_t3", label: "Sáng - Thứ Ba", fillable: true, x: 0.314, y: 0.6, width: 0.09, height: 0.11 },
  ],
  edges: [],
  selfAssessment: true,
};

const render = (payload: Record<string, unknown>) => {
  act(() => {
    root.render(renderInteractionPlayer("diagram_fill", payload as never, {} as never));
  });
};

const downloadButton = () =>
  Array.from(container.querySelectorAll("button")).find((b) =>
    /Tải ảnh bài làm|Đang tải phiếu/.test(b.textContent ?? ""),
  );

/**
 * Đưa thẻ ảnh về ĐÚNG trạng thái của một ảnh đã giải mã xong: `complete`,
 * `currentSrc` và kích thước, rồi mới phát `load`. Thiếu `complete`/`currentSrc`
 * thì mọi ca đều thoát sớm ở guard của effect và nhánh đó không được phủ.
 */
const finishImageLoad = (naturalWidth: number, naturalHeight: number) => {
  const img = container.querySelector<HTMLImageElement>("[data-diagram-background] img")!;
  Object.defineProperty(img, "complete", { value: true, configurable: true });
  Object.defineProperty(img, "currentSrc", { value: img.src, configurable: true });
  Object.defineProperty(img, "naturalWidth", { value: naturalWidth, configurable: true });
  Object.defineProperty(img, "naturalHeight", { value: naturalHeight, configurable: true });
  act(() => img.dispatchEvent(new Event("load", { bubbles: false })));
};

describe("nút tải ảnh bài làm", () => {
  it("khoá nút khi ảnh nền CHƯA tải xong, và nói rõ là đang tải", () => {
    render(PAYLOAD);
    const button = downloadButton();
    expect(button).toBeDefined();
    expect(button!.textContent).toContain("Đang tải phiếu");
    expect(button!.disabled).toBe(true);
  });

  it("mở nút ngay khi ảnh nền tải xong", () => {
    render(PAYLOAD);
    finishImageLoad(2023, 1349);

    const button = downloadButton()!;
    expect(button.textContent).toContain("Tải ảnh bài làm");
    expect(button.disabled).toBe(false);
  });

  it("ảnh tải xong nhưng không đo được cỡ (SVG thiếu width/height) thì ẨN nút", () => {
    // Không được để nhãn "Đang tải phiếu…" treo vĩnh viễn: ảnh đã hiện đủ trên
    // màn, chờ thêm cũng không bao giờ xuất được.
    render(PAYLOAD);
    finishImageLoad(0, 0);
    expect(downloadButton()).toBeUndefined();
  });

  it("ảnh đã nằm sẵn trong cache (onLoad không nổ) vẫn mở được nút", () => {
    render(PAYLOAD);
    const image = container.querySelector<HTMLImageElement>("[data-diagram-background] img")!;
    // Không phát sự kiện load: mô phỏng ảnh cache xong trước khi thẻ gắn handler.
    Object.defineProperty(image, "complete", { value: true, configurable: true });
    Object.defineProperty(image, "naturalWidth", { value: 2023, configurable: true });
    Object.defineProperty(image, "naturalHeight", { value: 1349, configurable: true });
    Object.defineProperty(image, "currentSrc", { value: image.src, configurable: true });
    render(PAYLOAD);

    expect(downloadButton()!.textContent).toContain("Tải ảnh bài làm");
    expect(downloadButton()!.disabled).toBe(false);
  });

  it("đổi sang ảnh nền khác thì KHÔNG giữ lại kích thước của ảnh cũ", () => {
    // React dùng lại cùng thẻ <img> khi chỉ đổi src, và có một nhịp `complete`
    // còn true kèm kích thước ảnh CŨ. Vớ lấy nhịp đó là đặt sai aspectRatio của
    // khung → ảnh bị kéo méo và mọi ô nhập lệch khỏi hình vẽ.
    render(PAYLOAD);
    finishImageLoad(2000, 1000); // tỉ lệ 2:1
    const canvas = () => container.querySelector<HTMLElement>('[data-diagram-layout="coordinates"]')!;
    expect(canvas().style.aspectRatio).toContain("2");

    const image = container.querySelector<HTMLImageElement>("[data-diagram-background] img")!;
    const anhCu = image.src;
    render({ ...PAYLOAD, backgroundImage: REUPLOADED_IMAGE });

    // Thẻ cũ được dùng lại: `src` ĐÃ là ảnh mới, nhưng `complete`, cỡ và
    // `currentSrc` vẫn của ảnh CŨ. Đây là cửa sổ mà guard phải chặn — và chỉ
    // chặn được nhờ so currentSrc với src, không phải nhờ currentSrc rỗng.
    Object.defineProperty(image, "complete", { value: true, configurable: true });
    Object.defineProperty(image, "currentSrc", { value: anhCu, configurable: true });
    Object.defineProperty(image, "naturalWidth", { value: 2000, configurable: true });
    Object.defineProperty(image, "naturalHeight", { value: 1000, configurable: true });
    expect(image.currentSrc).not.toBe(image.src);
    render({ ...PAYLOAD, backgroundImage: REUPLOADED_IMAGE });

    // Chưa có onLoad của ảnh MỚI ⇒ phải rơi về mặc định 4/3, không mượn 2:1.
    expect(canvas().style.aspectRatio).not.toContain("2");
    expect(downloadButton()!.textContent).toContain("Đang tải phiếu");
  });

  it("không có ảnh nền thì không có nút — chẳng có gì để vẽ lên", () => {
    render({ nodes: [{ id: "n1", label: "?", fillable: true }], edges: [] });
    expect(downloadButton()).toBeUndefined();
  });

  it("nút vẫn mở khi chưa điền ô nào — bản trắng là thứ để in ra viết tay", () => {
    render(PAYLOAD);
    finishImageLoad(2023, 1349);

    const inputs = Array.from(container.querySelectorAll("input"));
    expect(inputs.every((i) => i.value === "")).toBe(true);
    expect(downloadButton()!.disabled).toBe(false);
  });

  it("ảnh lỗi lượt đầu thì hạ cờ CORS và nạp lại; lỗi tiếp lượt hai mới là ảnh hỏng", () => {
    render(PAYLOAD);
    const canvas = container.querySelector<HTMLElement>('[data-diagram-layout="coordinates"]')!;
    const withCors = canvas.querySelector<HTMLImageElement>("img")!;
    expect(withCors.getAttribute("crossorigin")).toBe("anonymous");
    act(() => withCors.dispatchEvent(new Event("error", { bubbles: false })));

    const withoutCors = canvas.querySelector<HTMLImageElement>("img")!;
    expect(withoutCors.getAttribute("crossorigin")).toBeNull();
    expect(canvas.dataset.diagramBackground).toBe("image");
    expect(downloadButton()).toBeUndefined();

    act(() => withoutCors.dispatchEvent(new Event("error", { bubbles: false })));
    expect(canvas.dataset.diagramBackground).toBe("fallback");
    expect(canvas.querySelector("img")).toBeNull();
    expect(canvas.querySelector("input")).not.toBeNull();
  });
});

describe("chỉ câu được phép mới có nút tải", () => {
  it("câu diagram_fill khác có ảnh nền: không nút, nạp ảnh không xin CORS", () => {
    render({ ...PAYLOAD, id: "b20_q1", backgroundImage: "/uploads/so-do-toan.png" });
    finishImageLoad(2023, 1349);
    expect(downloadButton()).toBeUndefined();
    const img = container.querySelector<HTMLImageElement>("[data-diagram-background] img")!;
    expect(img.getAttribute("crossorigin")).toBeNull();
  });

  it("upload lại asset sang thư mục UUID mới: vẫn có nút", () => {
    render({ ...PAYLOAD, backgroundImage: REUPLOADED_IMAGE });
    expect(downloadButton()).toBeDefined();
  });

  it("cùng mã b5_q7_a nhưng khác file ảnh: không nút", () => {
    render({ ...PAYLOAD, backgroundImage: `${DD2_ASSETS}bai5_q7_khac.png` });
    finishImageLoad(2023, 1349);
    expect(downloadButton()).toBeUndefined();
  });

  it("cờ answerImageDownload: true trong payload bật nút cho câu ngoài danh sách", () => {
    render({ ...PAYLOAD, id: "b20_q1", backgroundImage: "/uploads/so-do-toan.png", answerImageDownload: true });
    expect(downloadButton()).toBeDefined();
  });

  it("cờ answerImageDownload: false trong payload thắng danh sách", () => {
    render({ ...PAYLOAD, answerImageDownload: false });
    finishImageLoad(2023, 1349);
    expect(downloadButton()).toBeUndefined();
  });
});

// QuestionPlayer đặt questionId = question.id (UUID DB); câu con nhận
// "<uuid>/<mã câu con>" — không bao giờ là mã payload, nên khoá theo payload.id.
describe("khoá theo mã payload, không theo questionId của runner", () => {
  const GROUP_QUESTION_ID = "c29a6887-d798-4f12-9af5-5559e9e3814e";
  const renderQuestion = (payload: Record<string, unknown>, questionId = GROUP_QUESTION_ID) => {
    const question: PlayerQuestion = { id: questionId, question_type: String(payload.type), payload };
    act(() => {
      root.render(<QuestionPlayer question={question} index={0} />);
    });
  };

  it("hình dạng thật: câu con b5_q7_a trong question_group b5_q7", () => {
    renderQuestion({ id: "b5_q7", type: "question_group", questions: [{ ...PAYLOAD, type: "diagram_fill" }] });
    expect(downloadButton()).toBeDefined();
  });

  it("b5_q7_a đứng riêng (top-level) vẫn có nút", () => {
    renderQuestion({ ...PAYLOAD, type: "diagram_fill" });
    expect(downloadButton()).toBeDefined();
  });

  it("payload thiếu id thì không lấy questionId thay vào", () => {
    const { id: _boId, ...payloadKhongId } = PAYLOAD;
    renderQuestion({ ...payloadKhongId, type: "diagram_fill" }, "b5_q7_a");
    finishImageLoad(2023, 1349);
    expect(downloadButton()).toBeUndefined();
  });
});
