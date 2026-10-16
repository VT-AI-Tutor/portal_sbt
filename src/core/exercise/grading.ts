/**
 * Pure, type-keyed answer grading shared by the exercise runners.
 *
 * The answer key comes from the single `correctAnswer` field; the question
 * `type` decides how to interpret its shape. `display.interactionType` never
 * influences scoring. Used in "parent"/server grade mode by both runners.
 */

import { gradeGeometryGrid } from '@/core/exercise/geometry/grade';
import { gradeChartBuild } from '@/core/exercise/chart/grade';
import { hotspotAnswerCount } from '@/core/question-schema/hotspot';
import { normalizeMatchEdges, sameMatchEdgeSet } from '@/core/question-schema/matching';
import { resolveNestedQuestions } from '@/core/question-schema/nested-children';
import { QUESTION_TYPE_GRADING } from '@/core/question-schema/question-types.generated';

// ---------------------------------------------------------------------------
// Client-side grading (instant "Kiểm tra")
//
// Pure and keyed PURELY on the question `type`. The answer key comes from the
// single `correctAnswer` field; the `type` decides how to interpret its shape
// (see the per-type contract). `display.interactionType` never influences
// scoring. Recurses for question_group and media_anchored. Returns
// gradable:false for subjective / record-only types so the UI shows "saved"
// rather than a correct/incorrect verdict.
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type GradeSchema = Record<string, any>;
type GradeOutcome = { isCorrect: boolean; gradable: boolean };

const UNGRADABLE: GradeOutcome = { isCorrect: false, gradable: false };
const ok = (isCorrect: boolean): GradeOutcome => ({ isCorrect, gradable: true });

function setEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const s = new Set(a);
  return b.every((x) => s.has(x));
}

function normStr(s: unknown, caseSensitive = false): string {
  const t = String(s ?? "").trim();
  return caseSensitive ? t : t.toLowerCase();
}

/**
 * Coerce a key→value map that may arrive as a plain Record OR as an array of
 * pair objects (e.g. [{left,right}]) into Record<string,string>.
 */
function asRecord(
  v: unknown,
  keyA?: string,
  keyB?: string,
): Record<string, string> {
  const out: Record<string, string> = {};
  if (Array.isArray(v)) {
    for (const m of v as Array<Record<string, unknown>>) {
      if (!m || typeof m !== "object") continue;
      const k = keyA ? m[keyA] : undefined;
      const val = keyB ? m[keyB] : undefined;
      if (k != null) out[String(k)] = String(val ?? "");
    }
  } else if (v && typeof v === "object") {
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      out[k] = String(val ?? "");
    }
  }
  return out;
}

/** Does `got` match `accepted` — a single value or a list of accepted variants? */
function acceptedMatch(got: unknown, accepted: unknown, caseSensitive = false): boolean {
  const g = normStr(got, caseSensitive);
  if (Array.isArray(accepted)) return accepted.some((a) => normStr(a, caseSensitive) === g);
  return normStr(accepted, caseSensitive) === g;
}

/** Every key in `correct` present in `answer` and matching via `cmp`. */
function recordEvery(
  correct: Record<string, unknown>,
  answer: unknown,
  cmp: (got: unknown, want: unknown) => boolean,
): GradeOutcome {
  const keys = Object.keys(correct);
  if (!keys.length) return UNGRADABLE;
  const ans = (answer as Record<string, unknown> | null) ?? {};
  if (typeof ans !== "object") return ok(false);
  return ok(keys.every((k) => cmp(ans[k], correct[k])));
}

// Alias payload v1.0; `adapter.ts` quy về `drawing` nên không có trong bảng sinh.
const MANUAL_TYPE_ALIASES = ["free_draw"];

/**
 * Loại câu máy không chấm được, phải chờ giáo viên chấm tay. Sinh từ bảng spec
 * §5.0 — chép tay là tạo nguồn thứ hai, thêm một loại `manual` là lệch ngay.
 */
const SUBJECTIVE_QUESTION_TYPES: ReadonlySet<string> = new Set([
  ...Object.entries(QUESTION_TYPE_GRADING)
    .filter(([, mode]) => mode === "manual")
    .map(([type]) => type),
  ...MANUAL_TYPE_ALIASES,
]);

/**
 * Đệ quy y như `gradeByType`: câu tự luận thường nằm trong `question_group`
 * (`subQuestions`) hoặc dưới `child`, chỉ soi tầng ngoài là bỏ sót.
 */
export function needsManualGrading(type: string, schema: GradeSchema): boolean {
  if (SUBJECTIVE_QUESTION_TYPES.has(type)) return true;

  const nested = resolveNestedQuestions(schema)?.list as
    | Array<GradeSchema & { type?: unknown }>
    | undefined;
  if (nested?.some((sub) => needsManualGrading(String(sub.type ?? ""), sub))) {
    return true;
  }

  // `media_anchored` treo câu con ở `anchors[].question`, không qua resolver.
  const anchors = schema.anchors as
    | Array<{ question?: GradeSchema & { type?: unknown } }>
    | undefined;
  if (
    anchors?.some(
      (anchor) =>
        anchor?.question != null &&
        needsManualGrading(String(anchor.question.type ?? ""), anchor.question),
    )
  ) {
    return true;
  }

  const child = schema.child as (GradeSchema & { type?: unknown }) | undefined;
  return child != null && needsManualGrading(String(child.type ?? ""), child);
}

export function gradeByType(
  type: string,
  schema: GradeSchema,
  correctTop: unknown,
  answer: unknown,
): GradeOutcome {
  // Grading is keyed PURELY on the question `type`, and the answer key comes
  // from the SINGLE `correctAnswer` field — the `type` decides how to interpret
  // its shape. There are no per-variant key fields (correctCells, correctValues,
  // correctMappings, …). `display.interactionType` never influences scoring.
  // Optional grading SETTINGS (tolerance, caseSensitive, gradingMode) may still
  // be read; they are params, not answer keys.
  // `selfAssessment` is an authored, per-question opt-out.  Do this before
  // type-specific rules so a record-only cloze/fill_blank with a structurally
  // present answer key cannot be turned into an incorrect verdict.
  if (schema.selfAssessment === true) return UNGRADABLE;

  // Dùng chung danh sách với UI để hai bên không lệch nhau.
  if (SUBJECTIVE_QUESTION_TYPES.has(type)) return UNGRADABLE;

  const key = correctTop ?? schema.correctAnswer;
  const caseSensitive = schema.caseSensitive === true;

  switch (type) {
    // ── Hình học trên lưới ô vuông (II.38) ───────────────────────────────
    // KHÔNG nằm trong nhóm `drawing` phía trên: đó là canvas vẽ tay không chấm
    // được, còn đây snap vào lưới nên mọi toạ độ là số nguyên và chấm được chính
    // xác. correctAnswer = { constraints: [...] } — tác giả khai ĐIỀU KIỆN chứ
    // không khai đáp án, vì phần lớn câu có vô hạn hình đúng ("vẽ hình thoi" thì
    // vẽ ở đâu cũng đúng).
    case "geometry_grid": {
      const constraints = (key as { constraints?: unknown } | null | undefined)?.constraints;
      if (!Array.isArray(constraints)) return UNGRADABLE;
      return gradeGeometryGrid(constraints, schema.given, answer as never);
    }

    // ── Dựng biểu đồ (II.39) ─────────────────────────────────────────────
    // correctAnswer = Record<mã hạng mục, số>. Cùng khuôn với numeric_answer
    // nhưng theo TỪNG hạng mục, nên dùng chung luật ở @/core/exercise/chart.
    case "chart_build":
      return gradeChartBuild(key, answer, Number(schema.tolerance ?? 0));
    case "short_answer":
    case "dictation": {
      // correctAnswer = string | string[] of accepted answers (substring match).
      if (key == null) return UNGRADABLE;
      const accepted = Array.isArray(key) ? key : [key];
      const got = normStr(answer, caseSensitive);
      return ok(accepted.some((a) => {
        const n = normStr(a, caseSensitive);
        return got === n || got.includes(n);
      }));
    }

    // ── Selection ────────────────────────────────────────────────────────
    case "single_choice":
      // correctAnswer = string (option id)
      return key == null ? UNGRADABLE : ok(String(key) === String(answer));
    case "multiple_choice": {
      // correctAnswer = string[] (option ids), order-independent
      const exp = (Array.isArray(key) ? key : []).map(String);
      const act = (Array.isArray(answer) ? answer : []).map(String);
      return exp.length ? ok(setEqual(exp, act)) : UNGRADABLE;
    }
    case "true_false":
      // correctAnswer = boolean; chưa trả lời KHÔNG được tính đúng dù key là false.
      return key == null
        ? UNGRADABLE
        : ok(answer != null && Boolean(key) === Boolean(answer));
    case "multi_true_false":
    case "multi_true_false_table":
      // correctAnswer = Record<statementId, boolean>
      return recordEvery(
        (key as Record<string, unknown>) ?? {},
        answer,
        (got, want) => Boolean(got) === Boolean(want),
      );

    // ── Text / numeric ───────────────────────────────────────────────────
    case "numeric_answer": {
      // correctAnswer = number (tolerance is an optional setting)
      const target = Number(key);
      if (Number.isNaN(target)) return UNGRADABLE;
      // A blank/absent answer is unanswered — not 0. Guard before Number(),
      // since Number(null) === 0 and Number("") === 0 would score a target-0
      // question correct with nothing entered.
      if (answer == null || answer === "") return ok(false);
      const tol = Number(schema.tolerance ?? 0);
      const got = Number(answer);
      return Number.isNaN(got) ? ok(false) : ok(Math.abs(got - target) <= tol);
    }
    case "math_expression": {
      // correctAnswer = string | string[] accepted forms
      if (key == null) return UNGRADABLE;
      const accepted = (Array.isArray(key) ? key : [key]).map(String);
      const symbolic =
        schema.gradingMode === "symbolic" || accepted.some((a) => Number.isNaN(Number(a)));
      if (symbolic) {
        const norm = (s: string) => s.replace(/\s+/g, "").toLowerCase();
        const a = norm(String(answer ?? ""));
        return ok(accepted.some((x) => norm(x) === a));
      }
      const target = Number(accepted[0]);
      if (Number.isNaN(target)) return UNGRADABLE;
      const tol = Number(schema.tolerance ?? 0);
      return ok(Math.abs(Number(answer) - target) <= tol);
    }
    case "fill_blank":
    case "cloze":
    case "table_completion":
    case "diagram_fill":
    case "crossword":
      // correctAnswer = Record<blankId|cellKey|nodeId, string | string[]>
      // (each value is the accepted answer or a list of accepted variants)
      if (type === "diagram_fill" && Array.isArray(schema.correctAnswerAlternatives)) {
        const candidates = [key, ...schema.correctAnswerAlternatives];
        return candidates.some((candidate) =>
          candidate && typeof candidate === "object" && !Array.isArray(candidate) &&
          (() => {
            const expected = candidate as Record<string, unknown>;
            const actual = (answer as Record<string, unknown> | null) ?? {};
            const keys = Object.keys(expected);
            return Object.keys(actual).length === keys.length &&
              keys.every((k) => acceptedMatch(actual[k], expected[k], caseSensitive));
          })(),
        ) ? ok(true) : ok(false);
      }
      return recordEvery(
        (key as Record<string, unknown>) ?? {},
        answer,
        (got, want) => acceptedMatch(got, want, caseSensitive),
      );

    // ── Ordering / path ──────────────────────────────────────────────────
    case "ordering":
    case "path_connect": {
      // correctAnswer = string[] in correct order
      const order = (Array.isArray(key) ? key : []).map(String);
      const act = (Array.isArray(answer) ? answer : []).map(String);
      return order.length
        ? ok(order.length === act.length && order.every((v, i) => v === act[i]))
        : UNGRADABLE;
    }

    // ── Matching / mapping (Record<a,b> equality) ────────────────────────
    case "matching":
      // correctAnswer sống ở HAI phương ngữ, cả hai đều là dữ liệu thật:
      // Record<leftId,rightId> (đặc tả) và MẢNG CẠNH [{item,target}] — shape
      // Studio đang phát, cố ý, vì Record không diễn đạt được quan hệ
      // một-nhiều (khoá trùng đè nhau). Player đọc cả hai qua
      // `normalizeMatchEdges`; dựng Record theo khoá "left"/"right" ở đây thì
      // mảng cạnh cho ra map RỖNG → gradable:false, mà PracticeRunner quy về
      // "sai" — học sinh nối ĐÚNG vẫn bị báo sai. So theo TẬP CẠNH, dùng đúng
      // helper của player nên hai bên không thể lệch luật.
      return normalizeMatchEdges(key).length === 0
        ? UNGRADABLE
        : ok(sameMatchEdgeSet(answer, key));
    case "labeling":
      // correctAnswer = Record<labelId,targetId> (or [{labelId,targetId}])
      return recordEvery(asRecord(key, "labelId", "targetId"), answer, (g, w) => String(g) === String(w));
    case "drag_drop":
      // correctAnswer = Record<draggableId|cellKey, zoneId|tokenId>
      return recordEvery(asRecord(key, "draggableId", "dropZoneId"), answer, (g, w) => String(g) === String(w));
    case "card_sort":
      // correctAnswer = Record<cardId,categoryId>
      return recordEvery(asRecord(key, "cardId", "categoryId"), answer, (g, w) => String(g) === String(w));
    case "classification": {
      // correctAnswer = Record<itemId,categoryId> (or [{itemId,categoryId|bucketId}]).
      // Answer may be the new Record<itemId,categoryId> or legacy Record<cat,itemId[]>.
      const expected = Array.isArray(key)
        ? (() => {
            const r: Record<string, string> = {};
            for (const m of key as Array<Record<string, unknown>>) {
              const cat = m.categoryId ?? m.bucketId;
              if (m.itemId != null && cat != null) r[String(m.itemId)] = String(cat);
            }
            return r;
          })()
        : asRecord(key);
      const keys = Object.keys(expected);
      if (!keys.length) return UNGRADABLE;
      const a = answer as Record<string, unknown> | null;
      if (!a || typeof a !== "object") return ok(false);
      if (Object.values(a).every((v) => typeof v === "string")) {
        return ok(keys.every((k) => (a as Record<string, string>)[k] === expected[k]));
      }
      const got: Record<string, string> = {};
      for (const [cat, ids] of Object.entries(a as Record<string, string[]>)) {
        for (const id of ids ?? []) got[id] = cat;
      }
      return ok(keys.every((k) => got[k] === expected[k]));
    }
    case "checkbox_table": {
      // correctAnswer = Record<rowId, columnId[]> — per-row set equality
      const correct = (key as Record<string, unknown>) ?? {};
      const keys = Object.keys(correct);
      if (!keys.length) return UNGRADABLE;
      const ans = (answer as Record<string, string[]> | null) ?? {};
      return ok(
        keys.every((k) =>
          setEqual(
            (Array.isArray(correct[k]) ? (correct[k] as string[]) : []).map(String),
            (Array.isArray(ans[k]) ? ans[k] : []).map(String),
          ),
        ),
      );
    }

    // ── Image / spatial ──────────────────────────────────────────────────
    case "hotspot": {
      // correctAnswer = string (single) | string[] (multiple) | {count} (multiple —
      // đúng khi chọn ĐỦ SỐ LƯỢNG vùng, bất kể vùng nào, vd "Tô màu 2 bông hoa").
      if (key != null && typeof key === "object" && !Array.isArray(key)) {
        const count = hotspotAnswerCount(key);
        if (count == null) return UNGRADABLE;
        return ok(Array.isArray(answer) && answer.length === count);
      }
      if (Array.isArray(key) || Array.isArray(answer)) {
        const exp = (Array.isArray(key) ? key : []).map(String);
        const act = (Array.isArray(answer) ? answer : []).map(String);
        return exp.length ? ok(setEqual(exp, act)) : UNGRADABLE;
      }
      return key == null ? UNGRADABLE : ok(String(key) === String(answer));
    }
    case "point_marking": {
      // correctAnswer = {x,y}; tolerance optional setting
      const target = key as { x: number; y: number } | undefined;
      const pt = answer as { x: number; y: number } | undefined;
      if (!target || typeof target.x !== "number" || !pt || typeof pt.x !== "number")
        return UNGRADABLE;
      const tol = Number(schema.tolerance ?? 0.08);
      return ok(Math.hypot(pt.x - target.x, pt.y - target.y) <= tol);
    }
    case "connect_points": {
      // correctAnswer = [{from,to}] — undirected edge-set equality
      const conns = Array.isArray(key) ? (key as Array<{ from: string; to: string }>) : [];
      const norm = (x: string, y: string) => [x, y].sort().join("|");
      const expSet = new Set(conns.map((c) => norm(c.from, c.to)));
      const actArr = Array.isArray(answer) ? (answer as Array<{ from: string; to: string }>) : [];
      const actSet = new Set(actArr.map((c) => norm(c.from, c.to)));
      return conns.length
        ? ok(expSet.size === actSet.size && [...expSet].every((k) => actSet.has(k)))
        : UNGRADABLE;
    }

    // ── Scale / rating ───────────────────────────────────────────────────
    case "scale": {
      // correctAnswer = number (single) | Record<pairId,number> (differential)
      // | null/undefined for self-report (record-only).
      if (key == null) return UNGRADABLE;
      if (typeof key === "object") {
        return recordEvery(
          key as Record<string, unknown>,
          answer,
          (g, w) => Number(g) === Number(w),
        );
      }
      const tol = Number(schema.tolerance ?? 0);
      return ok(Math.abs(Number(answer) - Number(key)) <= tol);
    }

    // ── Highlight ────────────────────────────────────────────────────────
    case "highlight": {
      // correctAnswer = string[] (segment ids) | number[] (word indices)
      const exp = (Array.isArray(key) ? key : []).map(String);
      const act = (Array.isArray(answer) ? (answer as unknown[]) : []).map(String);
      return exp.length ? ok(setEqual(exp, act)) : UNGRADABLE;
    }

    // ── Composite (recursive) ────────────────────────────────────────────
    case "media_anchored": {
      const anchors =
        (schema.anchors as Array<{ id: string; question: GradeSchema & { type: string } }>) ?? [];
      const ans = (answer as Record<string, unknown>) ?? {};
      const results = anchors
        .map((a) =>
          gradeByType(a.question.type, a.question, a.question.correctAnswer, ans[a.id]),
        )
        .filter((r) => r.gradable);
      return results.length ? ok(results.every((r) => r.isCorrect)) : UNGRADABLE;
    }
    case "question_group":
    case "timed_quiz":
    case "lives_streak":
    case "board_game": {
      // All four wrap a child list (spec §5.39-41) — same recursion as
      // question_group; grading a wrapper means every gradable child is correct.
      // Key con qua resolver chuẩn (children > subQuestions > questions) — trước
      // đây bỏ sót `children` (key v2.0 studio soạn) nên nhóm đó thành UNGRADABLE.
      const subs = (resolveNestedQuestions(schema)?.list ?? []) as Array<
        GradeSchema & { id?: string; type: string }
      >;
      // Answer có thể là envelope `{answers, ...meta}` (các wrapper player emit)
      // hoặc record phẳng `{childId: answer}`. Bỏ unwrap khi có con id "answers" thật.
      const groupAns = subs.some((s) => s.id === "answers")
        ? ((answer as Record<string, unknown>) ?? {})
        : unwrapGroupAnswer(answer);
      // Fallback key con không id phải khớp dispatch/adaptChildren (`child-${i}`).
      const results = subs
        .map((s, i) =>
          gradeByType(s.type, s, s.correctAnswer, groupAns[s.id ?? `child-${i}`]),
        )
        .filter((r) => r.gradable);
      return results.length ? ok(results.every((r) => r.isCorrect)) : UNGRADABLE;
    }
    case "path_trail": {
      // Single nested `child` (spec §5.42), not an array — grade it directly.
      // PathTrailPlayer emit envelope `{answer, progress, stepIndex}`; shape cũ
      // key theo id con vẫn được chấp nhận.
      const child = schema.child as (GradeSchema & { id?: string; type: string }) | undefined;
      if (!child) return UNGRADABLE;
      const ans =
        answer && typeof answer === "object" && !Array.isArray(answer)
          ? (answer as Record<string, unknown>)
          : {};
      const childAns = "answer" in ans ? ans.answer : ans[child.id ?? "trail-child"];
      return gradeByType(child.type, child, child.correctAnswer, childAns);
    }

    // ── Câu đố: ĐỊNH NGHĨA câu đố chính là đáp án ────────────────────────
    // Sáu loại dưới đây không có `correctAnswer` — `words`, `pairs`, `answer`,
    // `differences`… vừa là đề vừa là đáp án. Luật chấm vì thế là "học sinh đã
    // hoàn thành câu đố chưa", và phải soi gương ĐÚNG điều kiện thắng của player
    // (ghi ở đầu mỗi file player), vì player đã tự chấm khi học sinh chơi xong.
    //
    // Trước bản này cả sáu rơi vào `default: UNGRADABLE` nên học sinh chơi xong
    // không có điểm — dù studio-be đã khai chúng là `auto`.
    case "word_search": {
      // Học sinh báo [{word, cells}]. Đúng khi tìm đủ mọi từ trong `words`.
      const words = (schema.words as unknown[] | undefined) ?? [];
      if (!words.length) return UNGRADABLE;
      const want = new Set(words.map((w) => normStr(w)));
      const got = new Set(
        (Array.isArray(answer) ? answer : []).map((f) =>
          normStr(f && typeof f === "object" ? (f as { word?: unknown }).word : f),
        ),
      );
      return ok(want.size === got.size && [...want].every((w) => got.has(w)));
    }
    case "memory_match": {
      // Học sinh báo string[] mã cặp đã ghép. Đúng khi ghép hết.
      const pairs = (schema.pairs as Array<{ id?: unknown }> | undefined) ?? [];
      if (!pairs.length) return UNGRADABLE;
      const want = pairs.map((p) => String(p?.id ?? ""));
      const got = (Array.isArray(answer) ? answer : []).map(String);
      return ok(setEqual(want, [...new Set(got)]));
    }
    case "pikachu": {
      // Học sinh báo SỐ cặp đã ăn. Đúng khi ăn hết bàn.
      const tiles = (schema.tiles as unknown[] | undefined) ?? [];
      if (!tiles.length) return UNGRADABLE;
      const cleared = Number(answer);
      return Number.isFinite(cleared) ? ok(cleared === tiles.length / 2) : ok(false);
    }
    case "spot_difference": {
      // Học sinh báo string[] mã điểm khác biệt đã tìm. Đúng khi tìm hết.
      const diffs = (schema.differences as Array<{ id?: unknown }> | undefined) ?? [];
      if (!diffs.length) return UNGRADABLE;
      const want = diffs.map((d) => String(d?.id ?? ""));
      const got = (Array.isArray(answer) ? answer : []).map(String);
      return ok(setEqual(want, [...new Set(got)]));
    }
    case "hangman": {
      // Học sinh báo chuỗi đã mở. Đúng khi trùng `answer` của đề.
      const target = schema.answer;
      if (target == null || target === "") return UNGRADABLE;
      return ok(normStr(answer) === normStr(target));
    }
    case "jigsaw": {
      // Học sinh báo [{pieceId, slotId}]. Mảnh `r-c` thuộc ô `r-c`, nên đúng khi
      // MỌI mảnh nằm đúng ô của nó — và phải đủ số mảnh, không chỉ đúng phần đã đặt.
      const grid = (schema.grid as { rows?: unknown; cols?: unknown } | undefined) ?? {};
      const total = Number(grid.rows ?? 0) * Number(grid.cols ?? 0);
      if (!total) return UNGRADABLE;
      const placements = (Array.isArray(answer) ? answer : []) as Array<Record<string, unknown>>;
      const placed = placements.filter((m) => m && String(m.pieceId) === String(m.slotId));
      return ok(placed.length === total);
    }

    default:
      return UNGRADABLE;
  }
}

/**
 * Unwrap a wrapper-player answer envelope `{answers: Record<childId, answer>,
 * ...meta}` (QuestionGroup/TimedQuiz/LivesStreak/BoardGame emission shape) to
 * the flat `Record<childId, answer>` the grader and the persisted wire format
 * use. A flat record passes through unchanged; non-objects become `{}`.
 */
export function unwrapGroupAnswer(answer: unknown): Record<string, unknown> {
  if (!answer || typeof answer !== "object" || Array.isArray(answer)) return {};
  const record = answer as Record<string, unknown>;
  const nested = record.answers;
  if (nested && typeof nested === "object" && !Array.isArray(nested)) {
    return nested as Record<string, unknown>;
  }
  return record;
}

/**
 * Is an answer "empty" (i.e. the question is unanswered)? Treats as empty:
 * null/undefined, a blank string (trimmed), an empty array, or an empty plain
 * object. A wrapper envelope `{answers, ...meta}` is judged by the values of
 * its `answers` record (meta keys like `order`/`elapsedMs` don't count).
 * Shared by the runners' "câu chưa làm" soft-warning guard.
 */
export function isAnswerEmpty(answer: unknown): boolean {
  if (answer == null) return true;
  if (typeof answer === "string") return answer.trim() === "";
  if (Array.isArray(answer)) return answer.length === 0;
  if (typeof answer === "object") {
    const nested = (answer as Record<string, unknown>).answers;
    if (nested && typeof nested === "object" && !Array.isArray(nested)) {
      return Object.values(nested).every(isAnswerEmpty);
    }
    return Object.keys(answer as object).length === 0;
  }
  return false;
}

/**
 * Convenience for "parent" grade mode: map a graded outcome to the display
 * verdict a player shows. Returns undefined when there is no answer to judge
 * (so the parent can withhold the banner until the student has answered).
 */
export function verdictFor(
  type: string,
  schema: GradeSchema,
  correctTop: unknown,
  answer: unknown,
): "correct" | "incorrect" | "incomplete" | undefined {
  if (answer == null || (typeof answer === "object" && !Array.isArray(answer) && Object.keys(answer as object).length === 0))
    return undefined;
  const r = gradeByType(type, schema, correctTop, answer);
  return r.gradable ? (r.isCorrect ? "correct" : "incorrect") : "incomplete";
}
