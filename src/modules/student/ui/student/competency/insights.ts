/**
 * Suy luận thuần cho màn Năng lực (spec Owner 2026-08-07):
 * - Ngưỡng mẫu 0 / 1–2 / 3–7 / 8–19 / ≥20 (không hiện % dưới 3 câu).
 * - Mốc thành thạo mức đề 60%; chênh <8 điểm coi là ngang nhau.
 * - Mức trên cao hơn mức dưới ≥20 điểm -> nghi lỗi gắn nhãn, loại khỏi kết luận.
 * Mọi text nhận xét sinh ở đây để test được — UI chỉ render.
 */
import type { CompetencySubjectDetail } from "@/modules/student/api/practiceApi";

export type SampleStatus = "none" | "locked" | "provisional" | "solid" | "confident";
export const MASTERY_THRESHOLD = 60;
export const SCORE_MIN_ATTEMPTS = 3;
/** Dưới mốc này thì NHẬN XÉT (khối E) tự nói "kết quả còn sơ bộ". Trang đọc
 * hằng này để KHÔNG dựng thêm dải cảnh báo cùng nghĩa — caveat chỉ được xuất
 * hiện đúng một chỗ trên màn (spec §7). */
export const COMMENT_CAVEAT_MIN_ATTEMPTS = 8;
const TIE_GAP = 8;
const ANOMALY_GAP = 20;

export function sampleStatus(attempted: number): SampleStatus {
  if (attempted <= 0) return "none";
  // Biên "locked" (chưa đủ mẫu để hiện %) PHẢI khớp `isScored`/`SCORE_MIN_ATTEMPTS`
  // — hai nơi diễn đạt cùng một luật là mảnh đất của lỗi trôi (đã từng xảy ra,
  // xem finding #3 của đợt review 2026-08-07). Đổi ngưỡng thì sửa MỘT hằng số
  // này, sampleStatus tự theo.
  if (attempted < SCORE_MIN_ATTEMPTS) return "locked";
  if (attempted <= 7) return "provisional";
  if (attempted <= 19) return "solid";
  return "confident";
}

export function remainingToScore(attempted: number): number {
  return Math.max(0, SCORE_MIN_ATTEMPTS - attempted);
}

export function isScored(attempted: number): boolean {
  return attempted >= SCORE_MIN_ATTEMPTS;
}

/**
 * Lọc "thành tố có thể đo được" cho khối C (spec ba trạng thái: chưa đo /
 * đo-bằng-0 / không áp dụng KHÔNG được vẽ giống nhau — finding #2 của đợt
 * review 2026-08-07). Một thành tố `question_available === 0` (bank hết câu
 * cho thành tố đó) và CHƯA có điểm thật (`!isScored`) là "không áp dụng": nó
 * không thể đo được, không phải việc đang chờ làm, nên không được hiện như
 * một hàng "còn N câu nữa". Một thành tố cũng `question_available === 0`
 * nhưng ĐÃ có điểm thật (attempted đủ ngưỡng) vẫn được giữ nguyên — học sinh
 * đã làm việc đó, điểm không được xoá chỉ vì bank hiện tại hết câu.
 *
 * Lọc ở lớp UI (không phải ở BE) để luật "đủ mẫu mới tính là đo được" chỉ
 * sống ở MỘT nơi — cùng `SCORE_MIN_ATTEMPTS`/`isScored` — thay vì lặp lại
 * hằng số này ở backend (PHP) và rơi đúng vào cái bẫy finding #3 vừa sửa.
 */
export function measurableComponents<T extends { attempted: number; question_available: number }>(
  components: T[],
): T[] {
  return components.filter((c) => c.question_available > 0 || isScored(c.attempted));
}

/** Khoảng tin cậy Wilson 95%, đơn vị %, cho thanh "khoảng dao động". */
export function wilsonInterval(correct: number, attempted: number): { lo: number; hi: number } {
  if (attempted <= 0) return { lo: 0, hi: 100 };
  const z = 1.96;
  const n = attempted;
  const p = correct / n;
  const denom = 1 + (z * z) / n;
  const center = (p + (z * z) / (2 * n)) / denom;
  const margin = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / denom;
  return {
    lo: Math.max(0, (center - margin) * 100),
    hi: Math.min(100, (center + margin) * 100),
  };
}

export interface LevelInsight {
  code: string;
  label: string;
  rank: number;
  attempted: number;
  correct: number;
  percent: number;
  status: SampleStatus;
  anomalous: boolean;
  interval: { lo: number; hi: number };
}

export function buildLevelInsights(
  levels: CompetencySubjectDetail["cognitive_levels"],
): LevelInsight[] {
  const sorted = [...levels].sort((a, b) => a.rank - b.rank);
  const out: LevelInsight[] = sorted.map((l) => ({
    ...l,
    status: sampleStatus(l.attempted),
    anomalous: false,
    interval: wilsonInterval(l.correct, l.attempted),
  }));
  // Nghi lỗi gắn nhãn: mức trên vượt một mức dưới nào đó ≥20 điểm (cả hai có điểm).
  for (let j = 1; j < out.length; j++) {
    if (!isScored(out[j].attempted)) continue;
    for (let i = 0; i < j; i++) {
      if (!isScored(out[i].attempted)) continue;
      if (out[j].percent - out[i].percent >= ANOMALY_GAP) {
        out[j].anomalous = true;
        console.warn(
          `[competency] Nghi lỗi gắn nhãn mức câu hỏi: ${out[j].label} ${out[j].percent}% > ${out[i].label} ${out[i].percent}% — báo đội nội dung.`,
        );
        break;
      }
    }
  }
  return out;
}

export type Conclusion =
  | { kind: "empty" }
  | { kind: "from_start"; firstLabel: string; firstCode: string }
  | { kind: "break"; masteredLabel: string; breakLabel: string; breakCode: string }
  | { kind: "insufficient"; masteredLabel: string | null; unscoredLabel: string; unscoredCode: string; remaining: number }
  | { kind: "all_mastered" };

export function computeConclusion(insights: LevelInsight[]): Conclusion {
  if (insights.every((l) => l.attempted === 0)) return { kind: "empty" };
  const usable = insights.filter((l) => !l.anomalous);
  let mastered: LevelInsight | null = null;
  for (const level of usable) {
    if (isScored(level.attempted) && level.percent >= MASTERY_THRESHOLD) {
      mastered = level;
      continue;
    }
    if (!isScored(level.attempted)) {
      return {
        kind: "insufficient",
        masteredLabel: mastered?.label ?? null,
        unscoredLabel: level.label,
        unscoredCode: level.code,
        remaining: remainingToScore(level.attempted),
      };
    }
    // có điểm nhưng dưới mốc
    return mastered === null
      ? { kind: "from_start", firstLabel: level.label, firstCode: level.code }
      : { kind: "break", masteredLabel: mastered.label, breakLabel: level.label, breakCode: level.code };
  }
  return { kind: "all_mastered" };
}

export type CommentAction =
  | { kind: "level"; levelCode: string; label: string }
  | { kind: "topic"; contentCode: string; label: string }
  | { kind: "general"; label: string };

export interface CommentPlan {
  text: string;
  action: CommentAction;
}

/**
 * Chủ ngữ mở đầu câu — điều kiện hoá bằng "Dựa trên số ít câu em đã làm" khi
 * mức được nhắc tới trong câu dựa trên mẫu còn ít (status "provisional").
 * Dùng chung cho break/from_start/insufficient để ba nhánh nói nhất quán
 * (spec §7 rule 4: dữ liệu ít thì phải điều kiện hoá).
 */
function openingSubject(level: LevelInsight | undefined): string {
  return level?.status === "provisional" ? "Dựa trên số ít câu em đã làm, em" : "Em";
}

export function computeComment(
  insights: LevelInsight[],
  topics: CompetencySubjectDetail["topics"],
  conclusion: Conclusion,
  /** Mốc "chủ đề còn yếu" PHẢI khớp mục tiêu radar đang vẽ (`detail.target_percent`,
   * BE cấu hình) — không phải hằng số 75 đóng cứng. Radar vẽ nét đứt mục tiêu tại
   * `targetPercent`; nếu câu nhận xét dùng một mốc khác, một chủ đề dưới target
   * NHƯNG trên 75 sẽ bị chart vẽ "chưa đạt" còn câu chữ lại im lặng — nhận xét
   * mâu thuẫn với biểu đồ (điều màn này tuyệt đối không được phép, finding #4). */
  targetPercent: number,
): CommentPlan | null {
  if (conclusion.kind === "empty") return null;

  const total = insights.reduce((s, l) => s + l.attempted, 0);
  if (total < COMMENT_CAVEAT_MIN_ATTEMPTS) {
    return {
      text: `Dựa trên ${total} câu em đã làm, kết quả còn sơ bộ và chưa thấy rõ điểm mạnh yếu.`,
      action: { kind: "general", label: "Làm thêm 10 câu để có đánh giá chính xác →" },
    };
  }

  if (conclusion.kind === "break") {
    const breakLevel = insights.find((l) => l.code === conclusion.breakCode);
    const conditional = openingSubject(breakLevel);
    return {
      text: `${conditional} vững ở mức ${conclusion.masteredLabel}, còn hụt khi bài ở mức ${conclusion.breakLabel}.`,
      action: { kind: "level", levelCode: conclusion.breakCode, label: `Luyện 10 câu ${conclusion.breakLabel} →` },
    };
  }
  if (conclusion.kind === "from_start") {
    const firstLevel = insights.find((l) => l.code === conclusion.firstCode);
    const conditional = openingSubject(firstLevel);
    return {
      text: `${conditional} cần củng cố ngay từ mức ${conclusion.firstLabel}.`,
      action: { kind: "level", levelCode: conclusion.firstCode, label: `Luyện 10 câu ${conclusion.firstLabel} →` },
    };
  }
  if (conclusion.kind === "insufficient") {
    const masteredLevel = conclusion.masteredLabel
      ? insights.find((l) => l.label === conclusion.masteredLabel)
      : undefined;
    const lead = conclusion.masteredLabel
      ? `${openingSubject(masteredLevel)} vững đến mức ${conclusion.masteredLabel}.`
      : "Em đang luyện đều, tiếp tục nhé.";
    return {
      text: `${lead} Chưa đủ bài để đánh giá mức ${conclusion.unscoredLabel}.`,
      action: {
        kind: "level",
        levelCode: conclusion.unscoredCode,
        label: `Làm 10 câu ${conclusion.unscoredLabel} để mở đánh giá →`,
      },
    };
  }

  // all_mastered — chỉ gọi tên chủ đề yếu khi cách chủ đề kế ≥ TIE_GAP (không ép có "yếu nhất")
  const scored = topics.filter((t) => isScored(t.attempted)).sort((a, b) => a.percent - b.percent);
  const weakest = scored[0];
  const clearWeakest =
    weakest && weakest.percent < targetPercent && (scored.length < 2 || scored[1].percent - weakest.percent >= TIE_GAP);
  if (clearWeakest) {
    return {
      text: `Em đã vững các mức của thang. Chủ đề ${weakest.label} còn có thể nâng thêm.`,
      action: { kind: "topic", contentCode: weakest.content_code, label: `Luyện chủ đề này →` },
    };
  }
  const top = insights[insights.length - 1];
  return {
    text: "Em đã vững các mức của thang. Thử sức thêm các bài khó nhé.",
    action: { kind: "level", levelCode: top.code, label: `Luyện 10 câu ${top.label} →` },
  };
}
