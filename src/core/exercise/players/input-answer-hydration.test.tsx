/**
 * Bước A — NHÓM NHẬP LIỆU/RECORD: kênh khôi phục `answer` cha cấp.
 *
 * Mỗi player mount-với-answer phải khôi phục DOM (không key-remount), và các
 * player có nút "Kiểm tra" phải ẩn nút khi gradeMode = "parent" (cha chấm).
 * Phong cách MatchingHydration.test.tsx: act + createRoot.
 */
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ColoringPlayer } from "./ColoringPlayer";
import { ConfidenceSliderPlayer } from "./ConfidenceSliderPlayer";
import { DictationPlayer } from "./DictationPlayer";
import { DropdownSelectPlayer } from "./DropdownSelectPlayer";
import { LikertPlayer } from "./LikertPlayer";
import { MemoryMatchPlayer } from "./MemoryMatchPlayer";
import { MindMapPlayer } from "./MindMapPlayer";
import { NumericEntryPlayer } from "./NumericEntryPlayer";
import { NumericSliderPlayer } from "./NumericSliderPlayer";
import { PlacePinPlayer } from "./PlacePinPlayer";
import { SemanticDifferentialPlayer } from "./SemanticDifferentialPlayer";
import { StarRatingPlayer } from "./StarRatingPlayer";
import { WordSearchPlayer } from "./WordSearchPlayer";
import { GradeModeContext } from "./shared";

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

function render(element: ReactNode) {
  act(() => root.render(element));
}

function renderParent(element: ReactNode) {
  render(
    <GradeModeContext.Provider value={{ mode: "parent" }}>{element}</GradeModeContext.Provider>,
  );
}

const checkButton = () =>
  Array.from(container.querySelectorAll("button")).find(
    (button) => button.textContent?.trim() === "Kiểm tra",
  );

describe("input/record answer hydration", () => {
  it("NumericEntryPlayer restores the typed number", () => {
    render(<NumericEntryPlayer title="Số" correctAnswer={10} answer={42} />);
    const input = container.querySelector<HTMLInputElement>("input");
    expect(input?.value).toBe("42");
  });

  it("DictationPlayer restores the typed transcript", () => {
    render(<DictationPlayer title="Nghe" acceptedTranscript="xin chào" answer="xin chao" />);
    const textarea = container.querySelector<HTMLTextAreaElement>("textarea");
    expect(textarea?.value).toBe("xin chao");
  });

  it("DropdownSelectPlayer restores the picked option and ignores foreign ids", () => {
    const options = [
      { id: "a", text: "Đáp án A" },
      { id: "b", text: "Đáp án B" },
    ];
    render(<DropdownSelectPlayer title="Chọn" options={options} correctId="a" answer="b" />);
    expect(container.querySelector<HTMLSelectElement>("select")?.value).toBe("b");

    render(
      <DropdownSelectPlayer
        key="foreign"
        title="Chọn"
        options={options}
        correctId="a"
        answer="khong-ton-tai"
      />,
    );
    expect(container.querySelector<HTMLSelectElement>("select")?.value).toBe("");
  });

  it("PlacePinPlayer restores the dropped pin", () => {
    render(
      <PlacePinPlayer
        title="Ghim"
        imageUrl="img.png"
        target={{ x: 0.5, y: 0.5 }}
        answer={{ x: 0.25, y: 0.75 }}
      />,
    );
    expect(container.textContent).toContain("📍");
    // Bấm lại để đổi vị trí — chỉ hiện khi đã có pin.
    expect(container.textContent).toContain("đổi vị trí ghim");
  });

  it("WordSearchPlayer restores found words and drops entries not in the key", () => {
    render(
      <WordSearchPlayer
        title="Tìm từ"
        grid={[
          ["A", "B"],
          ["C", "D"],
        ]}
        words={["AB", "CD"]}
        answer={[
          { word: "AB", cells: [[0, 0], [0, 1]] },
          { word: "XX", cells: [[9, 9]] },
          "rác",
        ]}
      />,
    );
    const cells = Array.from(container.querySelectorAll<HTMLButtonElement>("button"));
    // 4 ô lưới; hàng đầu (AB) đã tìm thấy → tô xanh, hàng dưới chưa.
    expect(cells).toHaveLength(4);
    expect(cells[0].className).toContain("bg-green-200");
    expect(cells[1].className).toContain("bg-green-200");
    expect(cells[2].className).not.toContain("bg-green-200");
    expect(cells[3].className).not.toContain("bg-green-200");
  });

  it("MemoryMatchPlayer restores matched pairs from the emitted pair-id array", () => {
    render(
      <MemoryMatchPlayer
        title="Ghép thẻ"
        pairs={[
          { id: "p1", a: { text: "Mèo" }, b: { text: "Cat" } },
          { id: "p2", a: { text: "Chó" }, b: { text: "Dog" } },
        ]}
        answer={["p1", "bogus"]}
      />,
    );
    expect(container.textContent).toContain("Đã ghép: 1 / 2 cặp");
  });

  it("LikertPlayer restores the picked point (self-report shows Đã ghi nhận)", () => {
    render(
      <LikertPlayer
        title="Mức độ"
        points={[
          { value: 1, label: "Ít" },
          { value: 2, label: "Vừa" },
          { value: 3, label: "Nhiều" },
        ]}
        answer={2}
      />,
    );
    expect(container.textContent).toContain("Đã ghi nhận");
  });

  it("SemanticDifferentialPlayer restores the per-pair picks", () => {
    render(
      <SemanticDifferentialPlayer
        title="Thang"
        pairs={[{ id: "p1", leftLabel: "Nóng", rightLabel: "Lạnh" }]}
        answer={{ p1: 4 }}
      />,
    );
    const dot = container.querySelector<HTMLButtonElement>('[aria-label="Nóng–Lạnh: 4/7"]');
    const idleDot = container.querySelector<HTMLButtonElement>('[aria-label="Nóng–Lạnh: 3/7"]');
    // Điểm 4 khôi phục ở trạng thái selected — style khác hẳn điểm chưa chọn.
    expect(dot?.className).not.toBe(idleDot?.className);
    expect(container.textContent).toContain("Đã ghi nhận");
  });

  it("StarRatingPlayer restores the rating", () => {
    render(<StarRatingPlayer title="Sao" answer={3} />);
    expect(container.textContent).toContain("3 / 5");
  });

  it("ConfidenceSliderPlayer restores the value AND the touched flag", () => {
    render(<ConfidenceSliderPlayer title="Tự tin" answer={80} />);
    expect(container.textContent).toContain("80%");
    // touched khôi phục — không có nó "Đã ghi nhận" biến mất dù đã có đáp án.
    expect(container.textContent).toContain("Đã ghi nhận");
    expect(container.querySelector<HTMLInputElement>('input[type="range"]')?.value).toBe("80");
  });

  it("NumericSliderPlayer restores the value AND the touched flag", () => {
    render(<NumericSliderPlayer title="Trượt" min={0} max={10} answer={7} />);
    expect(container.querySelector<HTMLInputElement>('input[type="range"]')?.value).toBe("7");
    expect(container.textContent).toContain("Đã ghi nhận");
  });

  it("ColoringPlayer restores fills and drops entries for unknown regions", () => {
    render(
      <ColoringPlayer
        title="Tô màu"
        regions={[
          { id: "r1", label: "Lá" },
          { id: "r2", label: "Hoa" },
        ]}
        answer={[
          { regionId: "r1", color: "#ef4444" },
          { regionId: "zz", color: "#000000" },
        ]}
      />,
    );
    const leaf = Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find(
      (button) => button.textContent?.trim() === "Lá",
    );
    expect(leaf?.style.backgroundColor).toBe("rgb(239, 68, 68)");
    const flower = Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find(
      (button) => button.textContent?.trim() === "Hoa",
    );
    expect(flower?.style.backgroundColor).toBe("");
  });

  it("MindMapPlayer restores nodes and edges from the emitted answer", () => {
    render(
      <MindMapPlayer
        title="Sơ đồ"
        answer={{
          nodes: [{ id: "n1", label: "Nhánh khôi phục" }],
          edges: [{ from: "__root__", to: "n1" }],
        }}
      />,
    );
    expect(container.textContent).toContain("Nhánh khôi phục");
  });

  it("rehydrates when the parent supplies a semantically different answer (no remount)", () => {
    render(<DictationPlayer title="Nghe" acceptedTranscript="xin chào" answer="một" />);
    expect(container.querySelector<HTMLTextAreaElement>("textarea")?.value).toBe("một");

    render(<DictationPlayer title="Nghe" acceptedTranscript="xin chào" answer="hai" />);
    expect(container.querySelector<HTMLTextAreaElement>("textarea")?.value).toBe("hai");
  });
});

describe("parent grade mode hides the self-check button", () => {
  it("NumericEntryPlayer", () => {
    render(<NumericEntryPlayer title="Số" correctAnswer={10} instantFeedback={false} />);
    expect(checkButton()).toBeTruthy();
    renderParent(
      <NumericEntryPlayer key="p" title="Số" correctAnswer={10} instantFeedback={false} />,
    );
    expect(checkButton()).toBeUndefined();
  });

  it("DictationPlayer", () => {
    render(<DictationPlayer title="Nghe" acceptedTranscript="a" instantFeedback={false} />);
    expect(checkButton()).toBeTruthy();
    renderParent(
      <DictationPlayer key="p" title="Nghe" acceptedTranscript="a" instantFeedback={false} />,
    );
    expect(checkButton()).toBeUndefined();
  });

  it("PlacePinPlayer", () => {
    const props = { title: "Ghim", imageUrl: "img.png", target: { x: 0.5, y: 0.5 } };
    render(<PlacePinPlayer {...props} />);
    expect(checkButton()).toBeTruthy();
    renderParent(<PlacePinPlayer key="p" {...props} />);
    expect(checkButton()).toBeUndefined();
  });

  it("LikertPlayer", () => {
    const props = { title: "Mức độ", points: [{ value: 1, label: "Ít" }], correctValue: 1 };
    render(<LikertPlayer {...props} />);
    expect(checkButton()).toBeTruthy();
    renderParent(<LikertPlayer key="p" {...props} />);
    expect(checkButton()).toBeUndefined();
  });

  it("SemanticDifferentialPlayer", () => {
    const props = {
      title: "Thang",
      pairs: [{ id: "p1", leftLabel: "Nóng", rightLabel: "Lạnh" }],
      correctValues: { p1: 4 },
    };
    render(<SemanticDifferentialPlayer {...props} />);
    expect(checkButton()).toBeTruthy();
    renderParent(<SemanticDifferentialPlayer key="p" {...props} />);
    expect(checkButton()).toBeUndefined();
  });

  it("StarRatingPlayer", () => {
    render(<StarRatingPlayer title="Sao" correctValue={4} />);
    expect(checkButton()).toBeTruthy();
    renderParent(<StarRatingPlayer key="p" title="Sao" correctValue={4} />);
    expect(checkButton()).toBeUndefined();
  });

  it("ConfidenceSliderPlayer", () => {
    render(<ConfidenceSliderPlayer title="Tự tin" correctValue={80} />);
    expect(checkButton()).toBeTruthy();
    renderParent(<ConfidenceSliderPlayer key="p" title="Tự tin" correctValue={80} />);
    expect(checkButton()).toBeUndefined();
  });

  it("NumericSliderPlayer", () => {
    render(<NumericSliderPlayer title="Trượt" min={0} max={10} correctValue={7} />);
    expect(checkButton()).toBeTruthy();
    renderParent(<NumericSliderPlayer key="p" title="Trượt" min={0} max={10} correctValue={7} />);
    expect(checkButton()).toBeUndefined();
  });
});
