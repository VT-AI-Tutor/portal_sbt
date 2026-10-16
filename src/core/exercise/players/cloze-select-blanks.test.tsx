/**
 * II.7 "Điền khuyết bằng chọn đáp án" — ô trống có `options` render thành
 * dropdown ngay trong câu.
 *
 * Điểm cốt lõi của thiết kế: `options` là CHUỖI THUẦN, nên giá trị học sinh
 * chọn chính là chuỗi đem so với `acceptedAnswers`. Nhờ vậy KHÔNG phát sinh
 * luật chấm mới ở đâu cả — `matchBlank` cũ, `gradeByType` cũ, PHP cũ. Test
 * cuối file khoá đúng tính chất đó lại.
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ClozePlayer } from "./ClozePlayer";
import { renderInteractionPlayer } from "./dispatch";
import { gradeByType } from "@/core/exercise/grading";

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

const selectLines = [
  {
    id: "L1",
    segments: [
      { text: "Thủ đô Việt Nam là " },
      {
        blankId: "b1",
        acceptedAnswers: ["Hà Nội"],
        options: ["Hà Nội", "Huế", "Đà Nẵng"],
      },
    ],
  },
];

function selects() {
  return Array.from(container.querySelectorAll("select"));
}

function pick(el: HTMLSelectElement, value: string) {
  act(() => {
    el.value = value;
    el.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

describe("II.7 — ô trống dạng chọn đáp án", () => {
  it("ô có options render <select> kèm đủ lựa chọn, mặc định chưa chọn gì", () => {
    act(() => root.render(<ClozePlayer title="Q" lines={selectLines} />));

    const el = selects()[0];
    expect(el).toBeTruthy();
    expect(container.querySelectorAll("input")).toHaveLength(0);
    // 3 lựa chọn + 1 mục trống dẫn nhập
    expect(el.querySelectorAll("option")).toHaveLength(4);
    expect(el.value).toBe("");
  });

  /** Ô gõ tay chấm lúc blur; dropdown chọn xong là biết ngay, không bắt bấm ra ngoài. */
  it("chọn xong chấm NGAY, không cần blur", () => {
    const onElementGraded = vi.fn();
    act(() =>
      root.render(
        <ClozePlayer title="Q" lines={selectLines} onElementGraded={onElementGraded} />,
      ),
    );

    pick(selects()[0], "Hà Nội");
    expect(onElementGraded).toHaveBeenCalledWith("b1", "correct", undefined);
  });

  /**
   * Chốt chặn cho lỗi một-nhịp: `gradeOne` đọc state `values`, mà setState chưa
   * kịp vào lúc `onChange` chạy. Nếu quên truyền giá trị vừa chọn xuống thì lần
   * chọn đầu tiên luôn bị chấm theo giá trị CŨ (rỗng).
   */
  it("chọn sai rồi chọn đúng: verdict bám đúng lựa chọn hiện tại, không trễ một nhịp", () => {
    const onElementGraded = vi.fn();
    act(() =>
      root.render(
        <ClozePlayer title="Q" lines={selectLines} onElementGraded={onElementGraded} />,
      ),
    );

    pick(selects()[0], "Huế");
    expect(onElementGraded).toHaveBeenLastCalledWith("b1", "incorrect", undefined);

    pick(selects()[0], "Hà Nội");
    expect(onElementGraded).toHaveBeenLastCalledWith("b1", "correct", undefined);
  });

  it("báo đáp án lên cha qua kênh Record<blankId, giá trị>", () => {
    const onAnswerChange = vi.fn();
    act(() =>
      root.render(
        <ClozePlayer title="Q" lines={selectLines} onAnswerChange={onAnswerChange} />,
      ),
    );

    pick(selects()[0], "Huế");
    expect(onAnswerChange).toHaveBeenLastCalledWith({ b1: "Huế" });
  });

  it("hydrate lại lựa chọn cũ khi quay lại câu", () => {
    act(() =>
      root.render(<ClozePlayer title="Q" lines={selectLines} answer={{ b1: "Đà Nẵng" }} />),
    );
    expect(selects()[0].value).toBe("Đà Nẵng");
  });

  /** Cùng một câu trộn được hai kiểu ô — đây là lý do dùng cờ theo TỪNG ô. */
  it("ô không có options vẫn là ô gõ tay, trộn chung một câu được", () => {
    const mixed = [
      {
        id: "L1",
        segments: [
          { text: "Chọn: " },
          { blankId: "b1", acceptedAnswers: ["Hà Nội"], options: ["Hà Nội", "Huế"] },
          { text: " — Gõ: " },
          { blankId: "b2", acceptedAnswers: ["9"] },
        ],
      },
    ];
    act(() => root.render(<ClozePlayer title="Q" lines={mixed} />));

    expect(selects()).toHaveLength(1);
    expect(container.querySelectorAll("input")).toHaveLength(1);
  });

  it("options rỗng thì về lại ô gõ tay, không render dropdown trống", () => {
    const empty = [
      { id: "L1", segments: [{ blankId: "b1", acceptedAnswers: ["x"], options: [] }] },
    ];
    act(() => root.render(<ClozePlayer title="Q" lines={empty} />));

    expect(selects()).toHaveLength(0);
    expect(container.querySelectorAll("input")).toHaveLength(1);
  });

  it('khối "Đáp án đúng" vẫn liệt kê như ô gõ tay', () => {
    act(() => root.render(<ClozePlayer title="Q" lines={selectLines} submitted />));
    expect(container.textContent).toContain("Hà Nội");
  });
});

/**
 * `options` cấp PAYLOAD (dùng chung mọi ô) đã nằm trong spec §5.6.2 từ trước
 * — biến thể `picture`, kiểu "Điền ai, ay hay ây?" — nhưng chưa ai cài, nên
 * Tiếng Việt 1 bài 38 (6 ô, options ["ai","ay","ây"]) đang render ô GÕ TAY
 * trong khi tác giả muốn dropdown. Đường này sửa luôn lỗi đó.
 */
describe("II.7 — options dùng chung cấp payload", () => {
  const payload = {
    options: ["ai", "ay", "ây"],
    blanks: [{ id: "b1" }, { id: "b2" }],
    correctAnswer: { b1: "ây", b2: "ay" },
    content: {
      blocks: [{ type: "paragraph", text: "lùm c___[b1]___ và m___[b2]___ bay" }],
    },
  };

  it("mọi ô đều thành dropdown dù không ô nào tự khai options", () => {
    act(() =>
      root.render(
        <>{renderInteractionPlayer("cloze", payload, { questionId: "q" })}</>,
      ),
    );
    expect(selects()).toHaveLength(2);
    expect(container.querySelectorAll("input")).toHaveLength(0);
  });

  it("ô tự khai options thì ĐÈ lên danh sách dùng chung", () => {
    act(() =>
      root.render(
        <>
          {renderInteractionPlayer(
            "cloze",
            {
              ...payload,
              blanks: [{ id: "b1", options: ["x", "y"] }, { id: "b2" }],
            },
            { questionId: "q" },
          )}
        </>,
      ),
    );
    const [first, second] = selects();
    // ô riêng: 2 lựa chọn + mục trống · ô dùng chung: 3 + mục trống
    expect(first.querySelectorAll("option")).toHaveLength(3);
    expect(second.querySelectorAll("option")).toHaveLength(4);
  });
});

/**
 * Đây là tính chất làm cả thiết kế này rẻ: KHÔNG có case chấm nào cho "cloze có
 * options". Nếu ai đó sau này đổi `options` sang dạng {id,text} thì test này đỏ
 * và nhắc rằng phải sửa luật chấm ở CẢ client lẫn PHP.
 */
describe("II.7 — chấm điểm không cần luật mới", () => {
  const schema = {
    blanks: [
      { id: "b1", options: ["Hà Nội", "Huế"] },
      { id: "b2", options: ["9", "10"] },
    ],
    correctAnswer: { b1: "Hà Nội", b2: "9" },
  };

  it("gradeByType('cloze') chấm đúng lựa chọn mà không cần biết tới options", () => {
    expect(
      gradeByType("cloze", schema, undefined, { b1: "Hà Nội", b2: "9" }),
    ).toEqual({ isCorrect: true, gradable: true });

    expect(
      gradeByType("cloze", schema, undefined, { b1: "Huế", b2: "9" }),
    ).toEqual({ isCorrect: false, gradable: true });
  });

  it("thiếu một ô là sai, không phải bỏ qua", () => {
    expect(gradeByType("cloze", schema, undefined, { b1: "Hà Nội" })).toEqual({
      isCorrect: false,
      gradable: true,
    });
  });
});
