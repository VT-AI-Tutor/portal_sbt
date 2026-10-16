/**
 * BẢN NHÁP đề sinh từ ma trận — kiểu dữ liệu, phép cộng, và máy sinh chạy
 * TỪNG Ô một.
 *
 * Bản nháp KHÔNG lưu vào cơ sở dữ liệu: bỏ dở là chuyện thường ngày, lưu lại
 * chỉ tạo rác và thêm một vòng đời phải dọn. Thứ đắt tiền trong bản nháp là
 * câu do trợ lý AI sinh — mà câu đó đã được lưu vào ngân hàng "AI sinh" của
 * giáo viên ngay lúc sinh, nên đóng nhầm tab cũng không mất công.
 */
import {
  teacherBlueprintApi,
  type BlueprintCell,
  type CognitiveLevel,
  type DraftQuestion,
  type PaperBlueprintInput,
} from "@/modules/teacher/api/teacherBlueprintApi";

/** Một câu trong bản nháp: câu gốc + điểm giáo viên đang đặt cho nó. */
export interface DraftItem extends DraftQuestion {
  points: number;
}

/** Kết quả sinh của MỘT ô — ô hỏng chỉ ô đó hỏng, các ô khác vẫn giữ nguyên. */
export interface DraftCellResult {
  cell: BlueprintCell;
  items: DraftItem[];
  /** Còn thiếu bao nhiêu câu sau khi đã bốc kho và nhờ AI. */
  missing: number;
  /** Câu trợ lý AI trả về nhưng bị loại, kèm lý do đọc được. */
  rejected: { question_text: string; reason: string }[];
  /** Trợ lý AI đang tắt toàn hệ. */
  aiDisabled: boolean;
  /** Lỗi mạng hoặc lỗi máy chủ ở riêng ô này. */
  error?: string;
}

export interface GenerateProgress {
  done: number;
  total: number;
  /** Nhãn ô đang chạy, để hiện trên thanh tiến trình. */
  current: string;
}

/**
 * Sinh bản nháp cho cả ma trận: chạy TỪNG Ô một, bốc kho trước rồi nhờ AI bù
 * đúng phần còn thiếu (PAPER-R10).
 *
 * Vì sao không gom cả ma trận vào một lượt gọi: hàng đợi nền chưa bật trong
 * hệ, còn trần trợ lý AI là 15 giây. Một lượt cho cả đề 20 câu vỡ trần. Cắt
 * theo ô thì mỗi lượt nhỏ và nhanh, chạy được thanh tiến trình, và ô nào hỏng
 * chỉ ô đó hỏng.
 */
export async function generateDraft(
  input: PaperBlueprintInput,
  token: string,
  options: {
    topicLabel: (contentCode: string) => string;
    levelLabel: (levelCode: string) => string;
    onProgress?: (progress: GenerateProgress) => void;
    /** Câu không được dùng lại — id các câu đã nằm trong đề trước của cùng ma trận. */
    excludeIds?: string[];
    /**
     * Lát 3 — chống trúng tủ: máy chủ loại thêm câu học sinh LỚP NÀY đã gặp ở
     * phần luyện tập. Chỉ truyền khi ra đề kiểm tra.
     */
    excludeSeenByClassId?: string;
  },
): Promise<DraftCellResult[]> {
  const results: DraftCellResult[] = [];
  // Dồn dần qua từng ô: một câu đã vào ô này thì không được rơi vào ô sau.
  const used = new Set<string>(options.excludeIds ?? []);

  for (let i = 0; i < input.cells.length; i++) {
    const cell = input.cells[i];
    options.onProgress?.({
      done: i,
      total: input.cells.length,
      current: `${options.topicLabel(cell.content_code)} · ${options.levelLabel(cell.level_code)}`,
    });
    results.push(
      await generateCell(cell, input, token, used, options.topicLabel, {
        excludeSeenByClassId: options.excludeSeenByClassId,
      }),
    );
  }

  options.onProgress?.({
    done: input.cells.length,
    total: input.cells.length,
    current: "",
  });

  return applyEvenPoints(results, input);
}

/**
 * PAPER-R13 — chia đều tổng điểm NGAY khi bản nháp vừa sinh xong.
 *
 * Để mặc 1 điểm mỗi câu rồi trông vào cảnh báo "tổng đang là 9/10, bấm chia
 * lại" là đẩy một phép tính máy làm được sang cho giáo viên, và đề nào không
 * đúng 10 câu cũng chào bằng một dòng đỏ. Giáo viên vẫn sửa từng câu được sau đó.
 */
function applyEvenPoints(
  results: DraftCellResult[],
  input: PaperBlueprintInput,
): DraftCellResult[] {
  if (input.kind !== "exam") return results;

  const count = results.reduce((sum, r) => sum + r.items.length, 0);
  if (count === 0) return results;

  const points = distributePoints(count, input.total_points ?? 10);
  let cursor = 0;
  return results.map((r) => ({
    ...r,
    items: r.items.map((q) => ({ ...q, points: points[cursor++] ?? q.points })),
  }));
}

/** Sinh lại đúng MỘT ô — dùng cho nút thử lại khi một ô hỏng. */
export async function generateCell(
  cell: BlueprintCell,
  input: PaperBlueprintInput,
  token: string,
  used: Set<string>,
  topicLabel: (contentCode: string) => string,
  options: { excludeSeenByClassId?: string } = {},
): Promise<DraftCellResult> {
  const base: DraftCellResult = {
    cell,
    items: [],
    missing: cell.count,
    rejected: [],
    aiDisabled: false,
  };

  try {
    const picked = await teacherBlueprintApi.pickCell(
      {
        subject_code: input.subject_code,
        level: input.level,
        content_code: cell.content_code,
        level_code: cell.level_code,
        count: cell.count,
        printable_only: input.printable_only,
        exclude_ids: [...used],
        exclude_class_id: options.excludeSeenByClassId,
      },
      token,
    );

    const items = picked.questions.map(toDraftItem);
    items.forEach((q) => used.add(q.id));
    base.items = items;
    base.missing = picked.missing;

    if (picked.missing <= 0) return base;

    const generated = await teacherBlueprintApi.generateCell(
      {
        subject: input.subject,
        subject_code: input.subject_code,
        level: input.level,
        content_code: cell.content_code,
        level_code: cell.level_code,
        count: picked.missing,
        printable_only: input.printable_only,
      },
      token,
    );

    base.aiDisabled = generated.ai_disabled;
    base.rejected = generated.rejected;
    const fresh = generated.saved.map(toDraftItem);
    fresh.forEach((q) => used.add(q.id));
    base.items = [...base.items, ...fresh];
    base.missing = Math.max(0, picked.missing - fresh.length);
  } catch (e) {
    base.error = e instanceof Error ? e.message : "Không sinh được ô này.";
  }

  // `topicLabel` chỉ để gọi hàm này khớp chữ ký với chỗ dùng — nhãn hiển thị do
  // màn hình tra, không nhét vào dữ liệu bản nháp.
  void topicLabel;
  return base;
}

function toDraftItem(q: DraftQuestion): DraftItem {
  return { ...q, points: 1 };
}

/**
 * PAPER-R13 — chia đều tổng điểm cho các câu, làm tròn tới 0,25 và dồn phần lẻ
 * vào câu cuối để tổng khớp đúng.
 *
 * Cùng phép chia với máy chủ (`PaperScoring::distribute`): hai bên phải cho ra
 * cùng con số, không thì màn hình hiện một đằng và đề lưu một nẻo.
 */
export function distributePoints(
  questionCount: number,
  totalPoints: number,
): number[] {
  if (questionCount <= 0) return [];
  if (totalPoints <= 0) return Array(questionCount).fill(0);

  const step = 0.25;
  const base = Math.floor(totalPoints / questionCount / step) * step;
  const points = Array(questionCount).fill(round2(base));
  const remainder = round2(totalPoints - base * questionCount);
  points[questionCount - 1] = round2(points[questionCount - 1] + remainder);
  return points;
}

/** Ước lượng số phút làm bài từ dạng câu — cùng bảng hệ số với máy chủ. */
export function estimateMinutes(
  questionTypes: string[],
  minutesPerType: Record<string, number>,
): number {
  const fallback = minutesPerType.default ?? 1.5;
  const total = questionTypes.reduce(
    (sum, type) => sum + (minutesPerType[type] ?? fallback),
    0,
  );
  return Math.ceil(total);
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Tổng số câu của một ma trận. */
export function totalCells(cells: BlueprintCell[]): number {
  return cells.reduce((sum, c) => sum + c.count, 0);
}

/**
 * Tỷ lệ phần trăm theo từng mức nhận thức — con số nhà trường hay soi khi
 * duyệt ma trận ("40% nhận biết, 30% thông hiểu…").
 */
export function levelShares(
  cells: BlueprintCell[],
  levels: CognitiveLevel[],
): { code: string; label: string; count: number; percent: number }[] {
  const total = totalCells(cells);
  return levels.map((level) => {
    const count = cells
      .filter((c) => c.level_code === level.code)
      .reduce((sum, c) => sum + c.count, 0);
    return {
      code: level.code,
      label: level.label,
      count,
      percent: total > 0 ? Math.round((count / total) * 100) : 0,
    };
  });
}
