import { describe, expect, it } from "vitest";
import {
  mapSessionQuestion,
  gradeSessionQuestion,
  serializeSessionAnswer,
  deserializeSessionAnswer,
} from "./mapSessionQuestion";
import type { SessionQuestion } from "./practiceApi";

function makeQuestion(overrides: Partial<SessionQuestion>): SessionQuestion {
  return {
    id: "q1",
    order: 1,
    question_text: "Pick one",
    question_type: "single_choice",
    payload: {
      options: [
        { id: "A", content: "Option A" },
        { id: "B", content: "Option B" },
      ],
      correctAnswer: "A",
      score: 1,
    },
    level_code: "L1",
    outcome_code: "OC1",
    content_code: "CC1",
    ...overrides,
  };
}

describe("mapSessionQuestion", () => {
  it("renders options carrying the book/studio dialect ({blocks}) as their text, not [object Object]", () => {
    // Câu nhập từ gói Studio gốc mang `options[].content` dạng
    // `{blocks:[...]}` chứ không phải chuỗi như câu bank/seed. Trước đây
    // options được chuyển thẳng cho mapBackendQuestion, hàm này bọc giá trị
    // vào `{blocks:[{text: <giá trị>}]}` -> đối tượng lọt vào `text` và học
    // sinh thấy đúng chữ "[object Object]" (quan sát trên bank Địa lý 6 thật).
    const q = makeQuestion({
      payload: {
        options: [
          {
            id: "A",
            content: { blocks: [{ type: "paragraph", text: "Thứ nhất" }] },
          },
          {
            id: "B",
            content: { blocks: [{ type: "paragraph", text: "Thứ hai" }] },
          },
        ],
        correctAnswer: "C",
        score: 1,
      },
    } as Partial<SessionQuestion>);

    const result = mapSessionQuestion(q);

    expect(result.payload.options).toEqual([
      {
        id: "A",
        content: { blocks: [{ type: "paragraph", text: "Thứ nhất" }] },
      },
      {
        id: "B",
        content: { blocks: [{ type: "paragraph", text: "Thứ hai" }] },
      },
    ]);
  });

  it("preserves canonicalized (runs-based) option content instead of flattening it to an empty block", () => {
    // canonicalizeRichContent moves a block's text into inline `content` runs
    // and DELETES `text` (html.ts). The player's optionBodyNode renders such
    // blocks directly. The old mapper flattened options to plain text by
    // reading ONLY block.text, so a canonicalized option collapsed to an empty
    // block and the practice runner showed a blank option — only the A/B/C/D
    // letter. Pass the rich content through so the player renders the real
    // block, exactly like the bank preview.
    const a = {
      blocks: [
        {
          type: "paragraph",
          content: [{ text: "S = {1; 2; 3; 4; 5; 6}", annotations: {} }],
        },
      ],
    };
    const b = {
      blocks: [
        {
          type: "paragraph",
          content: [{ text: "S = {1; 2; 3; 4; 5}", annotations: {} }],
        },
      ],
    };
    const q = makeQuestion({
      payload: {
        options: [
          { id: "A", content: a },
          { id: "B", content: b },
        ],
        correctAnswer: "A",
        score: 1,
      },
    } as Partial<SessionQuestion>);

    const result = mapSessionQuestion(q);

    expect(result.payload.options).toEqual([
      { id: "A", content: a },
      { id: "B", content: b },
    ]);
  });

  it("maps a single_choice SessionQuestion's text/options into the RichContent shape SingleChoicePlayer's dispatch reads", () => {
    // dispatch.tsx: payloadTitle() reads richToText(payload.content) for the
    // header, adaptOptions() reads richToText(option.content) || option.text
    // for each option's label (SingleChoicePlayer.tsx renders `opt.text`).
    const q = makeQuestion({});
    const result = mapSessionQuestion(q);

    expect(result.id).toBe("q1");
    expect(result.question_type).toBe("single_choice");
    expect(result.payload.content).toEqual({
      blocks: [{ type: "paragraph", text: "Pick one" }],
    });
    expect(result.payload.options).toEqual([
      {
        id: "A",
        content: { blocks: [{ type: "paragraph", text: "Option A" }] },
      },
      {
        id: "B",
        content: { blocks: [{ type: "paragraph", text: "Option B" }] },
      },
    ]);
    // Record-only: players must report on every change instead of gating
    // behind their own internal "Kiểm tra" button, and must not receive a
    // grading key to self-grade / pre-reveal with — PracticeRunner owns the
    // check/verdict UI (see mapSessionQuestion.ts's record-only note).
    expect(result.payload.selfAssessment).toBe(true);
    expect(result.payload.correctAnswer).toBeUndefined();
  });

  it("maps a multiple_choice SessionQuestion the same way, record-only (no correctAnswer in the player payload)", () => {
    const q = makeQuestion({
      question_type: "multiple_choice",
      payload: {
        options: [
          { id: "A", content: "Option A" },
          { id: "B", content: "Option B" },
          { id: "C", content: "Option C" },
        ],
        correctAnswer: ["A", "C"],
        score: 1,
      },
    });
    const result = mapSessionQuestion(q);

    expect(result.question_type).toBe("multiple_choice");
    expect(result.payload.content).toEqual({
      blocks: [{ type: "paragraph", text: "Pick one" }],
    });
    expect(result.payload.options.map((o: { id: string }) => o.id)).toEqual([
      "A",
      "B",
      "C",
    ]);
    expect(result.payload.selfAssessment).toBe(true);
    expect(result.payload.correctAnswer).toBeUndefined();
  });

  it("maps a multi_true_false SessionQuestion's statements/text into what TrueFalseTablePlayer's dispatch case reads, record-only", () => {
    // dispatch.tsx "TrueFalseTablePlayer" case: itemText(s) = richToText(s.content) || s.text || ...
    // Some legacy/seed statements carry a plain `text` (kept as-is here); the
    // content-authored shape is covered by the test above.
    // No `correctAnswer` is injected into the player payload — TrueFalseTablePlayer
    // keys recordOnly ONLY off `selfAssessment` (it always has a key), so
    // `selfAssessment: true` is what makes it record-only + hides its
    // internal "Kiểm tra" button.
    const q = makeQuestion({
      question_type: "multi_true_false",
      payload: {
        statements: [
          { id: "s1", text: "Statement 1", correctAnswer: true },
          { id: "s2", text: "Statement 2", correctAnswer: false },
        ],
        // Grading key: array of true-statement ids (only read by gradeByType,
        // via gradeSessionQuestion — a different shape than the player payload).
        correctAnswer: ["s1"],
        score: 1,
      },
    });
    const result = mapSessionQuestion(q);

    expect(result.question_type).toBe("multi_true_false");
    expect(result.payload.content).toEqual({
      blocks: [{ type: "paragraph", text: "Pick one" }],
    });
    expect(result.payload.statements).toEqual([
      { id: "s1", text: "Statement 1" },
      { id: "s2", text: "Statement 2" },
    ]);
    expect(result.payload.selfAssessment).toBe(true);
    expect(result.payload.correctAnswer).toBeUndefined();
  });

  it("forwards content-authored multi_true_false statements so dispatch renders the text, not the id", () => {
    // The real editor (MultiTrueFalseEditor) writes each statement as
    // `{ id, content: RichContent }` — the sentence lives in `content`, there
    // is NO `text` field. Narrowing to `{ id, text: s.text }` dropped content
    // entirely, so dispatch's `richToText(s.content) || s.text` fell back to
    // `s.id` and the practice runner rendered "s1", "s2", … instead of the
    // statement. Forward `content` so it renders the same as the bank preview.
    const s1 = {
      blocks: [
        {
          type: "paragraph",
          text: "Với hai số tự nhiên khác nhau, luôn có một số nhỏ hơn.",
        },
      ],
    };
    const s2 = {
      blocks: [
        {
          type: "paragraph",
          text: "Mọi số tự nhiên đều có một số liền trước.",
        },
      ],
    };
    const q = makeQuestion({
      question_type: "multi_true_false",
      payload: {
        statements: [
          { id: "s1", content: s1, correctAnswer: true },
          { id: "s2", content: s2, correctAnswer: false },
        ],
        correctAnswer: ["s1"],
        score: 1,
      },
    });
    const result = mapSessionQuestion(q);

    expect(result.payload.statements).toEqual([
      { id: "s1", content: s1 },
      { id: "s2", content: s2 },
    ]);
  });

  // -------------------------------------------------------------------
  // F1: passthrough for the 6 new types. Fixtures use the BANK dialect
  // (payload's `content` fields are plain strings) — the trickier
  // case per the plan's Global Constraints, since a naive passthrough would
  // silently drop the text (dispatch.tsx's richToText() reads `.blocks`,
  // absent on a plain string).
  // -------------------------------------------------------------------

  it("maps an ordering SessionQuestion's items into RichContent, passthrough for ReorderListPlayer's dispatch case", () => {
    const q = makeQuestion({
      question_type: "ordering",
      payload: {
        items: [
          { id: "o1", content: "First" },
          { id: "o2", content: "Second" },
        ],
        correctAnswer: ["o1", "o2"],
        score: 1,
      },
    });
    const result = mapSessionQuestion(q);

    expect(result.question_type).toBe("ordering");
    expect(result.payload.items).toEqual([
      { id: "o1", content: { blocks: [{ type: "paragraph", text: "First" }] } },
      {
        id: "o2",
        content: { blocks: [{ type: "paragraph", text: "Second" }] },
      },
    ]);
    expect(result.payload.selfAssessment).toBe(true);
    expect(result.payload.correctAnswer).toBeUndefined();
  });

  it("leaves an already-rich ordering item's content untouched (book/studio dialect)", () => {
    const rich = { blocks: [{ type: "paragraph", text: "Already rich" }] };
    const q = makeQuestion({
      question_type: "ordering",
      payload: {
        items: [{ id: "o1", content: rich }],
        correctAnswer: ["o1"],
        score: 1,
      },
    });
    const result = mapSessionQuestion(q);
    expect(result.payload.items).toEqual([{ id: "o1", content: rich }]);
  });

  it("maps a matching SessionQuestion's leftItems/rightItems + labels, passthrough for TwoColumnMatchPlayer's dispatch case", () => {
    const q = makeQuestion({
      question_type: "matching",
      payload: {
        leftItems: [
          { id: "l1", content: "Left 1" },
          { id: "l2", content: "Left 2" },
        ],
        rightItems: [
          { id: "r1", content: "Right 1" },
          { id: "r2", content: "Right 2" },
        ],
        columnALabel: "Cột A",
        columnBLabel: "Cột B",
        correctAnswer: { l1: "r1", l2: "r2" },
        score: 1,
      },
    });
    const result = mapSessionQuestion(q);

    expect(result.question_type).toBe("matching");
    expect(result.payload.leftItems).toEqual([
      {
        id: "l1",
        content: { blocks: [{ type: "paragraph", text: "Left 1" }] },
      },
      {
        id: "l2",
        content: { blocks: [{ type: "paragraph", text: "Left 2" }] },
      },
    ]);
    expect(result.payload.rightItems).toEqual([
      {
        id: "r1",
        content: { blocks: [{ type: "paragraph", text: "Right 1" }] },
      },
      {
        id: "r2",
        content: { blocks: [{ type: "paragraph", text: "Right 2" }] },
      },
    ]);
    expect(result.payload.columnALabel).toBe("Cột A");
    expect(result.payload.columnBLabel).toBe("Cột B");
    expect(result.payload.selfAssessment).toBe(true);
    expect(result.payload.correctAnswer).toBeUndefined();
  });

  it("maps a matching SessionQuestion's canonical `columns`, preferring it over leftItems/rightItems when both are present", () => {
    const q = makeQuestion({
      question_type: "matching",
      payload: {
        columns: [
          {
            id: "left",
            title: "Cột A",
            items: [{ id: "l1", content: "Left 1" }],
          },
          {
            id: "right",
            title: "Cột B",
            items: [{ id: "r1", content: "Right 1" }],
          },
        ],
        // Legacy mirrors present too — columns must win (matches dispatch's
        // resolveMatchingColumns priority).
        leftItems: [{ id: "stale", content: "Stale" }],
        correctAnswer: { l1: "r1" },
        score: 1,
      },
    });
    const result = mapSessionQuestion(q);

    expect(result.payload.columns).toEqual([
      {
        id: "left",
        title: "Cột A",
        items: [
          {
            id: "l1",
            content: { blocks: [{ type: "paragraph", text: "Left 1" }] },
          },
        ],
      },
      {
        id: "right",
        title: "Cột B",
        items: [
          {
            id: "r1",
            content: { blocks: [{ type: "paragraph", text: "Right 1" }] },
          },
        ],
      },
    ]);
    expect(result.payload.leftItems).toBeUndefined();
  });

  it("maps a classification SessionQuestion's categories + items, passthrough for CategorizePlayer's dispatch case", () => {
    const q = makeQuestion({
      question_type: "classification",
      payload: {
        categories: [
          { id: "cat1", label: "Loại 1" },
          { id: "cat2", content: "Loại 2" },
        ],
        items: [
          { id: "i1", content: "Item 1" },
          { id: "i2", content: "Item 2" },
        ],
        correctAnswer: { i1: "cat1", i2: "cat2" },
        score: 1,
      },
    });
    const result = mapSessionQuestion(q);

    expect(result.question_type).toBe("classification");
    // categories: `label` (plain field CategorizePlayer's itemText() falls
    // back to) passes through untouched; a `content` field IS richified.
    expect(result.payload.categories).toEqual([
      { id: "cat1", label: "Loại 1" },
      {
        id: "cat2",
        content: { blocks: [{ type: "paragraph", text: "Loại 2" }] },
      },
    ]);
    expect(result.payload.items).toEqual([
      {
        id: "i1",
        content: { blocks: [{ type: "paragraph", text: "Item 1" }] },
      },
      {
        id: "i2",
        content: { blocks: [{ type: "paragraph", text: "Item 2" }] },
      },
    ]);
    expect(result.payload.selfAssessment).toBe(true);
    expect(result.payload.correctAnswer).toBeUndefined();
  });

  it("maps an essay SessionQuestion's prompts/minWords/maxWords/rubric passthrough for EssayPlayer's dispatch case", () => {
    const q = makeQuestion({
      question_type: "essay",
      payload: {
        prompts: ["Ý 1", "Ý 2"],
        minWords: 50,
        maxWords: 500,
        rubric: [{ criterion: "Nội dung", maxScore: 5 }],
        score: 1,
      },
    });
    const result = mapSessionQuestion(q);

    expect(result.question_type).toBe("essay");
    expect(result.payload.prompts).toEqual(["Ý 1", "Ý 2"]);
    expect(result.payload.minWords).toBe(50);
    expect(result.payload.maxWords).toBe(500);
    expect(result.payload.rubric).toEqual([
      { criterion: "Nội dung", maxScore: 5 },
    ]);
    expect(result.payload.selfAssessment).toBe(true);
  });

  it("maps a short_answer SessionQuestion onto the essay player (no dedicated player exists), single-prompt mode", () => {
    const q = makeQuestion({
      question_type: "short_answer",
      payload: {
        correctAnswer: "42",
        score: 1,
      },
    });
    const result = mapSessionQuestion(q);

    // Player type routes to "essay" (only type with a registered player that
    // fits a free-text answer) — but the ORIGINAL SessionQuestion (q) keeps
    // question_type "short_answer" untouched; PracticeRunner reads THAT for
    // labels/the `answers` map key/the wire apiType, never `result.question_type`.
    expect(result.question_type).toBe("essay");
    expect(q.question_type).toBe("short_answer");
    // No `prompts` key → EssayPlayer's single-textarea mode (answer = string).
    expect(result.payload.prompts).toBeUndefined();
    expect(result.payload.selfAssessment).toBe(true);
  });

  it("maps a question_group SessionQuestion's sharedContent + children (under the `questions` key), normalizing to `subQuestions` with each child richified", () => {
    const q = makeQuestion({
      question_type: "question_group",
      payload: {
        sharedContent: "Đọc đoạn văn sau",
        // BE/Studio spec shape uses `questions` — dispatch.tsx's own
        // adaptChildren() accepts children ?? subQuestions ?? questions, but
        // the mapper's job is to normalize to ONE canonical output key.
        questions: [
          {
            id: "c1",
            type: "single_choice",
            content: "Child stem",
            options: [
              { id: "A", content: "Option A" },
              { id: "B", content: "Option B" },
            ],
            correctAnswer: "A",
          },
        ],
        score: 1,
      },
    });
    const result = mapSessionQuestion(q);

    expect(result.question_type).toBe("question_group");
    expect(result.payload.sharedContent).toEqual({
      blocks: [{ type: "paragraph", text: "Đọc đoạn văn sau" }],
    });
    expect(result.payload.questions).toBeUndefined();
    expect(result.payload.subQuestions).toEqual([
      {
        id: "c1",
        type: "single_choice",
        content: { blocks: [{ type: "paragraph", text: "Child stem" }] },
        options: [
          {
            id: "A",
            content: { blocks: [{ type: "paragraph", text: "Option A" }] },
          },
          {
            id: "B",
            content: { blocks: [{ type: "paragraph", text: "Option B" }] },
          },
        ],
        selfAssessment: true,
      },
    ]);
    // Record-only, and no grading key leaked into the child either.
    expect(
      (result.payload.subQuestions as Array<Record<string, unknown>>)[0]
        .correctAnswer,
    ).toBeUndefined();
  });

  it("routes a short_answer question_group child through the essay player too, keeping its own type off the wire", () => {
    const q = makeQuestion({
      question_type: "question_group",
      payload: {
        subQuestions: [
          { id: "c1", type: "short_answer", content: "What is 6*7?" },
        ],
        score: 1,
      },
    });
    const result = mapSessionQuestion(q);
    const child = (
      result.payload.subQuestions as Array<Record<string, unknown>>
    )[0];
    expect(child.type).toBe("essay");
  });
});

describe("gradeSessionQuestion", () => {
  it("still grades a practice question after its player mapping injects selfAssessment", () => {
    const q = makeQuestion({});

    // This flag belongs only to the mapped player payload; session grading
    // reads the raw authored schema, which has no selfAssessment opt-out.
    expect(mapSessionQuestion(q).payload.selfAssessment).toBe(true);
    expect(gradeSessionQuestion(q, "A")).toEqual({
      isCorrect: true,
      gradable: true,
    });
  });

  it("does not grade an authored self-assessment question", () => {
    const q = makeQuestion({
      payload: {
        options: [
          { id: "A", content: "Option A" },
          { id: "B", content: "Option B" },
        ],
        correctAnswer: "A",
        selfAssessment: true,
      },
    });

    expect(gradeSessionQuestion(q, "A")).toEqual({
      isCorrect: false,
      gradable: false,
    });
  });

  it("grades a correct single_choice answer as correct", () => {
    const q = makeQuestion({});
    expect(gradeSessionQuestion(q, "A")).toEqual({
      isCorrect: true,
      gradable: true,
    });
  });

  it("grades an incorrect single_choice answer as incorrect", () => {
    const q = makeQuestion({});
    expect(gradeSessionQuestion(q, "B")).toEqual({
      isCorrect: false,
      gradable: true,
    });
  });

  it("grades multiple_choice answers order-independently", () => {
    const q = makeQuestion({
      question_type: "multiple_choice",
      payload: {
        options: [
          { id: "A", content: "Option A" },
          { id: "B", content: "Option B" },
          { id: "C", content: "Option C" },
        ],
        correctAnswer: ["A", "C"],
        score: 1,
      },
    });

    expect(gradeSessionQuestion(q, ["C", "A"])).toEqual({
      isCorrect: true,
      gradable: true,
    });
    expect(gradeSessionQuestion(q, ["A", "B"])).toEqual({
      isCorrect: false,
      gradable: true,
    });
  });

  describe("multi_true_false", () => {
    const q = makeQuestion({
      question_type: "multi_true_false",
      payload: {
        statements: [
          { id: "s1", text: "Statement 1", correctAnswer: true },
          { id: "s2", text: "Statement 2", correctAnswer: false },
          { id: "s3", text: "Statement 3", correctAnswer: true },
        ],
        // Grading key as persisted by the backend/seed history engine: an
        // array of true-statement ids — NOT the Record the player emits.
        correctAnswer: ["s1", "s3"],
        score: 1,
      },
    });

    it("grades the player's Record answer as correct when it matches the statements' own flags", () => {
      expect(
        gradeSessionQuestion(q, { s1: true, s2: false, s3: true }),
      ).toEqual({
        isCorrect: true,
        gradable: true,
      });
    });

    it("grades the player's Record answer as incorrect when it doesn't match", () => {
      expect(gradeSessionQuestion(q, { s1: true, s2: true, s3: true })).toEqual(
        {
          isCorrect: false,
          gradable: true,
        },
      );
    });
  });

  // -------------------------------------------------------------------
  // F2: grading parity for the 6 new types. Cases mirror the mini-fix (A1,
  // evo-books-api) the plan pins as the FE/BE parity contract: ordering
  // strict-order, matching/classification per-pair — gradeByType (grading.ts)
  // already implements these correctly (see grading.test.ts), so these tests
  // pin `gradeSessionQuestion`'s wiring into it, not gradeByType itself.
  // -------------------------------------------------------------------

  it("grades ordering strictly by position — a scrambled order is incorrect even though it's the same set", () => {
    const q = makeQuestion({
      question_type: "ordering",
      payload: {
        items: [
          { id: "o1", content: "A" },
          { id: "o2", content: "B" },
          { id: "o3", content: "C" },
        ],
        correctAnswer: ["o1", "o2", "o3"],
        score: 1,
      },
    });
    expect(gradeSessionQuestion(q, ["o1", "o2", "o3"])).toEqual({
      isCorrect: true,
      gradable: true,
    });
    expect(gradeSessionQuestion(q, ["o3", "o2", "o1"])).toEqual({
      isCorrect: false,
      gradable: true,
    });
  });

  it("grades matching by exact pair — swapping two pairs' right sides is incorrect", () => {
    const q = makeQuestion({
      question_type: "matching",
      payload: {
        leftItems: [
          { id: "l1", content: "L1" },
          { id: "l2", content: "L2" },
        ],
        rightItems: [
          { id: "r1", content: "R1" },
          { id: "r2", content: "R2" },
        ],
        correctAnswer: { l1: "r1", l2: "r2" },
        score: 1,
      },
    });
    expect(gradeSessionQuestion(q, { l1: "r1", l2: "r2" })).toEqual({
      isCorrect: true,
      gradable: true,
    });
    expect(gradeSessionQuestion(q, { l1: "r2", l2: "r1" })).toEqual({
      isCorrect: false,
      gradable: true,
    });
  });

  it("grades classification by exact item→category mapping — swapping two items' categories is incorrect", () => {
    const q = makeQuestion({
      question_type: "classification",
      payload: {
        categories: [
          { id: "cat1", label: "Loại 1" },
          { id: "cat2", label: "Loại 2" },
        ],
        items: [
          { id: "i1", content: "Item 1" },
          { id: "i2", content: "Item 2" },
        ],
        correctAnswer: { i1: "cat1", i2: "cat2" },
        score: 1,
      },
    });
    expect(gradeSessionQuestion(q, { i1: "cat1", i2: "cat2" })).toEqual({
      isCorrect: true,
      gradable: true,
    });
    expect(gradeSessionQuestion(q, { i1: "cat2", i2: "cat1" })).toEqual({
      isCorrect: false,
      gradable: true,
    });
  });

  it("essay is UNGRADABLE regardless of answer (manual grading only)", () => {
    const q = makeQuestion({
      question_type: "essay",
      payload: { prompts: ["Ý 1"], score: 1 },
    });
    expect(gradeSessionQuestion(q, "bài viết của em")).toEqual({
      isCorrect: false,
      gradable: false,
    });
  });

  it("short_answer is UNGRADABLE regardless of answer (BE isAutoGradable=false — grading.ts's substring-match arm is NOT used here)", () => {
    const q = makeQuestion({
      question_type: "short_answer",
      payload: { correctAnswer: "42", score: 1 },
    });
    // Would grade correct via grading.ts's substring-match arm if that arm
    // were reached — asserting UNGRADABLE proves the override short-circuits
    // before gradeByType ever sees it.
    expect(gradeSessionQuestion(q, "42")).toEqual({
      isCorrect: false,
      gradable: false,
    });
  });

  describe("question_group", () => {
    // gradeByType's wrapper case accepts `subQuestions ?? questions` — this
    // fixture uses `questions` (the BE/Studio spec shape) to pin that
    // gradeSessionQuestion doesn't require the mapper's `subQuestions`
    // normalization to grade correctly (grading reads q.payload raw,
    // independent of mapSessionQuestion's player-payload output).
    const q = makeQuestion({
      question_type: "question_group",
      payload: {
        questions: [
          { id: "c1", type: "single_choice", correctAnswer: "A" },
          { id: "c2", type: "single_choice", correctAnswer: "B" },
        ],
        score: 1,
      },
    });

    it("grades correct when the player's wrapped {answers,order} shape has every child right", () => {
      // QuestionGroupPlayer.tsx's actual onAnswerChange emission shape — see
      // unwrapGroupAnswer's doc comment.
      expect(
        gradeSessionQuestion(q, {
          answers: { c1: "A", c2: "B" },
          order: ["c1", "c2"],
        }),
      ).toEqual({ isCorrect: true, gradable: true });
    });

    it("grades incorrect when a child answer is wrong, still reading through the {answers,order} wrapper", () => {
      expect(
        gradeSessionQuestion(q, {
          answers: { c1: "A", c2: "A" },
          order: ["c1", "c2"],
        }),
      ).toEqual({ isCorrect: false, gradable: true });
    });

    it("also accepts an already-flat Record answer (e.g. after a reload via deserializeSessionAnswer)", () => {
      expect(gradeSessionQuestion(q, { c1: "A", c2: "B" })).toEqual({
        isCorrect: true,
        gradable: true,
      });
    });
  });
});

describe("serializeSessionAnswer / deserializeSessionAnswer", () => {
  const mtfQuestion = makeQuestion({
    question_type: "multi_true_false",
    payload: {
      statements: [
        { id: "s1", text: "Statement 1", correctAnswer: true },
        { id: "s2", text: "Statement 2", correctAnswer: false },
        { id: "s3", text: "Statement 3", correctAnswer: true },
      ],
      correctAnswer: ["s1", "s3"],
      score: 1,
    },
  });

  it("passes a multi_true_false player Record answer through unchanged on serialize (QA 30/7: the old array-of-true-ids compression lost chọn-S vs bỏ-trống)", () => {
    const playerAnswer = { s1: true, s2: false, s3: true };
    expect(serializeSessionAnswer(mtfQuestion, playerAnswer)).toEqual({
      s1: true,
      s2: false,
      s3: true,
    });
  });

  it("keeps blank rows ABSENT in a partial multi_true_false answer across serialize -> deserialize (blank ≠ chọn S)", () => {
    // Student answered only s1 (Đ) and s2 (S); s3 was left blank.
    const playerAnswer = { s1: true, s2: false };
    const wire = serializeSessionAnswer(mtfQuestion, playerAnswer);
    expect(wire).toEqual({ s1: true, s2: false });
    const restored = deserializeSessionAnswer(mtfQuestion, wire);
    expect(restored).toEqual({ s1: true, s2: false });
    expect(restored).not.toHaveProperty("s3");
  });

  it("round-trips a full multi_true_false Record answer: serialize -> wire -> deserialize -> identical Record", () => {
    const playerAnswer = { s1: true, s2: false, s3: true };
    const serialized = serializeSessionAnswer(mtfQuestion, playerAnswer);
    const deserialized = deserializeSessionAnswer(mtfQuestion, serialized);
    expect(deserialized).toEqual({ s1: true, s2: false, s3: true });
  });

  it("deserializes a saved multi_true_false array answer into the player's Record form", () => {
    expect(deserializeSessionAnswer(mtfQuestion, ["s2"])).toEqual({
      s1: false,
      s2: true,
      s3: false,
    });
  });

  it("passes non-multi_true_false answers through unchanged on both serialize and deserialize", () => {
    const scQuestion = makeQuestion({});
    expect(serializeSessionAnswer(scQuestion, "A")).toBe("A");
    expect(deserializeSessionAnswer(scQuestion, "A")).toBe("A");

    const mcQuestion = makeQuestion({
      question_type: "multiple_choice",
      payload: {
        options: [
          { id: "A", content: "Option A" },
          { id: "B", content: "Option B" },
        ],
        correctAnswer: ["A", "B"],
        score: 1,
      },
    });
    expect(serializeSessionAnswer(mcQuestion, ["A", "B"])).toEqual(["A", "B"]);
    expect(deserializeSessionAnswer(mcQuestion, ["A", "B"])).toEqual([
      "A",
      "B",
    ]);
  });

  it("passes an already-array multi_true_false answer through unchanged on serialize", () => {
    // Defensive: if something upstream already produced array form, don't
    // double-convert it into an empty array.
    expect(serializeSessionAnswer(mtfQuestion, ["s1", "s3"])).toEqual([
      "s1",
      "s3",
    ]);
  });

  // -------------------------------------------------------------------
  // F2: identity wire-format for ordering/matching/classification/essay/
  // short_answer — per the plan's Global Constraints, the player-emitted
  // shape IS the wire shape for these types (only multi_true_false and
  // question_group transform — see question_group's own describe block
  // below for why it's the one other exception).
  // -------------------------------------------------------------------

  it.each([
    ["ordering", ["o1", "o2", "o3"]],
    ["matching", { l1: "r1", l2: "r2" }],
    ["classification", { i1: "cat1", i2: "cat2" }],
    ["essay", "bài viết của em"],
    ["short_answer", "42"],
  ])(
    "%s: serialize/deserialize are identity (wire shape == player-emitted shape)",
    (type, answer) => {
      const q = makeQuestion({
        question_type: type,
        payload: { score: 1 },
      });
      expect(serializeSessionAnswer(q, answer)).toEqual(answer);
      expect(deserializeSessionAnswer(q, answer)).toEqual(answer);
    },
  );

  describe("question_group", () => {
    const groupQuestion = makeQuestion({
      question_type: "question_group",
      payload: {
        questions: [
          { id: "c1", type: "single_choice", correctAnswer: "A" },
          { id: "c2", type: "single_choice", correctAnswer: "B" },
        ],
        score: 1,
      },
    });

    it("serializes the player's {answers,order} wrapper down to the wire's bare Record<childId,answer>", () => {
      // QuestionGroupPlayer.tsx's actual emission shape (recordAnswer's
      // `report({answers, order}, "incomplete")`) — NOT already a bare
      // Record, unlike the plan's Global Constraints table literally states
      // for "player emit"; see unwrapGroupAnswer's doc comment for why this
      // one type needs a transform despite that.
      const playerAnswer = {
        answers: { c1: "A", c2: "B" },
        order: ["c1", "c2"],
      };
      expect(serializeSessionAnswer(groupQuestion, playerAnswer)).toEqual({
        c1: "A",
        c2: "B",
      });
    });

    it("deserialize is identity — QuestionGroupPlayer's own extractChildAnswers already accepts a bare Record as initialAnswer", () => {
      const saved = { c1: "A", c2: "B" };
      expect(deserializeSessionAnswer(groupQuestion, saved)).toEqual(saved);
    });

    it("round-trips: player wrapper -> serialize -> wire Record -> deserialize (identity) -> still the flat Record a reload would pass as initialAnswer", () => {
      const playerAnswer = {
        answers: { c1: "A", c2: "B" },
        order: ["c1", "c2"],
      };
      const wire = serializeSessionAnswer(groupQuestion, playerAnswer);
      expect(wire).toEqual({ c1: "A", c2: "B" });
      expect(deserializeSessionAnswer(groupQuestion, wire)).toEqual({
        c1: "A",
        c2: "B",
      });
    });
  });
});

describe("tên trường trên wire", () => {
  const schema = {
    options: [
      { id: "A", content: "Option A" },
      { id: "B", content: "Option B" },
    ],
    correctAnswer: "A",
    score: 1,
  };
  const base = {
    id: "q1",
    order: 1,
    question_text: "Pick one",
    question_type: "single_choice",
    level_code: "L1",
    outcome_code: "OC1",
    content_code: "CC1",
  };

  it("đọc `payload` — tên chuẩn Practice phát ra sau khi bỏ tên cột Mongo", () => {
    const q = { ...base, payload: schema } as unknown as SessionQuestion;
    expect(mapSessionQuestion(q).payload.options).toHaveLength(2);
    expect(gradeSessionQuestion(q, "A")).toEqual({
      isCorrect: true,
      gradable: true,
    });
  });
});

describe("đề rich đi thẳng tới player (ảnh/bảng ở phần đề)", () => {
  const IMG = "/storage/bank-assets/b1/assets/images/hinh-ve.png";
  const base = {
    id: "q1",
    order: 1,
    question_text:
      "Quan sát hình vẽ dưới đây và đánh giá tính đúng (Đúng) hoặc sai (Sai) của các phát biểu sau:",
    question_type: "multi_true_false",
    level_code: "L1",
    outcome_code: "OC1",
    content_code: "CC1",
  };

  it("giữ khối ẢNH trong đề — trước đây đề bị dựng lại từ chữ trơn nên hình biến mất, câu hỏi thành không thể trả lời", () => {
    const q = {
      ...base,
      payload: {
        type: "multi_true_false",
        content: {
          blocks: [
            { type: "paragraph", content: [{ text: "Quan sát hình vẽ:" }] },
            { type: "image", url: IMG, altText: "A thuộc d, B không thuộc d" },
          ],
        },
        statements: [{ id: "s1", text: "Điểm A thuộc d" }],
        correctAnswer: { s1: true },
      },
    } as unknown as SessionQuestion;

    const blocks = (
      mapSessionQuestion(q).payload.content as { blocks: { type: string }[] }
    ).blocks;
    expect(blocks.map((b) => b.type)).toContain("image");
    expect(JSON.stringify(blocks)).toContain(IMG);
  });

  it("giữ khối BẢNG trong đề", () => {
    const q = {
      ...base,
      question_type: "single_choice",
      payload: {
        type: "single_choice",
        content: {
          blocks: [
            { type: "paragraph", content: [{ text: "Đọc bảng sau:" }] },
            {
              type: "table",
              rows: [
                ["Năm", "Sản lượng"],
                ["2020", "12"],
              ],
            },
          ],
        },
        options: [
          { id: "A", content: "12" },
          { id: "B", content: "20" },
        ],
        correctAnswer: "A",
      },
    } as unknown as SessionQuestion;

    const blocks = (
      mapSessionQuestion(q).payload.content as { blocks: { type: string }[] }
    ).blocks;
    expect(blocks.map((b) => b.type)).toContain("table");
  });

  it("câu seed KHÔNG có `content` trong payload vẫn lấy đề từ `question_text` (6000 câu trong kho ở dạng này)", () => {
    const q = {
      ...base,
      question_type: "single_choice",
      question_text: "2 + 2 = ?",
      payload: {
        options: [
          { id: "A", content: "4" },
          { id: "B", content: "5" },
        ],
        correctAnswer: "A",
        score: 1,
      },
    } as unknown as SessionQuestion;

    const content = mapSessionQuestion(q).payload.content as {
      blocks: { text?: string }[];
    };
    expect(JSON.stringify(content)).toContain("2 + 2 = ?");
  });

  it("đề rich vẫn là record-only và vẫn chuẩn hoá phương ngữ chuỗi của options", () => {
    const q = {
      ...base,
      question_type: "single_choice",
      payload: {
        content: {
          blocks: [{ type: "paragraph", content: [{ text: "Chọn:" }] }],
        },
        options: [
          { id: "A", content: "Chuỗi trơn kiểu bank" },
          { id: "B", content: "B" },
        ],
        correctAnswer: "A",
      },
    } as unknown as SessionQuestion;

    const mapped = mapSessionQuestion(q);
    expect(mapped.payload.selfAssessment).toBe(true);
    expect(mapped.payload.correctAnswer).toBeUndefined();
    const opts = mapped.payload.options as { content: unknown }[];
    expect(JSON.stringify(opts[0].content)).toContain("Chuỗi trơn kiểu bank");
    expect(typeof opts[0].content).toBe("object");
  });
});
