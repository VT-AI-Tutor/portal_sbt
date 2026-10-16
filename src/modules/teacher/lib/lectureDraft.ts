/**
 * DÂY CHUYỀN sinh bài giảng — thuần logic, không đụng DOM.
 *
 * Một bài giảng gồm ĐÚNG 4 hoạt động theo thứ tự cố định `khoidong` →
 * `hinhthanh` → `luyentap` → `vandung`. Dây chuyền chạy: 1 lượt dựng dàn
 * khung, rồi lần lượt từng hoạt động — sinh NỘI DUNG trước (`generateSection`,
 * máy chủ ghi blocks/slides), sau đó mới GẮN câu hỏi quiz (`updateSection`).
 * Thứ tự này bắt buộc: máy chủ chạy hậu kiểm trên hoạt động đã trộn và từ
 * chối hoạt động chưa có nội dung nào — gắn `question_ids` lên hoạt động còn
 * rỗng sẽ bị từ chối.
 *
 * `updateSection` khi chỉ đổi `question_ids` KHÔNG kèm `blocks`/`slides` — hai
 * khoá đó bị BỎ HẲN khỏi payload (không gửi `null`), để máy chủ giữ nguyên nội
 * dung vừa sinh và không hiểu nhầm đây là giáo viên sửa tay.
 *
 * Câu hỏi cho quiz mỗi hoạt động: bốc kho trước (`teacherBlueprintApi.pickCell`),
 * thiếu bao nhiêu nhờ trợ lý AI sinh bù đúng bấy nhiêu (`generateCell`) — cùng
 * khuôn "kho trước, AI bù" với `blueprintDraft.ts`, không nhân đôi logic máy chủ.
 *
 * I2 (review cuối) — trợ lý AI tự đề xuất mức nhận thức riêng cho từng hoạt
 * động, nên hai hoạt động trùng mức là chuyện bình thường. Một `Set` mã câu
 * đã dùng chạy XUYÊN SUỐT cả bài giảng (khuôn `blueprintDraft.ts`), truyền
 * vào `exclude_ids` mỗi lần bốc kho — không thì hoạt động sau bốc trùng câu
 * hoạt động trước vừa lấy, học sinh gặp lại y hệt câu vừa làm.
 *
 * Lỗi khoanh vùng theo TỪNG HOẠT ĐỘNG: một hoạt động hỏng chỉ hoạt động đó
 * hỏng (ghi vào `sectionErrors[key]`), các hoạt động sau vẫn chạy tiếp — trừ
 * khi trợ lý AI báo `ai_disabled` ở bất kỳ lượt nào, lúc đó dây chuyền dừng
 * sớm và mọi hoạt động chưa xong đều ghi cùng một thông điệp.
 *
 * `generateSectionWithQuiz` — bước của MỘT hoạt động (sinh nội dung rồi
 * bốc/gắn quiz) — được XUẤT RA ngoài để dùng lại nguyên vẹn ở nút "Sinh lại
 * phần này" (`LectureFlow.handleRegenerate`) khi mở lại một bản nháp dở bằng
 * "Tiếp tục soạn": dây chuyền gốc có thể đã rớt mạng đúng ở bước bốc/gắn
 * quiz, để lại một hoạt động có nội dung nhưng `question_ids` rỗng. Không có
 * route riêng để hỏi máy chủ "quiz phù hợp hoạt động này là gì" — `LectureQuizSpec`
 * CHỈ đi kèm response của `generateSection`, nên bốc bù quiz bắt buộc phải gọi
 * lại `generateSection` (nội dung của hoạt động được sinh lại theo đó). Nơi
 * gọi (LectureFlow) chỉ làm việc này khi hoạt động ĐANG THIẾU quiz
 * (`question_ids.length === 0`) — hoạt động đã có quiz thì lượt "Sinh lại
 * phần này" vẫn đi đường CŨ (chỉ đổi blocks/slides, không re-roll quiz).
 */
import {
  teacherLectureApi,
  type LectureQuizSpec,
  type LectureSectionKey,
  type TeacherLecture,
} from "@/modules/teacher/api/teacherLectureApi";
import { teacherBlueprintApi } from "@/modules/teacher/api/teacherBlueprintApi";

export interface LectureGenProgress {
  done: number;
  total: number;
  current: string;
}

export interface LectureDraftResult {
  lecture: TeacherLecture;
  sectionErrors: Partial<Record<LectureSectionKey, string>>;
}

/** Thứ tự CỐ ĐỊNH của 4 hoạt động — một bài giảng luôn đủ và đúng thứ tự này. */
const SECTION_KEYS: LectureSectionKey[] = [
  "khoidong",
  "hinhthanh",
  "luyentap",
  "vandung",
];

const SECTION_LABELS: Record<LectureSectionKey, string> = {
  khoidong: "Khởi động",
  hinhthanh: "Hình thành kiến thức",
  luyentap: "Luyện tập",
  vandung: "Vận dụng",
};

const AI_DISABLED_MESSAGE = "Trợ lý AI đang tắt.";

const DEFAULT_ERROR_MESSAGE = "Không sinh được hoạt động này.";

/**
 * Chạy dây chuyền sinh trọn một bài giảng: dàn khung rồi lần lượt 4 hoạt
 * động. Không throw ra ngoài vì lỗi của một hoạt động — chỉ throw khi bước
 * dàn khung (bước chung, chưa có gì để khoanh vùng) thất bại.
 */
export async function generateLectureDraft(
  lectureId: string,
  ctx: {
    subject: string;
    subject_code: string;
    level: string;
    content_code: string;
  },
  token: string,
  options: {
    onProgress?: (progress: LectureGenProgress) => void;
    onLectureUpdate?: (lecture: TeacherLecture) => void;
  } = {},
): Promise<LectureDraftResult> {
  const total = 1 + SECTION_KEYS.length;
  const sectionErrors: Partial<Record<LectureSectionKey, string>> = {};
  // I2 — dồn dần qua cả 4 hoạt động: câu đã vào hoạt động này thì không được
  // rơi vào hoạt động sau.
  const usedQuestionIds = new Set<string>();

  options.onProgress?.({ done: 0, total, current: "Dàn khung bài giảng" });

  const outlineResult = await teacherLectureApi.outline(lectureId, token);
  let lecture = outlineResult.lecture;
  options.onLectureUpdate?.(lecture);

  if (outlineResult.ai_disabled) {
    markRemainingAiDisabled(sectionErrors, 0);
    options.onProgress?.({ done: total, total, current: "" });
    return { lecture, sectionErrors };
  }

  for (let i = 0; i < SECTION_KEYS.length; i++) {
    const key = SECTION_KEYS[i];
    options.onProgress?.({
      done: 1 + i,
      total,
      current: SECTION_LABELS[key],
    });

    try {
      const step = await generateSectionWithQuiz(
        lectureId,
        key,
        ctx,
        token,
        usedQuestionIds,
        options.onLectureUpdate,
      );
      lecture = step.lecture;

      if (step.aiDisabled) {
        markRemainingAiDisabled(sectionErrors, i);
        break;
      }
    } catch (e) {
      sectionErrors[key] =
        e instanceof Error ? e.message : DEFAULT_ERROR_MESSAGE;
    }
  }

  options.onProgress?.({ done: total, total, current: "" });
  return { lecture, sectionErrors };
}

export interface LectureSectionStepResult {
  lecture: TeacherLecture;
  aiDisabled: boolean;
}

/**
 * Bước sinh của MỘT hoạt động: sinh nội dung (`generateSection`) rồi, nếu máy
 * chủ trả về `LectureQuizSpec`, bốc/gắn quiz bằng đúng `collectQuizQuestionIds`
 * (kho trước, AI bù, cập nhật `used` để hoạt động sau không trùng câu) và ghi
 * lại CHỈ `question_ids` (không kèm `blocks`/`slides`). Dùng CHUNG cho vòng lặp
 * của `generateLectureDraft` VÀ cho nút "Sinh lại phần này" khi bốc bù quiz
 * còn thiếu lúc "Tiếp tục soạn" — một bản logic duy nhất, không nhân đôi.
 *
 * `usedQuestionIds` được sửa TẠI CHỖ (mutate) — nơi gọi seed sẵn mã câu đã
 * dùng (từ các hoạt động khác) trước khi gọi, và đọc lại Set này sau khi xong
 * nếu cần dùng tiếp cho hoạt động kế.
 */
export async function generateSectionWithQuiz(
  lectureId: string,
  key: LectureSectionKey,
  ctx: {
    subject: string;
    subject_code: string;
    level: string;
    content_code: string;
  },
  token: string,
  usedQuestionIds: Set<string>,
  onLectureUpdate?: (lecture: TeacherLecture) => void,
): Promise<LectureSectionStepResult> {
  const genResult = await teacherLectureApi.generateSection(
    lectureId,
    key,
    token,
  );
  let lecture = genResult.lecture;
  onLectureUpdate?.(lecture);

  if (genResult.ai_disabled) {
    return { lecture, aiDisabled: true };
  }

  if (genResult.quiz) {
    const quizResult = await collectQuizQuestionIds(
      ctx,
      genResult.quiz,
      token,
      usedQuestionIds,
    );

    if (quizResult.aiDisabled) {
      return { lecture, aiDisabled: true };
    }

    lecture = await teacherLectureApi.updateSection(
      lectureId,
      key,
      { question_ids: quizResult.ids },
      token,
    );
    onLectureUpdate?.(lecture);
  }

  return { lecture, aiDisabled: false };
}

/** Từ chỉ số hoạt động đang dừng (bao gồm), gán thông điệp AI-tắt cho phần còn lại. */
function markRemainingAiDisabled(
  sectionErrors: Partial<Record<LectureSectionKey, string>>,
  fromIndex: number,
): void {
  for (let k = fromIndex; k < SECTION_KEYS.length; k++) {
    sectionErrors[SECTION_KEYS[k]] = AI_DISABLED_MESSAGE;
  }
}

/**
 * Gom câu hỏi cho quiz của MỘT hoạt động: bốc kho trước, thiếu bao nhiêu nhờ
 * trợ lý AI sinh bù đúng bấy nhiêu. Không throw khi trợ lý AI tắt — báo qua
 * `aiDisabled` để nơi gọi tự quyết định dừng dây chuyền.
 */
async function collectQuizQuestionIds(
  ctx: {
    subject: string;
    subject_code: string;
    level: string;
    content_code: string;
  },
  quiz: LectureQuizSpec,
  token: string,
  used: Set<string>,
): Promise<{ ids: string[]; aiDisabled: boolean }> {
  const picked = await teacherBlueprintApi.pickCell(
    {
      subject_code: ctx.subject_code,
      level: ctx.level,
      content_code: ctx.content_code,
      level_code: quiz.level_code,
      count: quiz.count,
      exclude_ids: [...used],
    },
    token,
  );
  const ids = picked.questions.map((q) => q.id);
  ids.forEach((id) => used.add(id));

  if (picked.missing <= 0) return { ids, aiDisabled: false };

  const generated = await teacherBlueprintApi.generateCell(
    {
      subject: ctx.subject,
      subject_code: ctx.subject_code,
      level: ctx.level,
      content_code: ctx.content_code,
      level_code: quiz.level_code,
      count: picked.missing,
    },
    token,
  );

  if (generated.ai_disabled) return { ids, aiDisabled: true };

  const freshIds = generated.saved.map((q) => q.id);
  freshIds.forEach((id) => used.add(id));

  return {
    ids: [...ids, ...freshIds],
    aiDisabled: false,
  };
}
