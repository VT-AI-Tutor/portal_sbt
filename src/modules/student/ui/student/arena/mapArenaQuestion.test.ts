// @vitest-environment jsdom
/**
 * mapArenaQuestion: adapter từ ArenaQuestion (arenaApi.ts) sang input của
 * mapSessionQuestion, rồi ra PlayerQuestion cho QuestionPlayer. 2 case theo
 * task brief: payload null + options → player question có options đúng;
 * payload có sẵn (đã bị BE strip đáp án) → giữ nguyên, truyền thẳng qua.
 */
import { describe, expect, it } from "vitest";
import {
  deserializeArenaAnswer,
  mapArenaQuestion,
  serializeArenaAnswer,
} from "./mapArenaQuestion";
import type { ArenaQuestion } from "@/modules/student/api/arenaApi";

describe("mapArenaQuestion", () => {
  it("payload null + options → player question tổng hợp options từ options[]", () => {
    const q: ArenaQuestion = {
      id: "q1",
      type: "single_choice",
      content: "1 + 1 = ?",
      options: [
        { id: "A", content: "1" },
        { id: "B", content: "2" },
      ],
      payload: null,
      points: 10,
    };

    const mapped = mapArenaQuestion(q);

    expect(mapped.id).toBe("q1");
    expect(mapped.question_type).toBe("single_choice");
    // synthesized branch của mapBackendQuestion dựng payload.options từ content
    // plain string của từng option — record-only (đã gắn selfAssessment).
    expect(mapped.payload.selfAssessment).toBe(true);
    expect(Array.isArray(mapped.payload.options)).toBe(true);
    expect(mapped.payload.options).toHaveLength(2);
  });

  it("payload có sẵn (đã bị BE strip đáp án) → giữ nguyên, không tự tổng hợp lại từ options[]", () => {
    const q: ArenaQuestion = {
      id: "q2",
      type: "single_choice",
      content: "2 + 2 = ?",
      options: [
        { id: "A", content: "3" },
        { id: "B", content: "4" },
      ],
      payload: {
        content: { blocks: [{ type: "text", text: "2 + 2 = ?" }] },
        options: [
          { id: "A", content: { blocks: [{ type: "text", text: "3" }] } },
          { id: "B", content: { blocks: [{ type: "text", text: "4" }] } },
        ],
      },
      points: 10,
    };

    const mapped = mapArenaQuestion(q);

    expect(mapped.id).toBe("q2");
    // payload đã cho sẵn được truyền thẳng qua (mapBackendQuestion "preserve
    // payload" branch) — chỉ selfAssessment được thêm vào bởi mapSessionQuestion.
    expect(mapped.payload.selfAssessment).toBe(true);
    expect(mapped.payload.options).toEqual(q.payload!.options);
  });

  it("ordering payload null + 3 options → payload.items tổng hợp từ options[] (bug tái hiện: container rỗng do player đọc payload.items chứ không phải payload.options)", () => {
    const q: ArenaQuestion = {
      id: "q3",
      type: "ordering",
      content: "Sắp xếp tăng dần",
      options: [
        { id: "a", content: "1" },
        { id: "b", content: "5" },
        { id: "c", content: "9" },
      ],
      payload: null,
      points: 10,
    };

    const mapped = mapArenaQuestion(q);

    expect(mapped.question_type).toBe("ordering");
    // OrderingTask/QuestionPlayer's `case "ordering"` reads `payload.items`
    // (core/exercise/tasks/OrderingTask.tsx + QuestionPlayer.tsx) — asserting
    // the actual key the player consumes, not just payload.options.
    expect(Array.isArray(mapped.payload.items)).toBe(true);
    const items = mapped.payload.items as { id: string; content?: unknown }[];
    expect(items).toHaveLength(3);
    expect(items.map((i) => i.id)).toEqual(["a", "b", "c"]);
    // Also still has payload.options (harmless leftover from the synthesize
    // branch) — not asserted away, just confirming items is additive.
    expect(mapped.payload.options).toHaveLength(3);
  });

  it("multi_true_false payload null + options → payload.statements tổng hợp từ options[]", () => {
    const q: ArenaQuestion = {
      id: "q4",
      type: "multi_true_false",
      content: "Chọn đúng/sai",
      options: [
        { id: "s1", content: "Phát biểu 1" },
        { id: "s2", content: "Phát biểu 2" },
      ],
      payload: null,
      points: 10,
    };

    const mapped = mapArenaQuestion(q);

    expect(Array.isArray(mapped.payload.statements)).toBe(true);
    expect(
      (mapped.payload.statements as { id: string }[]).map((s) => s.id),
    ).toEqual(["s1", "s2"]);
  });

  it("matching/classification/question_group payload null → không tổng hợp được, pass-through (chỉ có payload.options)", () => {
    for (const type of ["matching", "classification", "question_group"]) {
      const q: ArenaQuestion = {
        id: `q-${type}`,
        type,
        content: "N/A",
        options: [{ id: "a", content: "1" }],
        payload: null,
        points: 10,
      };
      const mapped = mapArenaQuestion(q);
      expect(mapped.payload.items).toBeUndefined();
      expect(mapped.payload.statements).toBeUndefined();
      expect(mapped.payload.leftItems).toBeUndefined();
      expect(mapped.payload.categories).toBeUndefined();
    }
  });

  it("ordering: answer round-trip — serialize/deserialize giữ nguyên mảng id (khớp shape correct_answer BE chấm: ['a','b','c'])", () => {
    const q: ArenaQuestion = {
      id: "q5",
      type: "ordering",
      content: "Sắp xếp tăng dần",
      options: [
        { id: "a", content: "1" },
        { id: "b", content: "5" },
        { id: "c", content: "9" },
      ],
      payload: null,
      points: 10,
    };

    // Player's onAnswerChange (OrderingTask) reports the reordered id array.
    const playerAnswer = ["b", "a", "c"];

    const serialized = serializeArenaAnswer(q, playerAnswer);
    // ordering isn't multi_true_false → passthrough unchanged, already the
    // id-array shape the backend compares against correct_answer.
    expect(serialized).toEqual(["b", "a", "c"]);

    const restored = deserializeArenaAnswer(q, serialized);
    // ordering isn't multi_true_false → passthrough unchanged on restore too.
    expect(restored).toEqual(["b", "a", "c"]);
  });
});
