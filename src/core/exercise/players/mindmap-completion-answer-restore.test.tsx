import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { renderInteractionPlayer } from "./dispatch";

// mind_map_completion là player duy nhất bị đứt kênh khôi phục: dispatch không
// chuyển `handlers.answer` xuống MindMapTask, nên mỗi lần runner remount câu
// (chuyển câu, vào màn xem lại sau khi nộp) các ô đã điền hiện trống — học
// sinh thấy "đáp án không được lưu" và màn kết quả không còn bài làm.

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

const payload = {
  type: "mind_map_completion",
  content: { blocks: [{ type: "paragraph", text: "Hoàn thành sơ đồ sau" }] },
  nodes: [
    { id: "node_1", label: "Môn học", nodeType: "static" },
    { id: "node_2", nodeType: "input", acceptedAnswers: "Văn" },
    { id: "node_3", nodeType: "input", acceptedAnswers: "Hóa" },
  ],
  edges: [
    { from: "node_1", to: "node_2" },
    { from: "node_1", to: "node_3" },
  ],
};

describe("mind_map_completion answer restore", () => {
  it("passes the parent-owned answer through dispatch so saved work is rendered", () => {
    act(() =>
      root.render(
        renderInteractionPlayer("mind_map_completion", payload, {
          answer: { node_2: "Văn", node_3: "Hóa" },
          onAnswerChange: () => {},
        }),
      ),
    );

    const values = Array.from(container.querySelectorAll("input")).map(
      (el) => el.value,
    );
    expect(values).toEqual(["Văn", "Hóa"]);
  });

  it("locks the inputs after submit while still showing the restored answer", () => {
    act(() =>
      root.render(
        renderInteractionPlayer("mind_map_completion", payload, {
          answer: { node_2: "Văn", node_3: "Hóa" },
          onAnswerChange: () => {},
          submitted: true,
        }),
      ),
    );

    const inputs = Array.from(container.querySelectorAll("input"));
    expect(inputs.map((el) => el.value)).toEqual(["Văn", "Hóa"]);
    expect(inputs.every((el) => el.disabled)).toBe(true);
  });
});
