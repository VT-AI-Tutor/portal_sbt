/**
 * P82 — blanks that live inside a mathematical formula.
 *
 * The formula itself is authored as an ordinary `{ type: "math" }` content block;
 * what makes it interactive is a `\placeholder[id]{}` sitting somewhere inside its
 * LaTeX. Everything here is pure so the grading and extraction rules can be tested
 * without MathLive, whose custom element does not register in jsdom.
 *
 * The blank ids in the LaTeX are the source of truth for WHICH blanks exist;
 * `blanks[]` only says how each one is graded. An id present in the formula but
 * absent from `blanks[]` therefore still renders — it simply has no key.
 */
import type { RichContent, RichContentBlock } from "@/core/question-schema";
import { hasMathPlaceholder, mathPlaceholderIds } from "@/core/math/mathPlaceholders";
import {
  gradeMathExpression,
  type MathGrade,
  type MathGradingMode,
} from "@/core/math/grading";

export interface MathClozeBlank {
  id: string;
  correctAnswer: string[];
  gradingMode?: MathGradingMode;
  tolerance?: number;
}

function isInteractiveFormula(block: RichContentBlock): boolean {
  return block.type === "math" && hasMathPlaceholder(block.latex ?? block.text ?? "");
}

/**
 * Đường dẫn tới một khối trong `content.blocks`.
 *
 * `[i]` là khối cấp cao thứ i; `[i, c, j]` là khối thứ j trong cột thứ c của khối
 * bố cục thứ i, và cứ thế lồng tiếp.
 */
export type BlockPath = number[];

/**
 * MỘT phép duyệt để đọc, dùng chung cho mọi hàm chỉ-đọc trong file này.
 *
 * Trước đây mỗi hàm tự đi vào `columns` theo cách riêng. Đúng lớp lỗi ấy đã xảy ra
 * một lần: trình soạn không đi vào cột trong khi player có đi, nên công thức đặt
 * trong cột tương tác được với học sinh mà tác giả không khai được đáp án.
 */
function walkMathBlocks(
  content: RichContent | undefined,
  visit: (block: RichContentBlock, path: BlockPath) => void,
): void {
  const walk = (blocks: RichContentBlock[] | undefined, prefix: BlockPath) => {
    (blocks ?? []).forEach((block, index) => {
      const path = [...prefix, index];
      visit(block, path);
      block.columns?.forEach((column, columnIndex) => walk(column, [...path, columnIndex]));
    });
  };
  walk(content?.blocks, []);
}

/**
 * MỘT phép dựng lại, dùng chung cho mọi hàm biến-đổi trong file này.
 *
 * `transform` trả khối thay thế, hoặc `null` để bỏ khối đó. Cột **trở nên** rỗng vì
 * lần bỏ này thì dọn theo, và khối bố cục mất hết cột cũng đi luôn — nhưng cột vốn
 * đã rỗng từ nội dung tác giả thì giữ nguyên, vì dọn nó là sửa nội dung không ai yêu cầu.
 */
function mapMathBlocks(
  content: RichContent,
  transform: (block: RichContentBlock, path: BlockPath) => RichContentBlock | null,
): RichContent {
  const rebuild = (blocks: RichContentBlock[], prefix: BlockPath): RichContentBlock[] => {
    const next: RichContentBlock[] = [];
    blocks.forEach((block, index) => {
      const path = [...prefix, index];
      const replacement = transform(block, path);
      if (!replacement) return;
      if (!replacement.columns) {
        next.push(replacement);
        return;
      }
      const columns = replacement.columns
        .map((column, columnIndex) => ({
          before: column,
          after: rebuild(column, [...path, columnIndex]),
        }))
        .filter(({ before, after }) => after.length > 0 || before.length === 0)
        .map(({ after }) => after);
      if (columns.length === 0 && replacement.columns.length > 0) return;
      next.push({ ...replacement, columns });
    });
    return next;
  };
  return { ...content, blocks: rebuild(content.blocks, []) };
}

/** LaTeX of every math block carrying at least one blank, in document order. */
export function mathClozeFormulas(content: RichContent | undefined): string[] {
  const formulas: string[] = [];
  walkMathBlocks(content, (block) => {
    if (isInteractiveFormula(block)) formulas.push(block.latex ?? block.text ?? "");
  });
  return formulas;
}

/**
 * The same content with the interactive formulas taken out.
 *
 * `PlayerShell` renders the content blocks as the question header; leaving the
 * formula in would draw it twice — once statically through KaTeX and once as the
 * interactive field the player owns.
 */
export function stripMathClozeBlocks(
  content: RichContent | undefined,
): RichContent | undefined {
  if (!content?.blocks) return undefined;
  const pruned = mapMathBlocks(content, (block) => (isInteractiveFormula(block) ? null : block));
  return pruned.blocks.length ? pruned : undefined;
}

/** Blank ids in the order the pupil meets them, across every formula. */
export function mathClozeBlankIds(formulas: string[]): string[] {
  const ids: string[] = [];
  for (const formula of formulas) {
    for (const id of mathPlaceholderIds(formula)) {
      if (!ids.includes(id)) ids.push(id);
    }
  }
  return ids;
}

/** Grade one blank, falling back to the question-level mode when it declares none. */
export function gradeMathClozeBlank(
  blank: MathClozeBlank,
  value: string,
  fallbackMode?: MathGradingMode,
  fallbackTolerance?: number,
): MathGrade {
  return gradeMathExpression(
    value,
    blank.correctAnswer ?? [],
    blank.gradingMode ?? fallbackMode ?? "symbolic",
    blank.tolerance ?? fallbackTolerance ?? 1e-9,
  );
}

export interface ShownPromptState {
  state: "correct" | "incorrect" | undefined;
  locked: boolean;
}

/**
 * Có cần ghi lại trạng thái của một ô trống vào MathLive không?
 *
 * Ghi liên tục vào một phần tử đang giữ con trỏ là chỗ dễ sinh lỗi khó tái hiện,
 * nên chỉ ghi khi thứ ĐANG hiển thị khác thứ cần hiển thị. `shown` là `undefined`
 * khi chưa đọc được (chưa dựng xong, hoặc ngoài trình duyệt) — lúc đó cứ ghi, vì
 * không biết thì không được phép bỏ qua.
 */
export function shouldApplyPromptState(
  shown: ShownPromptState | undefined,
  verdict: "correct" | "incorrect" | undefined,
  shouldLock: boolean,
): boolean {
  if (!shown) return true;
  return shown.state !== verdict || shown.locked !== shouldLock;
}

/**
 * Khoá theo NỘI DUNG của bài làm, dùng để biết cha có đẩy xuống một bài làm khác
 * hay chỉ là tiếng vọng của chính mình.
 *
 * Host lưu nguyên đối tượng player phát ra rồi trả lại làm prop (`QuestionRenderer`
 * dùng `onAnswerChange={setAnswer}`), nên so bằng ĐỊNH DANH thì lần nào cũng khác
 * và player sẽ dựng lại công thức sau mỗi phím gõ — mất con trỏ và mất trạng thái
 * đúng/sai của các ô. Sắp khoá trước khi nối để thứ tự thuộc tính không tạo ra
 * khác biệt giả.
 */
export function stableAnswerKey(values: Record<string, string>): string {
  return JSON.stringify(
    Object.keys(values)
      .sort()
      .map((id) => [id, values[id]]),
  );
}

/** Đường dẫn tới MỌI khối `math`, theo thứ tự tài liệu. */
export function mathBlockPaths(content: RichContent | undefined): BlockPath[] {
  const paths: BlockPath[] = [];
  walkMathBlocks(content, (block, path) => {
    if (block.type === "math") paths.push(path);
  });
  return paths;
}

const samePath = (a: BlockPath, b: BlockPath) =>
  a.length === b.length && a.every((step, index) => step === b[index]);

function blockAtPath(
  content: RichContent | undefined,
  path: BlockPath,
): RichContentBlock | undefined {
  let found: RichContentBlock | undefined;
  walkMathBlocks(content, (block, candidate) => {
    if (samePath(candidate, path)) found = block;
  });
  return found;
}

/** LaTeX của khối tại `path`, hoặc chuỗi rỗng khi đường dẫn không tồn tại. */
export function latexAtPath(content: RichContent | undefined, path: BlockPath): string {
  const block = blockAtPath(content, path);
  return block?.latex ?? block?.text ?? "";
}

/** Bản sao của `content` với LaTeX tại `path` được thay; đường dẫn sai thì giữ nguyên. */
export function withLatexAtPath(
  content: RichContent,
  path: BlockPath,
  latex: string,
): RichContent {
  if (!blockAtPath(content, path)) return content;
  return mapMathBlocks(content, (block, candidate) =>
    samePath(candidate, path) ? { ...block, latex } : block,
  );
}
