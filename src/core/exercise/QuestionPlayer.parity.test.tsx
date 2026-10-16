/**
 * Chốt chặn cho 3 prop facade `QuestionPlayer` port lại từ studio-web
 * (`instantFeedback`, `disabled`, `result` dạng giàu).
 *
 * Vì sao cần pin: tầng dispatch bên web VẪN hỗ trợ đủ cả 3, chỉ entry point bị
 * rút gọn ở sóng 1 nên không màn nào bật được. Test dưới `players/` bơm
 * PlayerHandlers/GradeModeContext THẲNG vào dispatch, nên chúng không hề đi qua
 * mặt tiền này — nếu ai đó lại xoá prop khỏi facade thì không test nào khác đỏ.
 *
 * Ràng buộc kèm theo: đây là THÊM CÔNG TẮC, không đổi mặc định. Mỗi ca đều có
 * ca đối chứng "không truyền prop" khẳng định hành vi hôm nay giữ nguyên.
 */
import { act, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QuestionPlayer, type PlayerQuestion } from "./QuestionPlayer";

vi.mock("./tasks/AudioUtils", () => ({
  playSuccess: vi.fn(),
  playError: vi.fn(),
}));

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
  vi.restoreAllMocks();
});

function render(element: ReactElement) {
  act(() => root.render(element));
}

/** Cloze: cách quan sát `instantFeedback` rẻ nhất — chấm ngay thì KHÔNG có nút
 * "Kiểm tra", chấm theo nút thì nút hiện ra (xem ClozePlayer.test.tsx). */
const clozeQuestion: PlayerQuestion = {
  id: "q-cloze",
  question_type: "cloze",
  payload: {
    type: "cloze",
    display: { interactionType: "inline" },
    content: { blocks: [{ type: "paragraph", text: "Thủ đô Việt Nam là {blank_1}." }] },
    correctAnswer: { blank_1: "Hà Nội" },
  },
};

function choiceChild(id: string, stem: string) {
  return {
    id,
    type: "single_choice",
    content: { blocks: [{ type: "paragraph", text: stem }] },
    options: [
      { id: "a", content: { blocks: [{ type: "paragraph", text: "A" }] } },
      { id: "b", content: { blocks: [{ type: "paragraph", text: "B" }] } },
    ],
    correctAnswer: "a",
  };
}

const groupQuestion: PlayerQuestion = {
  id: "q-group",
  question_type: "question_group",
  payload: {
    type: "question_group",
    sharedContent: { blocks: [{ type: "paragraph", text: "Trả lời hai ý sau." }] },
    questions: [choiceChild("c1", "Ý thứ nhất?"), choiceChild("c2", "Ý thứ hai?")],
  },
};

const text = () => container.textContent ?? "";
const countOf = (needle: string) => text().split(needle).length - 1;

// ---------------------------------------------------------------------------
// 1. instantFeedback
// ---------------------------------------------------------------------------

describe("QuestionPlayer — prop instantFeedback (parity studio)", () => {
  it("KHÔNG truyền → giữ nguyên hành vi hôm nay: chấm ngay, không nút Kiểm tra", () => {
    // Facade cố ý để undefined chảy xuống; dispatch tự `?? true`. Đây là ca
    // khoá "không đổi mặc định của mọi màn đang chạy".
    render(<QuestionPlayer question={clozeQuestion} index={0} />);
    expect(text()).not.toContain("Kiểm tra");
  });

  it("instantFeedback={false} → xuống tới player: hiện nút Kiểm tra (chỉ ghi đáp án)", () => {
    render(<QuestionPlayer question={clozeQuestion} index={0} instantFeedback={false} />);
    expect(text()).toContain("Kiểm tra");
  });

  it("instantFeedback={true} truyền tường minh → vẫn là chấm ngay", () => {
    render(<QuestionPlayer question={clozeQuestion} index={0} instantFeedback />);
    expect(text()).not.toContain("Kiểm tra");
  });
});

// ---------------------------------------------------------------------------
// 2. disabled
// ---------------------------------------------------------------------------

describe("QuestionPlayer — prop disabled (parity studio)", () => {
  it("disabled → khoá input NHƯNG không hàm ý đã nộp (không verdict, không banner)", () => {
    render(<QuestionPlayer question={clozeQuestion} index={0} disabled />);

    const fieldset = container.querySelector<HTMLFieldSetElement>(
      'fieldset[data-player-disabled="true"]',
    );
    expect(fieldset).not.toBeNull();
    expect(fieldset?.disabled).toBe(true);
    expect(fieldset?.getAttribute("aria-disabled")).toBe("true");

    // KHÁC `submitted`: không một mảnh chrome chấm/nộp nào được lộ ra.
    expect(text()).not.toContain("Đúng rồi");
    expect(text()).not.toContain("Chưa đúng");
    expect(text()).not.toContain("Đã ghi nhận câu trả lời.");
  });

  it("KHÔNG truyền disabled → không có fieldset khoá (hành vi hôm nay)", () => {
    render(<QuestionPlayer question={clozeQuestion} index={0} />);
    expect(container.querySelector("fieldset[data-player-disabled]")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 3. result dạng giàu
// ---------------------------------------------------------------------------

// Lưu ý về sức khoẻ của chốt chặn này: hai ca Record dưới đây RUNTIME vẫn xanh
// trên bản facade cũ (facade chuyền `result` nguyên xi, chỉ KIỂU là hẹp). Cái
// khoá chúng là `tsc --noEmit` — bản cũ báo TS2322 "Type '{ c1; c2 }' is not
// assignable to '\"correct\" | \"incorrect\" | \"incomplete\"'". Đừng gỡ chúng
// khỏi cổng typecheck. Hai prop kia thì đỏ ngay ở runtime (đã đối chứng).
describe("QuestionPlayer — prop result dạng Record (parity studio)", () => {
  it("Record<childId, verdict> → mỗi câu con của question_group hiện verdict RIÊNG", () => {
    render(
      <QuestionPlayer
        question={groupQuestion}
        index={0}
        submitted
        gradeMode="parent"
        result={{ c1: "correct", c2: "incorrect" }}
      />,
    );
    expect(countOf("Đúng rồi!")).toBe(1);
    expect(countOf("Chưa đúng")).toBe(1);
  });

  it("bọc trong { results } → cùng kết quả (envelope của server)", () => {
    render(
      <QuestionPlayer
        question={groupQuestion}
        index={0}
        submitted
        gradeMode="parent"
        result={{ results: { c1: "incorrect", c2: "correct" } }}
      />,
    );
    expect(countOf("Đúng rồi!")).toBe(1);
    expect(countOf("Chưa đúng")).toBe(1);
  });

  it("chuỗi verdict đơn vẫn chạy y như cũ (mọi call site hiện tại truyền dạng này)", () => {
    render(
      <QuestionPlayer
        question={clozeQuestion}
        index={0}
        submitted
        gradeMode="parent"
        result="correct"
      />,
    );
    expect(text()).toContain("Đúng rồi!");
  });
});
