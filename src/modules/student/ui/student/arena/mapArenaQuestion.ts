/**
 * Bridges an Arena attempt question (`ArenaQuestion`, from `arenaApi.ts`) to
 * `QuestionPlayer` — same job `mapSessionQuestion.ts` does for practice
 * sessions, but NOT built on top of `mapSessionQuestion` itself.
 *
 * Investigated first (per task brief step 1) whether `ArenaQuestion` could be
 * adapted straight into `mapSessionQuestion`'s `SessionQuestion` input (its
 * `payload` field). It cannot: `ArenaQuestion.payload`, when present,
 * is the RICH payload format (blocks/images from Book-module sync) — the
 * exact same wire shape `Paper/Application/UseCases/CreatePaper.php` and
 * `Assessment/.../ExerciseDetailResource.php` (evo-books-api) produce for
 * `StudentQuestion.payload`, and that `mapBackendQuestion`'s "preserve
 * payload" branch consumes directly. `mapSessionQuestion`'s `payload`
 * is a DIFFERENT, flatter shape (`options[].content` as a plain string, no
 * `payload.content` blocks) — passing a rich payload through it reproduces
 * verbatim the bug documented at the top of `mapSessionQuestion.ts` (header
 * falls back to a generic label, every option renders as a bare "A."/"B."
 * with no text).
 *
 * `ArenaQuestion` is field-for-field identical to `StudentQuestion`
 * (`assessmentApi.ts`) minus `correctAnswer` (the backend already strips
 * answer keys before returning attempt questions — see
 * `ArenaQuestionPresenter::strip` / `ArenaQuestionPresenter::stripPayload` in
 * evo-books-api), so this adapter goes straight to `mapBackendQuestion`
 * instead — its "preserve payload when present, else synthesize from
 * content+options" duality is exactly what's needed.
 */
import { mapBackendQuestion } from "@/modules/books/ui/shared/mapBackendQuestion";
import type { StudentQuestion } from "@/modules/books/api/assessmentApi";
import type { PlayerQuestion } from "@/core/exercise/QuestionPlayer";
import type { ArenaQuestion } from "@/modules/student/api/arenaApi";

export function mapArenaQuestion(q: ArenaQuestion): PlayerQuestion {
  const studentQuestion = {
    id: q.id,
    type: q.type,
    content: q.content,
    options: q.options ?? [],
    // `payload: undefined` (field omitted) when absent → mapBackendQuestion
    // takes its synthesize-from-plain-fields branch; `payload` present →
    // its preserve branch. `correctAnswer` is intentionally never set here —
    // the arena runner never client-grades (see ArenaRunner: no "Kiểm tra",
    // no result banner; scoring happens server-side at submit).
    ...(q.payload ? { payload: q.payload } : {}),
  } as StudentQuestion;

  const mapped = mapBackendQuestion(studentQuestion);

  // `mapBackendQuestion`'s synthesize-from-plain-fields fallback (taken
  // whenever `q.payload` is null/absent) only builds `payload.options` —
  // enough for single_choice/multiple_choice (QuestionPlayer's `adaptChoice`
  // reads `payload.options`). It builds nothing else, because that fallback
  // is shared with the books module's SubmissionRunner, where a null
  // `payload` in practice only ever happens for legacy plain-options
  // questions that ARE single/multiple choice — ordering/matching/etc.
  // synced from the Book module always carry a full rich `payload` there, so
  // the gap never surfaced. Arena questions, confirmed live, CAN have
  // `payload: null` for ANY question type, so this arena-scoped mapper fills
  // in the per-type structure QuestionPlayer's other `adaptX` functions read
  // — without touching the shared `mapBackendQuestion` (player-change sync
  // rule: shared code must stay in sync with studio-web; this fix is
  // arena-only and must not require that).
  if (!q.payload) {
    const bareOptions =
      (mapped.payload.options as { id: string; content?: unknown }[] | undefined) ?? [];
    switch (mapped.question_type) {
      case "ordering":
        // QuestionPlayer routes "ordering" to `renderInteractionPlayer`
        // (players/dispatch.tsx), which resolves the manifest's default
        // player for the type — P18 `ReorderListPlayer`. (The legacy
        // OrderingTask fallback that used to sit behind it was dead code
        // and has been removed.) `ReorderListPlayer` is fed via dispatch.tsx's
        // `textItems(p.items as Item[])`, i.e. it reads `payload.items`
        // (array of {id, content}), NOT `payload.options` — this was the
        // root cause of the empty-container bug. A bare option {id, content}
        // is structurally identical to an ordering item, so this is an
        // exact, full synthesis.
        mapped.payload = { ...mapped.payload, items: bareOptions };
        break;
      case "multi_true_false":
        // The multi_true_false player (P63 TrueFalseTablePlayer via
        // players/dispatch.tsx) reads `payload.statements`. A bare option
        // {id, content} is a statement minus
        // its per-item `correctAnswer` flag. Acceptable: the arena never
        // client-grades — `selfAssessment: true` below means every player
        // just reports the answer, it never reads the correctness flag to
        // self-check — so defaulting every statement to unanswered/false is
        // harmless here.
        mapped.payload = { ...mapped.payload, statements: bareOptions };
        break;
      case "matching":
      case "classification":
      case "question_group":
        // NOT synthesizable from a flat options[] list — best-effort
        // pass-through only (payload.options stays, nothing else added):
        //  - matching needs two distinct sides (leftItems/rightItems) plus a
        //    left→right pairing; a flat list has no left/right distinction.
        //  - classification needs categories[] plus each item's categoryId;
        //    categories don't exist anywhere in the bare-options shape.
        //  - question_group needs full subQuestions[] (each a nested
        //    question with its own type/payload); options can't encode that.
        // A null-payload question of these types will still render empty,
        // same as ordering did before this fix. The real fix is the backend
        // not sending `payload: null` for these types — out of scope here.
        break;
      default:
        break;
    }
  }

  // Record-only, same intent as `mapSessionQuestion`'s `selfAssessment: true`:
  // every player must report on every answer change instead of gating behind
  // its own internal "Kiểm tra" button — ArenaRunner owns the (absent) verdict
  // UI. Set unconditionally (not derived from `!hasKey`) so a player type
  // that structurally always carries a correctness key per item (e.g.
  // TrueFalseTablePlayer) doesn't accidentally reveal answers even if a
  // future payload shape retains one the backend's key-stripping missed.
  mapped.payload = {
    ...mapped.payload,
    selfAssessment: true,
  };

  return mapped;
}

/**
 * Convert a player-collected answer into the format the arena API (and
 * `ArenaGrader`'s array-compare grading) persists — same convention
 * `serializeSessionAnswer` uses for practice. All other question types pass
 * through unchanged.
 *
 * Unlike `serializeSessionAnswer`, this needs no schema lookup: it just
 * needs to know the question is `multi_true_false` to convert the player's
 * `Record<statementId, boolean>` into a sorted array of the true ids.
 */
export function serializeArenaAnswer(
  q: ArenaQuestion,
  answer: unknown,
): unknown {
  if (
    q.type === "multi_true_false" &&
    answer &&
    typeof answer === "object" &&
    !Array.isArray(answer)
  ) {
    return Object.entries(answer as Record<string, boolean>)
      .filter(([, v]) => v === true)
      .map(([id]) => id)
      .sort();
  }
  return answer;
}

/**
 * Inverse of `serializeArenaAnswer` — used to hydrate `ArenaRunner`'s answer
 * state from `attempt.answers` (server-persisted, same array-of-true-ids
 * shape). Needs the full statement id list to mark the ones NOT in the saved
 * array as false; reads it from `q.payload.statements` when the source
 * carried a rich payload (the "preserve" branch), else falls back to
 * `q.options` — the same bare-options-as-statements synthesis
 * `mapArenaQuestion` does above for the null-payload case, so a resumed
 * attempt's saved answers restore correctly either way.
 */
export function deserializeArenaAnswer(
  q: ArenaQuestion,
  saved: unknown,
): unknown {
  if (q.type === "multi_true_false" && Array.isArray(saved)) {
    const statements =
      (q.payload?.statements as { id: string }[] | undefined) ??
      q.options ??
      [];
    const trueIds = new Set((saved as unknown[]).map(String));
    return Object.fromEntries(statements.map((s) => [s.id, trueIds.has(s.id)]));
  }
  return saved;
}
