import { act, StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useInstantGrading } from "./shared";
import type { InstantProgress } from "./shared";

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

// Test harness: expose the hook's api via a ref-like callback.
function mount(opts: Parameters<typeof useInstantGrading>[0], onApi: (api: ReturnType<typeof useInstantGrading>) => void) {
  function Probe() {
    const api = useInstantGrading(opts);
    onApi(api);
    return null;
  }
  act(() => root.render(<Probe />));
}

const base = {
  elementIds: ["a", "b"],
  instantFeedback: true,
  recordOnly: false,
  buildAnswer: () => ({ a: 1 }),
};

it("grade emits onElementGraded and onProgress", () => {
  const onElementGraded = vi.fn();
  const onProgress = vi.fn<(progress: InstantProgress) => void>();
  const report = vi.fn();
  let api!: ReturnType<typeof useInstantGrading>;
  mount({ ...base, report, onElementGraded, onProgress }, (a) => (api = a));

  act(() => api.grade("a", "correct"));

  expect(onElementGraded).toHaveBeenCalledWith("a", "correct", undefined);
  expect(onProgress).toHaveBeenLastCalledWith({ correct: 1, wrong: 0, total: 2, done: false });
  // Chưa chấm hết vẫn report đáp án (đồng bộ lên cha) — verdict "incomplete".
  expect(report).toHaveBeenLastCalledWith({ a: 1 }, "incomplete");
});

it("reports correct + fires when every element graded", () => {
  const report = vi.fn();
  let api!: ReturnType<typeof useInstantGrading>;
  mount({ ...base, report }, (a) => (api = a));

  act(() => api.grade("a", "correct"));
  act(() => api.grade("b", "correct"));

  expect(report).toHaveBeenLastCalledWith({ a: 1 }, "correct");
});

it("reports incorrect when all graded but some wrong", () => {
  const report = vi.fn();
  let api!: ReturnType<typeof useInstantGrading>;
  mount({ ...base, report }, (a) => (api = a));
  act(() => api.grade("a", "correct"));
  act(() => api.grade("b", "incorrect"));
  expect(report).toHaveBeenLastCalledWith({ a: 1 }, "incorrect");
});

it("clear removes an element and lowers progress (done=false)", () => {
  const onProgress = vi.fn<(progress: InstantProgress) => void>();
  let api!: ReturnType<typeof useInstantGrading>;
  mount({ ...base, report: vi.fn(), onProgress }, (a) => (api = a));
  act(() => api.grade("a", "correct"));
  act(() => api.grade("b", "correct"));
  act(() => api.clear("b"));
  expect(onProgress).toHaveBeenLastCalledWith({ correct: 1, wrong: 0, total: 2, done: false });
});

it("re-grade updates verdict and re-reports", () => {
  const report = vi.fn();
  let api!: ReturnType<typeof useInstantGrading>;
  mount({ ...base, report }, (a) => (api = a));
  act(() => api.grade("a", "correct"));
  act(() => api.grade("b", "incorrect"));
  act(() => api.grade("b", "correct")); // sửa lại đúng
  expect(report).toHaveBeenLastCalledWith({ a: 1 }, "correct");
});

it("reveal returns verdict when active, undefined when inactive", () => {
  let api!: ReturnType<typeof useInstantGrading>;
  mount({ ...base, report: vi.fn() }, (a) => (api = a));
  act(() => api.grade("a", "incorrect"));
  expect(api.reveal("a")).toBe("incorrect");

  let api2!: ReturnType<typeof useInstantGrading>;
  mount({ ...base, instantFeedback: false, report: vi.fn() }, (a) => (api2 = a));
  act(() => api2.grade("a", "incorrect"));
  expect(api2.reveal("a")).toBeUndefined();
  expect(api2.active).toBe(false);
});

it("recordOnly never reveals and never reports a verdict", () => {
  const report = vi.fn();
  let api!: ReturnType<typeof useInstantGrading>;
  mount({ ...base, recordOnly: true, report }, (a) => (api = a));
  act(() => api.grade("a", "correct"));
  act(() => api.grade("b", "correct"));
  expect(api.reveal("a")).toBeUndefined();
  expect(report).not.toHaveBeenCalled();
});

it("fires side effects exactly once per grade under StrictMode (no double-fire)", () => {
  // StrictMode double-invokes state updaters in dev; side effects must live
  // OUTSIDE the setGraded updater so they still fire exactly once.
  const onElementGraded = vi.fn();
  const report = vi.fn();
  let api!: ReturnType<typeof useInstantGrading>;
  function Probe() {
    api = useInstantGrading({ ...base, report, onElementGraded });
    return null;
  }
  act(() => root.render(<StrictMode><Probe /></StrictMode>));

  act(() => api.grade("a", "correct"));
  expect(onElementGraded).toHaveBeenCalledTimes(1);
  // Mỗi lần chấm report đúng MỘT lần (đồng bộ đáp án, verdict "incomplete").
  expect(report).toHaveBeenCalledTimes(1);
  expect(report).toHaveBeenLastCalledWith({ a: 1 }, "incomplete");

  act(() => api.grade("b", "correct"));
  expect(report).toHaveBeenCalledTimes(2);
  expect(report).toHaveBeenLastCalledWith({ a: 1 }, "correct");
});

/**
 * Câu CHỌN MỘT TẬP (Owner 9/8, ca `67251341/bai20` câu 4 — chọn các tờ 1 000
 * đồng trong 9 thẻ): KHÔNG bấm vào phương án sai cũng là một câu trả lời, nên
 * "xong" phải tính bằng so khớp TẬP chứ không bằng "đã chấm hết phần tử".
 */
it("chế độ TẬP: tick đủ tập đúng là báo correct, dù chưa đụng phương án còn lại", () => {
  const report = vi.fn();
  let api!: ReturnType<typeof useInstantGrading>;
  mount(
    {
      ...base,
      elementIds: ["a", "b", "c", "d"],
      expectedIds: ["a", "c"],
      report,
    },
    (a) => {
      api = a;
    },
  );

  act(() => api.grade("a", "correct"));
  // Mới một nửa: đang làm dở, KHÔNG phải sai.
  expect(report).toHaveBeenLastCalledWith({ a: 1 }, "incomplete");

  act(() => api.grade("c", "correct"));
  // Đủ tập đúng, chưa hề đụng "b"/"d" → cả câu đúng.
  expect(report).toHaveBeenLastCalledWith({ a: 1 }, "correct");
});

it("chế độ TẬP: tick thêm một phương án SAI thì thôi correct, và báo đang làm dở", () => {
  const report = vi.fn();
  let api!: ReturnType<typeof useInstantGrading>;
  mount(
    { ...base, elementIds: ["a", "b", "c"], expectedIds: ["a"], report },
    (a) => {
      api = a;
    },
  );

  act(() => api.grade("a", "correct"));
  expect(report).toHaveBeenLastCalledWith({ a: 1 }, "correct");

  act(() => api.grade("b", "incorrect"));
  // Thẻ sai đã tự đỏ tại chỗ; kết luận "sai cả câu" lúc đang chọn là báo động giả.
  expect(report).toHaveBeenLastCalledWith({ a: 1 }, "incomplete");

  // Bỏ tick thẻ sai → quay lại đúng.
  act(() => api.clear("b"));
  expect(report).toHaveBeenLastCalledWith({ a: 1 }, "correct");
});

it("KHÔNG khai expectedIds → giữ nguyên luật cũ (chấm hết mà có sai thì cả câu sai)", () => {
  const report = vi.fn();
  let api!: ReturnType<typeof useInstantGrading>;
  mount({ ...base, elementIds: ["a", "b"], report }, (a) => {
    api = a;
  });
  act(() => api.grade("a", "correct"));
  expect(report).toHaveBeenLastCalledWith({ a: 1 }, "incomplete");
  act(() => api.grade("b", "incorrect"));
  expect(report).toHaveBeenLastCalledWith({ a: 1 }, "incorrect");
});
