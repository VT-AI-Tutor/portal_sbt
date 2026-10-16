/**
 * Máy khách MA TRẬN ĐỀ (PAPER-R7..R12/R17) — khai ma trận chủ đề × mức nhận
 * thức, bốc câu từ kho và nhờ trợ lý AI sinh bù chỗ thiếu.
 *
 * Cùng khuôn fetch + JWT + phong bì `{success,data}` với teacherPaperApi.ts.
 *
 * CẢNH BÁO ĐẶT TÊN: `level` là KHỐI LỚP, `level_code` là MỨC NHẬN THỨC. Hai
 * thứ khác nhau, cách nhau một chữ, và nhầm chúng thì bộ lọc vẫn chạy — chỉ
 * trả sai tập câu, im lặng.
 */
import { getAuthenticatedApiBaseUrl } from "@/core/api/config";
import type { PaperKind } from "@/core/lib/paperKind";

const API_BASE = getAuthenticatedApiBaseUrl();
const json = { "Content-Type": "application/json" };

/** Bốn mức nhận thức chuẩn — cột của ma trận. */
export type CognitiveLevelCode = "biet" | "hieu" | "vandung" | "vandungcao";

export interface CognitiveLevel {
  code: CognitiveLevelCode;
  label: string;
  order: number;
}

export interface BlueprintTopic {
  content_code: string;
  label: string;
  /** Số câu kho đang có, theo từng mức nhận thức. */
  counts: Record<string, number>;
  total: number;
}

export interface BlueprintCatalog {
  levels: CognitiveLevel[];
  topics: BlueprintTopic[];
  minutes_per_type: Record<string, number>;
  /** Kho có câu nào cho môn + khối này không. */
  has_bank: boolean;
}

export interface BlueprintCell {
  content_code: string;
  level_code: CognitiveLevelCode;
  count: number;
}

export interface PaperBlueprint {
  id: string;
  created_by: string;
  title: string;
  kind: PaperKind;
  subject: string;
  subject_code: string;
  level: string;
  duration_minutes: number | null;
  total_points: number;
  printable_only: boolean;
  avoid_reuse: boolean;
  cells: BlueprintCell[];
  created_at: string;
}

export interface PaperBlueprintInput {
  title: string;
  kind: PaperKind;
  subject?: string;
  subject_code: string;
  level: string;
  duration_minutes?: number | null;
  total_points?: number;
  printable_only?: boolean;
  avoid_reuse?: boolean;
  cells: BlueprintCell[];
}

/**
 * Câu trong BẢN NHÁP. Cùng hình dạng cho câu bốc từ kho và câu AI sinh, nên
 * màn duyệt không phải rẽ nhánh theo nguồn.
 *
 * `payload` ĐÃ ĐƯỢC LƯỢC ĐÁP ÁN ở máy chủ — đủ để màn xem thử dựng câu bằng
 * đúng bộ player học sinh sẽ thấy, nhưng đáp án không ra tới trình duyệt lúc
 * soạn (họ hàng lỗ rò GAP-152).
 */
export interface DraftQuestion {
  id: string;
  source: "library" | "ai" | "personal";
  question_type: string;
  question_text: string;
  options: unknown[];
  payload: Record<string, unknown> | null;
  difficulty: string;
  cell: { content_code: string; level_code: string };
}

export interface PickCellResult {
  questions: DraftQuestion[];
  /** Kho thiếu bao nhiêu câu so với ô đã khai — phần này để AI sinh bù. */
  missing: number;
}

export interface GenerateCellResult {
  saved: DraftQuestion[];
  rejected: { question_text: string; reason: string }[];
  /** Trợ lý AI đang tắt toàn hệ — màn hình phải nói rõ thay vì báo lỗi (PAPER-R17). */
  ai_disabled: boolean;
}

/** Lát 3 — kết quả lớp đọc theo ô ma trận. */
export interface OutcomeCell {
  correct: number;
  answered: number;
  /** null = chưa em nào làm ô này. KHÁC HẲN 0 (cả lớp làm sai). */
  percent: number | null;
}

export interface BlueprintOutcome {
  levels: { code: string; label: string }[];
  topics: {
    content_code: string;
    label: string;
    cells: Record<string, OutcomeCell>;
    total: OutcomeCell;
  }[];
  level_totals: Record<string, OutcomeCell>;
  graded_students: number;
  /** Đề soạn tay không có ô ma trận nên không đọc theo ma trận được. */
  has_matrix: boolean;
  /** Môn + khối của đề, để mở thẳng ma trận cho một ô yếu. */
  subject_code: string;
  level: string;
}

/** Lát 3 — ma trận gợi ý từ chỗ lớp đang yếu. */
export interface BlueprintSuggestion {
  cells: BlueprintCell[];
  weak_topics: { content_code: string; mastery_percent: number }[];
  based_on_students: number;
}

async function raw(path: string, token: string, init?: RequestInit) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
      ...init?.headers,
    },
  });
  const body = (await res.json().catch(() => ({}))) as {
    success?: boolean;
    data?: unknown;
    message?: string;
    error_code?: string;
  };
  if (!res.ok || body.success === false)
    throw new Error(
      body.message ?? body.error_code ?? `Blueprint API error ${res.status}`,
    );
  return body;
}

export const teacherBlueprintApi = {
  async catalog(
    params: { subject_code: string; level: string; printable_only?: boolean },
    token: string,
  ): Promise<BlueprintCatalog> {
    const query = new URLSearchParams({
      subject_code: params.subject_code,
      level: params.level,
    });
    if (params.printable_only) query.set("printable_only", "1");
    const body = await raw(
      `/api/v1/teacher/blueprints/catalog?${query.toString()}`,
      token,
    );
    return body.data as BlueprintCatalog;
  },

  async list(token: string): Promise<PaperBlueprint[]> {
    const body = await raw("/api/v1/teacher/blueprints", token);
    return (body.data as PaperBlueprint[]) ?? [];
  },

  async create(
    input: PaperBlueprintInput,
    token: string,
  ): Promise<PaperBlueprint> {
    const body = await raw("/api/v1/teacher/blueprints", token, {
      method: "POST",
      headers: json,
      body: JSON.stringify(input),
    });
    return body.data as PaperBlueprint;
  },

  async update(
    id: string,
    input: PaperBlueprintInput,
    token: string,
  ): Promise<PaperBlueprint> {
    const body = await raw(`/api/v1/teacher/blueprints/${id}`, token, {
      method: "PUT",
      headers: json,
      body: JSON.stringify(input),
    });
    return body.data as PaperBlueprint;
  },

  async remove(id: string, token: string): Promise<void> {
    await raw(`/api/v1/teacher/blueprints/${id}`, token, { method: "DELETE" });
  },

  /** PAPER-R10 — bốc câu từ kho cho MỘT ô. */
  async pickCell(
    params: {
      subject_code: string;
      level: string;
      content_code: string;
      level_code: string;
      count: number;
      printable_only?: boolean;
      exclude_ids?: string[];
      /** Lát 3 — loại thêm câu học sinh lớp này đã gặp ở phần luyện tập. */
      exclude_class_id?: string;
    },
    token: string,
  ): Promise<PickCellResult> {
    const body = await raw("/api/v1/teacher/blueprints/pick-cell", token, {
      method: "POST",
      headers: json,
      body: JSON.stringify(params),
    });
    return body.data as PickCellResult;
  },

  /** Lát 3 — kết quả lớp theo ô ma trận sau khi lớp làm xong. */
  async outcome(
    classId: string,
    linkId: string,
    token: string,
  ): Promise<BlueprintOutcome> {
    const body = await raw(
      `/api/v1/teacher/blueprints/outcome/${classId}/${linkId}`,
      token,
    );
    return body.data as BlueprintOutcome;
  },

  /** Lát 3 — gợi ý ma trận nghiêng về chủ đề lớp đang yếu. */
  async suggest(
    params: {
      class_id: string;
      subject_code: string;
      level: string;
      total_questions: number;
      printable_only?: boolean;
    },
    token: string,
  ): Promise<BlueprintSuggestion> {
    const body = await raw("/api/v1/teacher/blueprints/suggest", token, {
      method: "POST",
      headers: json,
      body: JSON.stringify(params),
    });
    return body.data as BlueprintSuggestion;
  },

  /** PAPER-R10/R11/R18 — trợ lý AI sinh câu cho MỘT ô. */
  async generateCell(
    params: {
      subject?: string;
      subject_code: string;
      level: string;
      content_code: string;
      level_code: string;
      count: number;
      printable_only?: boolean;
    },
    token: string,
  ): Promise<GenerateCellResult> {
    const body = await raw("/api/v1/teacher/blueprints/generate-cell", token, {
      method: "POST",
      headers: json,
      body: JSON.stringify(params),
    });
    return body.data as GenerateCellResult;
  },
};
