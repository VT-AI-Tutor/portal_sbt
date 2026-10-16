import { describe, expect, it } from "vitest";
import { gradeByType, isAnswerEmpty } from "./grading";

/**
 * Regression suite covering every question type in the 45-type canonical
 * registry (evo-studio-docs/CONTENT_SCHEMA_SPECIFICATIONS.md §5.0), each with
 * a v2.0-shaped fixture — single top-level `correctAnswer`, never a legacy
 * per-field key. Every entry asserts a correct AND an incorrect answer so a
 * regression that always returns `true` (like the pre-Phase-0 multi_true_false
 * bug) gets caught.
 */

type Case = {
  type: string;
  schema: Record<string, unknown>;
  correct: unknown;
  wrong: unknown;
};

const AUTO_GRADABLE_CASES: Case[] = [
  {
    type: "single_choice",
    schema: { correctAnswer: "A" },
    correct: "A",
    wrong: "B",
  },
  {
    type: "multiple_choice",
    schema: { correctAnswer: ["A", "C"] },
    correct: ["C", "A"],
    wrong: ["A", "B"],
  },
  {
    type: "true_false",
    schema: { correctAnswer: true },
    correct: true,
    wrong: false,
  },
  {
    type: "multi_true_false",
    schema: { correctAnswer: { s1: true, s2: false } },
    correct: { s1: true, s2: false },
    wrong: { s1: false, s2: false },
  },
  {
    type: "multi_true_false_table",
    schema: { correctAnswer: { s1: true, s2: false } },
    correct: { s1: true, s2: false },
    wrong: { s1: true, s2: true },
  },
  {
    type: "fill_blank",
    schema: { correctAnswer: { blank_1: "Hà Nội" } },
    correct: { blank_1: "hà nội" },
    wrong: { blank_1: "Sài Gòn" },
  },
  {
    type: "cloze",
    schema: { correctAnswer: { blank_1: ["Chó", "Cún"] } },
    correct: { blank_1: "chó" },
    wrong: { blank_1: "Mèo" },
  },
  {
    type: "numeric_answer",
    schema: { correctAnswer: 4.14, tolerance: 0.01 },
    correct: 4.145,
    wrong: 5,
  },
  {
    type: "matching",
    schema: { correctAnswer: { L1: "R1", L2: "R2" } },
    correct: { L1: "R1", L2: "R2" },
    wrong: { L1: "R2", L2: "R1" },
  },
  {
    type: "ordering",
    schema: { correctAnswer: ["1", "2", "3"] },
    correct: ["1", "2", "3"],
    wrong: ["2", "1", "3"],
  },
  {
    type: "drag_drop",
    schema: { correctAnswer: { d1: "z1", d2: "z2" } },
    correct: { d1: "z1", d2: "z2" },
    wrong: { d1: "z2", d2: "z1" },
  },
  {
    type: "classification",
    schema: { correctAnswer: { i1: "cat1", i2: "cat2" } },
    correct: { i1: "cat1", i2: "cat2" },
    wrong: { i1: "cat2", i2: "cat1" },
  },
  {
    type: "hotspot",
    schema: { correctAnswer: "h1" },
    correct: "h1",
    wrong: "h2",
  },
  {
    type: "hotspot",
    schema: { correctAnswer: { count: 2 }, display: { interactionType: "multiple" } },
    correct: ["f1", "f4"],
    wrong: ["f1"],
  },
  {
    type: "labeling",
    schema: { correctAnswer: { lbl1: "t1", lbl2: "t2" } },
    correct: { lbl1: "t1", lbl2: "t2" },
    wrong: { lbl1: "t2", lbl2: "t1" },
  },
  {
    type: "connect_points",
    schema: { correctAnswer: [{ from: "p1", to: "p3" }] },
    correct: [{ from: "p3", to: "p1" }],
    wrong: [{ from: "p1", to: "p4" }],
  },
  {
    type: "table_completion",
    schema: { correctAnswer: { row_1__col_1: "Nguyễn Du" } },
    correct: { row_1__col_1: "nguyễn du" },
    wrong: { row_1__col_1: "Nguyễn Trãi" },
  },
  {
    type: "dictation",
    schema: { correctAnswer: "Đây là câu mẫu." },
    correct: "Đây là câu mẫu.",
    wrong: "Câu khác.",
  },
  {
    type: "math_expression",
    schema: { correctAnswer: ["x=4", "x = 4"] },
    correct: "x = 4",
    wrong: "x = 5",
  },
  {
    type: "point_marking",
    schema: { correctAnswer: { x: 0.45, y: 0.2 } },
    correct: { x: 0.45, y: 0.2 },
    wrong: { x: 0.1, y: 0.1 },
  },
  {
    type: "highlight",
    schema: { correctAnswer: ["s1"] },
    correct: ["s1"],
    wrong: ["s2"],
  },
  {
    type: "checkbox_table",
    schema: { correctAnswer: { row_1: ["col_A"], row_2: ["col_A", "col_B"] } },
    correct: { row_1: ["col_A"], row_2: ["col_B", "col_A"] },
    wrong: { row_1: ["col_B"], row_2: ["col_A", "col_B"] },
  },
  {
    type: "diagram_fill",
    schema: { correctAnswer: { n1: "Nguyên nhân", n2: "Kết quả" } },
    correct: { n1: "nguyên nhân", n2: "kết quả" },
    wrong: { n1: "Kết quả", n2: "Nguyên nhân" },
  },
  {
    type: "path_connect",
    schema: { correctAnswer: ["n1", "n2", "n3"] },
    correct: ["n1", "n2", "n3"],
    wrong: ["n3", "n2", "n1"],
  },
  {
    type: "card_sort",
    schema: { correctAnswer: { card1: "cat1", card2: "cat2" } },
    correct: { card1: "cat1", card2: "cat2" },
    wrong: { card1: "cat2", card2: "cat1" },
  },
  {
    type: "crossword",
    schema: { correctAnswer: { e1: "HANOI" } },
    correct: { e1: "hanoi" },
    wrong: { e1: "SAIGON" },
  },
  {
    type: "scale",
    schema: { correctAnswer: 3 },
    correct: 3,
    wrong: 5,
  },
];

// Manual-graded / record-only — no correctAnswer to compare, gradable must be false
// (never silently return isCorrect:true, that's how the pre-Phase-0 bug hid).
const UNGRADABLE_TYPES = [
  "essay",
  "speaking",
  "drawing",
  "coloring",
  "mind_map",
  "mind_map_completion",
  "upload_answer",
  "memory_match",
  "pikachu",
  "jigsaw",
  "word_search",
  "hangman",
  "spot_difference",
];

describe("gradeByType — v2.0 fixtures for the 45-type registry", () => {
  it("diagram_fill accepts a complete alternative answer map", () => {
    const schema = {
      correctAnswer: { top: "4", left: "3", mid: "5", right: "15", bottom: "20" },
      correctAnswerAlternatives: [
        { top: "3", left: "4", mid: "5", right: "20", bottom: "15" },
      ],
    };

    expect(gradeByType("diagram_fill", schema, schema.correctAnswer, {
      top: "3", left: "4", mid: "5", right: "20", bottom: "15",
    }).isCorrect).toBe(true);

    expect(gradeByType("diagram_fill", schema, schema.correctAnswer, {
      top: "3", left: "4", mid: "5", right: "15", bottom: "20",
    }).isCorrect).toBe(false);
  });

  it.each(AUTO_GRADABLE_CASES)("$type: correct answer grades correct", ({ type, schema, correct }) => {
    const result = gradeByType(type, schema, schema.correctAnswer, correct);
    expect(result.gradable).toBe(true);
    expect(result.isCorrect).toBe(true);
  });

  it.each(AUTO_GRADABLE_CASES)("$type: wrong answer grades incorrect", ({ type, schema, wrong }) => {
    const result = gradeByType(type, schema, schema.correctAnswer, wrong);
    expect(result.gradable).toBe(true);
    expect(result.isCorrect).toBe(false);
  });

  it("hotspot {count}: chọn THỪA vùng vẫn sai, count không hợp lệ thì UNGRADABLE", () => {
    const schema = { correctAnswer: { count: 2 } };
    expect(gradeByType("hotspot", schema, schema.correctAnswer, ["f1", "f2", "f3"]).isCorrect).toBe(false);
    expect(gradeByType("hotspot", schema, schema.correctAnswer, null).isCorrect).toBe(false);
    expect(gradeByType("hotspot", { correctAnswer: { count: 0 } }, { count: 0 }, []).gradable).toBe(false);
    // Không nguyên (2.5): phải UNGRADABLE chứ không phải "chấm được nhưng bất khả thi".
    expect(gradeByType("hotspot", { correctAnswer: { count: 2.5 } }, { count: 2.5 }, ["f1", "f2"]).gradable).toBe(false);
    expect(gradeByType("hotspot", { correctAnswer: {} }, {}, ["f1"]).gradable).toBe(false);
  });

  it.each(UNGRADABLE_TYPES)("%s is UNGRADABLE regardless of answer", (type) => {
    const result = gradeByType(type, {}, undefined, "anything");
    expect(result.gradable).toBe(false);
  });

  it("selfAssessment overrides a present answer key for an otherwise auto-gradable question", () => {
    const schema = {
      selfAssessment: true,
      correctAnswer: { blank_1: [], blank_2: [] },
    };

    expect(gradeByType("cloze", schema, schema.correctAnswer, { blank_1: "Em trả lời" })).toEqual(
      { isCorrect: false, gradable: false },
    );
  });

  describe("wrapper recursion", () => {
    const child = { id: "c1", type: "single_choice", correctAnswer: "A" };

    it.each(["question_group", "timed_quiz", "lives_streak", "board_game"])(
      "%s: all gradable children correct -> correct",
      (type) => {
        const schema = { questions: [child] };
        const result = gradeByType(type, schema, undefined, { c1: "A" });
        expect(result.gradable).toBe(true);
        expect(result.isCorrect).toBe(true);
      },
    );

    // Mỗi wrapper player emit envelope {answers, ...meta} với meta riêng —
    // test đúng shape thật từng player.
    it.each([
      ["question_group", { order: ["c1"] }],
      ["timed_quiz", { elapsedMs: 1234 }],
      ["lives_streak", { lives: 3, streak: 1 }],
      ["board_game", { boardPos: 1 }],
    ] as Array<[string, Record<string, unknown>]>)(
      "%s: envelope answer {answers, ...meta} unwraps to the child record",
      (type, meta) => {
        const schema = { questions: [child] };
        const right = gradeByType(type, schema, undefined, {
          answers: { c1: "A" },
          ...meta,
        });
        expect(right).toEqual({ isCorrect: true, gradable: true });
        const wrong = gradeByType(type, schema, undefined, {
          answers: { c1: "B" },
          ...meta,
        });
        expect(wrong).toEqual({ isCorrect: false, gradable: true });
      },
    );

    it("question_group: id-less children key theo child-${i} như dispatch", () => {
      const schema = {
        questions: [
          { type: "single_choice", correctAnswer: "A" },
          { type: "single_choice", correctAnswer: "B" },
        ],
      };
      const right = gradeByType("question_group", schema, undefined, {
        answers: { "child-0": "A", "child-1": "B" },
        order: ["child-0", "child-1"],
      });
      expect(right).toEqual({ isCorrect: true, gradable: true });
      const wrong = gradeByType("question_group", schema, undefined, {
        answers: { "child-0": "A", "child-1": "C" },
        order: ["child-0", "child-1"],
      });
      expect(wrong).toEqual({ isCorrect: false, gradable: true });
    });

    it("question_group: con có id thật là \"answers\" không bị unwrap nhầm", () => {
      const schema = {
        questions: [
          { id: "answers", type: "multi_true_false", correctAnswer: { s1: true } },
        ],
      };
      const result = gradeByType("question_group", schema, undefined, {
        answers: { s1: true },
      });
      expect(result).toEqual({ isCorrect: true, gradable: true });
    });

    it("true_false trong nhóm: con bỏ trống KHÔNG được chấm đúng dù key là false", () => {
      const schema = {
        questions: [{ id: "tf1", type: "true_false", correctAnswer: false }],
      };
      const blank = gradeByType("question_group", schema, undefined, {
        answers: {},
        order: ["tf1"],
      });
      expect(blank).toEqual({ isCorrect: false, gradable: true });
      expect(gradeByType("true_false", {}, false, undefined)).toEqual({
        isCorrect: false,
        gradable: true,
      });
      expect(gradeByType("true_false", {}, false, false)).toEqual({
        isCorrect: true,
        gradable: true,
      });
    });

    it("question_group: con hotspot {count} dưới key CHUẨN `children` chấm theo số lượng", () => {
      // Studio soạn theo v2.0 dùng `children` (nested-children.ts: ưu tiên cao nhất) —
      // wrapper chấm phải nhìn thấy key này, không chỉ subQuestions/questions.
      const schema = {
        children: [
          {
            id: "r1",
            type: "hotspot",
            display: { interactionType: "multiple" },
            hotspots: [{ id: "f1" }, { id: "f2" }, { id: "f3" }, { id: "f4" }, { id: "f5" }],
            correctAnswer: { count: 2 },
          },
        ],
      };
      const right = gradeByType("question_group", schema, undefined, { r1: ["f1", "f4"] });
      expect(right.gradable).toBe(true);
      expect(right.isCorrect).toBe(true);
      const short = gradeByType("question_group", schema, undefined, { r1: ["f1"] });
      expect(short.gradable).toBe(true);
      expect(short.isCorrect).toBe(false);
    });

    it("excludes an authored self-assessment child from wrapper scoring", () => {
      const schema = {
        questions: [{ ...child, selfAssessment: true }],
      };

      expect(gradeByType("question_group", schema, undefined, { c1: "A" })).toEqual({
        isCorrect: false,
        gradable: false,
      });
    });

    it.each(["question_group", "timed_quiz", "lives_streak", "board_game"])(
      "%s: a wrong child answer -> incorrect",
      (type) => {
        const schema = { questions: [child] };
        const result = gradeByType(type, schema, undefined, { c1: "B" });
        expect(result.gradable).toBe(true);
        expect(result.isCorrect).toBe(false);
      },
    );

    it.each(["question_group", "timed_quiz", "lives_streak", "board_game"])(
      "%s: no gradable children -> UNGRADABLE (never a false-positive correct)",
      (type) => {
        const schema = { questions: [{ id: "c1", type: "essay" }] };
        const result = gradeByType(type, schema, undefined, {});
        expect(result.gradable).toBe(false);
      },
    );

    it("path_trail: grades its single child directly", () => {
      const schema = { child };
      const okResult = gradeByType("path_trail", schema, undefined, { c1: "A" });
      expect(okResult).toEqual({ isCorrect: true, gradable: true });
      const badResult = gradeByType("path_trail", schema, undefined, { c1: "B" });
      expect(badResult).toEqual({ isCorrect: false, gradable: true });
    });

    it("path_trail: envelope {answer, progress, stepIndex} của PathTrailPlayer chấm theo answer bên trong", () => {
      const schema = { child };
      const right = gradeByType("path_trail", schema, undefined, {
        answer: "A",
        progress: 100,
        stepIndex: 1,
      });
      expect(right).toEqual({ isCorrect: true, gradable: true });
      const wrong = gradeByType("path_trail", schema, undefined, {
        answer: "B",
        progress: 100,
        stepIndex: 1,
      });
      expect(wrong).toEqual({ isCorrect: false, gradable: true });
    });

    it("media_anchored: grades every anchor's nested question", () => {
      const schema = { anchors: [{ id: "a1", question: child }] };
      const result = gradeByType("media_anchored", schema, undefined, { a1: "A" });
      expect(result).toEqual({ isCorrect: true, gradable: true });
    });
  });

  it("regression guard: multi_true_false never silently passes when the answer disagrees with the top-level correctAnswer (the pre-Phase-0 bug read the legacy embedded per-statement shape and returned {correct:true} whenever it was absent)", () => {
    const schema = {
      statements: [{ id: "s1" }, { id: "s2" }],
      correctAnswer: { s1: true, s2: false },
    };
    const result = gradeByType("multi_true_false", schema, schema.correctAnswer, {
      s1: false,
      s2: false,
    });
    expect(result.isCorrect).toBe(false);
  });

  it("regression guard: matching reads Record<leftId,rightId> shape, not an array-of-pairs cast that silently yields an empty comparison", () => {
    const schema = { correctAnswer: { L1: "R1", L2: "R2" } };
    const result = gradeByType("matching", schema, schema.correctAnswer, { L1: "R1", L2: "R2" });
    expect(result).toEqual({ isCorrect: true, gradable: true });
    const wrongResult = gradeByType("matching", schema, schema.correctAnswer, {
      L1: "R2",
      L2: "R1",
    });
    expect(wrongResult.isCorrect).toBe(false);
  });

  it("matching: đáp án dạng mảng cạnh [{item,target}] của Studio chấm đúng cho học sinh nối đúng", () => {
    // Player đọc được cả hai phương ngữ (`normalizeMatchEdges`) nên nét nối vẽ
    // bình thường; bộ chấm chỉ hiểu Record thì dựng map RỖNG → "không chấm
    // được", mà PracticeRunner quy về "sai". Học sinh nối đúng vẫn bị báo sai.
    const pairs = [
      { item: "L1", target: "R1" },
      { item: "L2", target: "R2" },
    ];
    const schema = { correctAnswer: pairs };
    expect(gradeByType("matching", schema, pairs, pairs)).toEqual({
      isCorrect: true,
      gradable: true,
    });
    expect(
      gradeByType("matching", schema, pairs, [
        { item: "L1", target: "R2" },
        { item: "L2", target: "R1" },
      ]),
    ).toEqual({ isCorrect: false, gradable: true });
  });

  it("matching: trộn phương ngữ — đáp án mảng cạnh, bài làm dạng Record", () => {
    const pairs = [
      { item: "L1", target: "R1" },
      { item: "L2", target: "R2" },
    ];
    expect(
      gradeByType("matching", { correctAnswer: pairs }, pairs, {
        L1: "R1",
        L2: "R2",
      }),
    ).toEqual({ isCorrect: true, gradable: true });
  });

  it("matching: quan hệ một-nhiều đòi đủ mọi cạnh (Record không diễn đạt được)", () => {
    const pairs = [
      { item: "L1", target: "R1" },
      { item: "L1", target: "R2" },
    ];
    const schema = { correctAnswer: pairs };
    expect(gradeByType("matching", schema, pairs, pairs).isCorrect).toBe(true);
    expect(
      gradeByType("matching", schema, pairs, [{ item: "L1", target: "R1" }])
        .isCorrect,
    ).toBe(false);
  });

  it("regression guard: a blank numeric answer never scores correct for a target-0 question (Number(null)===0 / Number('')===0 would have)", () => {
    const schema = { correctAnswer: 0, tolerance: 0 };
    for (const blank of [null, undefined, ""]) {
      const r = gradeByType("numeric_answer", schema, schema.correctAnswer, blank);
      expect(r.isCorrect).toBe(false);
    }
    // A real 0 still grades correct.
    expect(gradeByType("numeric_answer", schema, schema.correctAnswer, 0).isCorrect).toBe(true);
  });

  it("display.interactionType never influences grading (spec §10)", () => {
    const base = { correctAnswer: "A", display: { interactionType: "tile" } };
    const withTile = gradeByType("single_choice", base, base.correctAnswer, "A");
    const withoutDisplay = gradeByType(
      "single_choice",
      { correctAnswer: "A" },
      "A",
      "A",
    );
    expect(withTile).toEqual(withoutDisplay);
  });
});

describe("isAnswerEmpty — wrapper envelope", () => {
  it("envelope chưa trả lời câu nào (chỉ meta) là empty", () => {
    expect(isAnswerEmpty({ answers: {}, order: ["c1", "c2"] })).toBe(true);
    expect(isAnswerEmpty({ answers: { c1: "", c2: [] }, elapsedMs: 500 })).toBe(
      true,
    );
  });

  it("envelope có ít nhất một con đã trả lời là non-empty", () => {
    expect(isAnswerEmpty({ answers: { c1: "A" }, order: ["c1", "c2"] })).toBe(
      false,
    );
    expect(isAnswerEmpty({ answers: { c1: ["x"] }, boardPos: 1 })).toBe(false);
  });

  it("record phẳng giữ nguyên hành vi cũ", () => {
    expect(isAnswerEmpty({})).toBe(true);
    expect(isAnswerEmpty({ c1: "A" })).toBe(false);
  });
});
