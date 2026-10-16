/**
 * Bridges a practice-session question (`SessionQuestion`, from
 * `practiceApi.ts`) to the existing question-rendering + grading stack:
 * `QuestionPlayer` (via `mapBackendQuestion`) and `gradeByType`.
 *
 * `payload` is NOT the same shape as the rich `payload` the players
 * read (see `src/core/exercise/players/dispatch.tsx`): it has no top-level
 * `content` (question stem) at all, and its `options[].content` is a plain
 * string rather than the `RichContent` (`{blocks:[...]}`) shape
 * `adaptOptions()`/`payloadTitle()` expect. Passing it straight through as
 * `payload` (the old behaviour) made `mapBackendQuestion` take its
 * "preserve payload" branch (mapBackendQuestion.ts lines 20-34), which
 * echoes those fields back untouched — so the header fell back to the
 * player's generic manifest label and every option rendered as a bare
 * "A."/"B." with no text.
 *
 * Fix: build a `StudentQuestion` with `payload` omitted so
 * `mapBackendQuestion` takes its "synthesize from plain fields" fallback
 * branch instead (mapBackendQuestion.ts lines 36-54) — it builds
 * `payload.content`/`payload.options[].content` as proper RichContent from
 * `content`/`options[].content` (a plain string, which is exactly what
 * `payload.options[].content` already is; see `QuestionOption` in
 * assessmentApi.ts).
 *
 * ---------------------------------------------------------------------
 * 9-type passthrough (F1/F2 — see .claude/plans/2026-07-28-practice-runner-9-types.md)
 * ---------------------------------------------------------------------
 * Beyond single_choice/multiple_choice/multi_true_false, `payload`
 * can carry two DIFFERENT dialects for rich fields (item/category/child
 * `content`): bank/seed questions store a plain string; book/studio-synced
 * questions already store `{blocks:[...]}`. `toRich()`/`richifyItems()`
 * below normalize either into the RichContent shape dispatch.tsx's
 * `richToText()` needs — passing a bank-dialect plain string through
 * unconverted would silently render as empty text (same failure mode as the
 * comment above, one level deeper).
 *
 * `typeExtraFields()` is the single per-type allowlist: it adds ONLY the
 * fields dispatch.tsx's `renderPlayerElement` reads for that type (see the
 * bảng contract in the plan) — the rest of `payload` (display/
 * settings/etc., which can carry book-only layout hints the web player
 * stack doesn't support) is never passed through wholesale.
 */
import { mapBackendQuestion } from "@/modules/books/ui/shared/mapBackendQuestion";
import type {
  QuestionOption,
  StudentQuestion,
} from "@/modules/books/api/assessmentApi";
import type { PlayerQuestion } from "@/core/exercise/QuestionPlayer";
import { gradeByType, unwrapGroupAnswer } from "@/core/exercise/grading";
import { sessionPayload, type SessionQuestion } from "./practiceApi";

interface SessionStatement {
  id: string;
  /** The sentence, as the bank authors it. The editor writes it as rich
   * `content` (there is often NO `text` field); dispatch derives the row via
   * `richToText(s.content) || s.text`, so both must be forwarded — see the
   * `multi_true_false` case in `typeExtraFields`. Optional 4th "situation"
   * column and per-cell images ride along the same way. */
  content?: unknown;
  text?: string;
  label?: string;
  situation?: unknown;
  imageUrl?: string;
  image?: { url?: string };
  /** Per-statement Đ/S flag — UI-only (see FORMAT.md); grading uses the
   * top-level `payload.correctAnswer` instead (read unchanged by
   * `gradeSessionQuestion` below). */
  correctAnswer?: boolean;
}

interface RichContent {
  blocks: Array<{ type: string; text?: string; [key: string]: unknown }>;
}

/** True when `v` is already RichContent (`{blocks:[...]}` — book/studio
 * dialect), as opposed to a plain string (bank/seed dialect). */
function isRichContent(v: unknown): v is RichContent {
  return (
    !!v &&
    typeof v === "object" &&
    Array.isArray((v as { blocks?: unknown }).blocks)
  );
}

/** Normalize either dialect into RichContent — identity for an already-rich
 * value, wraps a plain string (or anything else) into a single paragraph. */
function toRich(v: unknown): RichContent {
  if (isRichContent(v)) return v;
  return { blocks: [{ type: "paragraph", text: v == null ? "" : String(v) }] };
}

/** Item/category-like entity carrying an optional `content` field alongside
 * whatever else the type needs (`id`, `text`, `label`, …). Richify ONLY
 * `content` (dialect-normalize it) and leave every other field untouched —
 * dispatch.tsx's `itemText()`/`textItems()` already fall back through
 * `text`/`label`/`id` on their own when `content` is absent. */
function richifyContentField<T extends { content?: unknown }>(o: T): T {
  if (o == null || typeof o !== "object" || o.content == null) return o;
  return { ...o, content: toRich(o.content) };
}

function richifyItems(arr: unknown): unknown[] {
  return Array.isArray(arr) ? arr.map(richifyContentField) : [];
}

/**
 * `multi_true_false` statements each carry their own `correctAnswer` Đ/S
 * flag (payload's top-level `correctAnswer` is a DIFFERENT shape — an
 * array of true-statement ids, used by the backend's array compare and the
 * seed history engine). Both the player payload (`caStmt()` in dispatch.tsx)
 * and client-side grading (`gradeByType`'s `multi_true_false` case, which
 * expects `Record<statementId, boolean>`) need the Record form — derive it
 * once here and reuse it for both.
 */
function mtfCorrectRecord(
  schema: Record<string, unknown>,
): Record<string, boolean> {
  const statements =
    (schema.statements as SessionStatement[] | undefined) ?? [];

  // Hai phương ngữ cùng tồn tại trên đường dây. Ưu tiên cờ Đ/S của TỪNG nhận
  // định; chỉ khi KHÔNG nhận định nào mang cờ mới suy từ mảng id đúng ở cấp
  // trên. Thiếu nhánh sau, câu chỉ có mảng (định dạng của bộ chấm phía máy chủ
  // và dữ liệu gieo cũ) cho ra Record toàn `false` — chấm sai cả câu đúng, và ở
  // màn xem lại thì tô nhầm mọi nhận định thành Sai.
  const coCoRieng = statements.some((s) => s.correctAnswer !== undefined);
  if (coCoRieng) {
    return Object.fromEntries(
      statements.map((s) => [s.id, Boolean(s.correctAnswer)]),
    );
  }

  const dungTheoMang = new Set(
    Array.isArray(schema.correctAnswer) ? (schema.correctAnswer as unknown[]).map(String) : [],
  );

  return Object.fromEntries(
    statements.map((s) => [s.id, dungTheoMang.has(String(s.id))]),
  );
}

/** A question_group/etc. child, still in its raw `payload` shape —
 * carries its own `type` (or `question_type`) plus whatever fields its type
 * needs (options, items, leftItems, …). Never a nested `payload` — children
 * are flat, same as the top-level `payload`. */
interface RawChild {
  id: string;
  type?: string;
  question_type?: string;
  content?: unknown;
  options?: Array<{ id: string; content?: unknown }>;
  [key: string]: unknown;
}

/**
 * Per-type allowlist of EXTRA payload fields (beyond `content`/`options`,
 * which the caller already builds) dispatch.tsx's `renderPlayerElement`
 * reads for `type` — see the bảng contract in the plan. Shared between the
 * top-level question and every question_group child (mutually recursive
 * with `adaptChild` below for nested groups).
 */
function typeExtraFields(
  type: string,
  schema: Record<string, unknown>,
  reveal = false,
): Record<string, unknown> {
  switch (type) {
    case "multi_true_false": {
      // TrueFalseTablePlayer (dispatch.tsx's "TrueFalseTablePlayer" case) reads
      // `payload.statements` — a field the base content/options build doesn't
      // produce. Do NOT inject `correctAnswer`/the Record built by
      // `mtfCorrectRecord` here — see the record-only note in
      // `mapSessionQuestion` below.
      const statements =
        (schema.statements as SessionStatement[] | undefined) ?? [];
      // Forward the SAME rich fields the bank preview passes to dispatch, not
      // just `{ id, text }`. Real statements author their sentence in `content`
      // (rich) with no `text` field, so narrowing to `text` dropped them to
      // their id — the practice runner rendered "s1", "s2", … (#MTF-statement-
      // id-leak). `richToText(s.content) || s.text` in dispatch then resolves
      // the row; `situation`/`imageUrl`/`image` keep the 4-column and image
      // statements working too. Per-statement `correctAnswer` is intentionally
      // NOT forwarded — the player reads correctness from the top-level Record.
      return {
        statements: statements.map((s) => ({
          id: s.id,
          content: s.content,
          text: s.text,
          label: s.label,
          situation: s.situation,
          imageUrl: s.imageUrl,
          image: s.image,
        })),
      };
    }
    case "ordering":
      // ReorderListPlayer (via dispatch's `textItems(p.items)`) — items[{id,content}].
      return { items: richifyItems(schema.items) };
    case "matching": {
      // dispatch's `resolveMatchingColumns` checks canonical `columns` FIRST,
      // falling back to `leftItems`/`rightItems` + `columnALabel`/`columnBLabel`
      // only when `columns` is absent — mirror that priority so passthrough
      // doesn't accidentally prefer the legacy shape over canonical data.
      if (Array.isArray(schema.columns)) {
        return {
          columns: (
            schema.columns as Array<{
              id: string;
              title?: string;
              items?: unknown;
            }>
          ).map((c) => ({ ...c, items: richifyItems(c.items) })),
        };
      }
      return {
        leftItems: richifyItems(schema.leftItems),
        rightItems: richifyItems(schema.rightItems),
        columnALabel: schema.columnALabel,
        columnBLabel: schema.columnBLabel,
      };
    }
    case "classification":
      // CategorizePlayer — categories[{id,label|content}], items[{id,content}].
      return {
        categories: richifyItems(schema.categories),
        items: richifyItems(schema.items),
      };
    case "essay":
    case "short_answer": {
      // short_answer has NO registered player (manifest.ts has no "short_answer"
      // entry) — it is rendered via EssayPlayer instead (single-prompt mode,
      // i.e. no `prompts` key, unless the schema happens to carry one). The
      // caller overrides the PLAYER type to "essay"; this only builds the
      // extra fields, which are identical for both source types.
      const prompts = Array.isArray(schema.prompts)
        ? (schema.prompts as string[])
        : undefined;
      return {
        ...(prompts ? { prompts } : {}),
        ...(schema.minWords !== undefined ? { minWords: schema.minWords } : {}),
        ...(schema.maxWords !== undefined ? { maxWords: schema.maxWords } : {}),
        ...(schema.rubric !== undefined ? { rubric: schema.rubric } : {}),
      };
    }
    case "question_group": {
      // QuestionGroupPlayer reads `sharedContent` + `children` (dispatch's
      // `adaptChildren` accepts `children ?? subQuestions ?? questions` — the
      // raw schema may carry any of subQuestions/questions/children;
      // normalize to ONE canonical output key, `subQuestions`, so dispatch
      // never has to guess which of several present keys is authoritative.
      const rawChildren =
        (schema.subQuestions as RawChild[] | undefined) ??
        (schema.questions as RawChild[] | undefined) ??
        (schema.children as RawChild[] | undefined) ??
        [];
      return {
        ...(schema.sharedContent !== undefined
          ? { sharedContent: toRich(schema.sharedContent) }
          : {}),
        subQuestions: rawChildren.map((c) => adaptChild(c, reveal)),
      };
    }
    default:
      return {};
  }
}

/**
 * Adapt one question_group (etc.) child from its raw `payload` shape
 * into the flat rich payload dispatch.tsx's `adaptChild` renders directly
 * (children are rendered as `renderInteractionPlayer(child.type, child, …)`
 * — the child object itself IS the player payload, not wrapped in
 * `{id,question_type,payload}` the way `PlayerQuestion` is).
 *
 * Recursive: a child whose own type is `question_group` gets its own
 * children adapted the same way, via `typeExtraFields`'s `question_group`
 * case calling back into this function.
 */
function adaptChild(raw: RawChild, reveal = false): Record<string, unknown> {
  const rawType = (raw.type ?? raw.question_type ?? "") as string;
  const playerType = rawType === "short_answer" ? "essay" : rawType;
  const options = Array.isArray(raw.options)
    ? raw.options.map((o) => ({ id: o.id, content: toRich(o.content) }))
    : undefined;
  return {
    id: raw.id,
    type: playerType,
    content: toRich(raw.content),
    ...(options ? { options } : {}),
    // Record-only — see the note in `mapSessionQuestion` below. Set per-child
    // because dispatch.tsx reads `p.selfAssessment` off the CHILD's own
    // payload object (`renderInteractionPlayer` is called once per child with
    // the child itself as `payload`), not inherited from the parent.
    // `selfAssessment` bật chế độ record-only của player (dispatch:
    // `recordOnly = selfAssessment === true || !hasKey`), mà record-only thì
    // player KHÔNG tô ô đúng dù có khoá đáp án lẫn cờ revealCorrect. Ở màn xem
    // lại phải tắt: lúc đó không còn gì để "tự chấm", chỉ còn để đọc.
    selfAssessment: !reveal,
    ...typeExtraFields(rawType, raw, reveal),
    // Xem lại bài đã nộp: con của question_group cũng cần khoá đáp án của
    // CHÍNH nó — dispatch gọi player một lần cho mỗi con với con làm payload.
    ...(reveal ? revealKey(rawType, raw as Record<string, unknown>) : {}),
  };
}

/**
 * Khoá đáp án đúng cho MỘT câu, đúng hình dạng player cần — chỉ dùng ở bề mặt
 * XEM LẠI bài đã nộp.
 *
 * `multi_true_false` là ca riêng: trên đường dây, `payload.correctAnswer` là
 * MẢNG id các nhận định đúng, còn player đọc Record<statementId, boolean> —
 * cùng phép đổi mà `gradeSessionQuestion` đang dùng để chấm.
 */
function revealKey(
  type: string,
  schema: Record<string, unknown>,
): Record<string, unknown> {
  const key = type === "multi_true_false" ? mtfCorrectRecord(schema) : schema.correctAnswer;

  return key === undefined ? {} : { correctAnswer: key };
}

/**
 * `reveal: true` — CHỈ cho bề mặt xem lại bài ĐÃ NỘP: gắn thêm khoá đáp án đúng
 * vào payload để player tô được ô đúng. Mặc định `false` giữ nguyên hành vi khi
 * đang làm bài (xem ghi chú "correctAnswer is intentionally OMITTED" bên dưới).
 */
export interface MapSessionQuestionOptions {
  reveal?: boolean;
}

export function mapSessionQuestion(
  q: SessionQuestion,
  { reveal = false }: MapSessionQuestionOptions = {},
): PlayerQuestion {
  const schema = sessionPayload(q);
  const rawType = q.question_type;
  // short_answer has no registered player — render it via EssayPlayer
  // (single-prompt mode). This only changes the PLAYER type used to pick a
  // renderer; `q.question_type` itself (read by PracticeRunner for the
  // label/badge, the `answers` map key, and the wire `apiType`) is untouched.
  const playerType = rawType === "short_answer" ? "essay" : rawType;

  const studentQuestion = {
    id: q.id,
    type: playerType,
    content: q.question_text,
    // Options are re-attached below as canonical RichContent — see the note
    // there. Left empty here so mapBackendQuestion's synthesized-payload
    // branch does not first flatten them to plain text.
    options: [],
    // No `payload` field → mapBackendQuestion takes the synthesized-payload
    // branch instead of preserving payload verbatim.
    //
    // `correctAnswer` is intentionally OMITTED here: players are record-only
    // (see `payload.selfAssessment` below) and must not receive a grading
    // key — self-grading / pre-reveal is the runner's job, not the player's.
    // `gradeSessionQuestion` grades from `q.payload` directly (raw,
    // unaffected by this omission) — see below.
    //
    // Ngoại lệ DUY NHẤT: `reveal` (màn xem lại bài đã nộp) gắn lại khoá đáp án
    // ở cuối hàm. Lượt làm đã khoá nên không còn gì để lộ, mà thiếu khoá thì
    // câu làm SAI chỉ hiện "Chưa đúng 😅" — học sinh không biết đáp án đúng là
    // gì, đúng chỗ cần nhất (báo lỗi nghiệm thu 17/8).
  } as StudentQuestion;

  const mapped = mapBackendQuestion(studentQuestion);

  // Record-only: every player (single/multi/MTF/ordering/matching/…) must
  // report on every change instead of gating behind its own internal "Kiểm
  // tra" button — PracticeRunner owns the check/verdict UI.
  mapped.payload = {
    ...mapped.payload,
    // ĐỀ ĐI THẲNG, KHÔNG DỰNG LẠI. `mapBackendQuestion` vừa dựng `content` từ
    // `question_text` — một chuỗi CHỮ TRƠN, nên mọi khối khác đoạn văn ở phần
    // đề (ẢNH, BẢNG) bốc hơi: câu "Quan sát hình vẽ dưới đây…" tới học sinh mà
    // không có hình, không thể trả lời được, rồi bị chấm sai (câu GMRQ.TOAN6.
    // CH.139, 11/8). Payload thật đã mang sẵn `content` dạng blocks — dùng
    // thẳng nó, đúng như đường xem trước ngân hàng và Arena vẫn làm.
    //
    // CHỈ ghi đè khi payload thật sự có `content`: 6000/6423 câu trong kho là
    // câu seed/nhập Excel KHÔNG có trường này, đề của chúng chỉ nằm ở
    // `question_text` — ghi đè vô điều kiện sẽ xoá trắng đề của số đó.
    ...(isRichContent(schema.content) ? { content: schema.content } : {}),
    // Attach each option as canonical RichContent (`toRich`), NOT flattened
    // plain text. The player's `optionBodyNode` renders `content.blocks`
    // directly (bold, math, images) and only falls back to flat `text` when
    // there are no blocks — so the bank preview, which passes `o.content`
    // through, shows the real block. Flattening here rebuilt a bare text block
    // and, for canonicalized run-based content (no `block.text`), produced an
    // EMPTY block — the practice runner then showed a blank option, only the
    // A/B/C/D letter. `toRich` normalizes both dialects (string → paragraph,
    // already-rich → identity), matching how question_group child options are
    // already built (`adaptChild`). `...o` keeps `imageUrl`/`image` aliases.
    ...(Array.isArray(schema.options) && schema.options.length > 0
      ? {
          options: (schema.options as QuestionOption[]).map((o) => ({
            ...o,
            content: toRich(o.content),
          })),
        }
      : {}),
    // Xem ghi chú record-only ở `adaptChild`: `reveal` phải tắt cờ này, nếu
    // không thì khoá đáp án gắn ở dòng dưới cũng vô dụng.
    selfAssessment: !reveal,
    ...typeExtraFields(rawType, schema, reveal),
    ...(reveal ? revealKey(rawType, schema) : {}),
  };

  return mapped;
}

const UNGRADABLE = { isCorrect: false, gradable: false };

export function gradeSessionQuestion(
  q: SessionQuestion,
  answer: unknown,
): { isCorrect: boolean; gradable: boolean } {
  const schema = sessionPayload(q);

  // short_answer is never auto-graded in practice (BE `isAutoGradable=false`
  // — see the plan's ASSESS-R2/R3 note). `gradeByType`'s own "short_answer"
  // case does a substring match (used by the book flow's SubmissionRunner);
  // intentionally NOT touched — this override only applies here.
  if (q.question_type === "short_answer") return UNGRADABLE;

  // `multi_true_false`: payload.correctAnswer is an array of
  // true-statement ids (the BE/seed-history format), but gradeByType's
  // multi_true_false case expects Record<statementId, boolean> to match the
  // player's Record answer (see mtfCorrectRecord above). Build that Record
  // as the grading key instead of passing the array straight through.
  const correctTop =
    q.question_type === "multi_true_false"
      ? mtfCorrectRecord(schema)
      : schema.correctAnswer;

  // question_group: gradeByType tự unwrap envelope `{answers, order}` của
  // player (unwrapGroupAnswer trong grading.ts) — không cần tiền xử lý ở đây.
  return gradeByType(q.question_type, schema, correctTop, answer);
}

/**
 * Convert a player-collected answer into the format the practice API (and
 * the seed history engine) persists — the inverse of the Record built by
 * `mapSessionQuestion`/`mtfCorrectRecord` for `multi_true_false`, and of
 * `unwrapGroupAnswer` for `question_group`. All other question types
 * (ordering/matching/classification/essay/short_answer) pass through
 * unchanged — their player-emitted shape IS the wire shape (see the plan's
 * Global Constraints / bảng contract).
 *
 * `multi_true_false`: the player's `Record<statementId, boolean>`
 * (TrueFalseTablePlayer) goes on the wire AS-IS. It used to be compressed
 * into a sorted array of true-statement ids, but that shape can't tell
 * "chọn S" (`id: false`) from "bỏ trống" (id absent), so review had to pad
 * every missing row with `false` and blank rows displayed as a wrong "S"
 * pick (QA player-sync 30/7). The backend's `QuestionGradingService`
 * resolves both dialects (`trueStatementIds`), so the Record grades
 * identically; only fidelity is gained.
 *
 * `question_group`: player emits `{answers: Record<childId,val>, order}`
 * (QuestionGroupPlayer); the wire/BE format is the bare
 * `Record<childId,answer>` — see `unwrapGroupAnswer`.
 */
export function serializeSessionAnswer(
  q: SessionQuestion,
  answer: unknown,
): unknown {
  if (q.question_type === "question_group") {
    return unwrapGroupAnswer(answer);
  }
  return answer;
}

/**
 * Convert a saved answer (as loaded from the practice API, in the same
 * format `serializeSessionAnswer` produces) back into the shape the player
 * expects — the inverse used when hydrating runner state from a reloaded
 * session. All other question types pass through unchanged.
 *
 * `question_group` is identity here (not the inverse of the `{answers,
 * order}` wrap): QuestionGroupPlayer's own `extractChildAnswers` already
 * accepts a bare `Record<childId,answer>` as a fallback when `initialAnswer`
 * has no `.answers` key, so the flat wire shape restores correctly as-is —
 * no re-wrapping needed.
 */
export function deserializeSessionAnswer(
  q: SessionQuestion,
  saved: unknown,
): unknown {
  // Legacy-compat only: sessions saved before the Record wire (and the seed
  // history engine) store multi_true_false as an array of true-statement
  // ids. That shape lost blank-vs-S, so padding every other row with
  // `false` is the best possible restore for OLD data. New sessions save
  // the player Record verbatim and fall through untouched — blank rows
  // stay absent.
  if (q.question_type === "multi_true_false" && Array.isArray(saved)) {
    const schema = sessionPayload(q);
    const statements =
      (schema.statements as SessionStatement[] | undefined) ?? [];
    const trueIds = new Set((saved as unknown[]).map(String));
    return Object.fromEntries(statements.map((s) => [s.id, trueIds.has(s.id)]));
  }
  return saved;
}
