/**
 * Hợp đồng dữ liệu cho bài DỰNG biểu đồ (II.39, loại `chart_build`).
 *
 * Phân biệt rõ với biểu đồ dạng ĐỀ BÀI: khảo sát kho sách cho thấy 5 câu biểu đồ
 * đang chạy đều đưa biểu đồ vào như một **ảnh trong đề bài**, học sinh trả lời bằng
 * `cloze` / `table_completion` / `single_choice`. Cách đó vẫn dùng tiếp và không cần
 * loại câu riêng.
 *
 * Loại này dành cho chiều ngược lại: học sinh **tự dựng** biểu đồ từ số liệu — kéo
 * cao từng cột, hoặc đặt điểm cho từng mốc rồi nối thành đường.
 *
 * Giá trị snap vào vạch trục nên đáp án là **số rời rạc**, và chấm là so từng cột
 * một. Đây là lý do loại này rẻ: không phát sinh hình học, không dung sai — cùng
 * khuôn với `numeric_answer` nhưng theo từng hạng mục.
 */

export const CHART_KINDS = ['bar', 'line'] as const;
export type ChartKind = (typeof CHART_KINDS)[number];

export const CHART_KIND_LABELS: Record<ChartKind, string> = {
  bar: 'Biểu đồ cột',
  line: 'Biểu đồ đường',
};

/** Một hạng mục trên trục ngang: lớp 4A, tháng 1, môn Toán… */
export interface ChartCategory {
  id: string;
  label: string;
}

export interface ChartSpec {
  kind: ChartKind;
  categories: ChartCategory[];
  /** Giá trị lớn nhất của trục dọc. */
  yMax: number;
  /**
   * Khoảng giữa hai vạch trục dọc. Mặc định 1.
   *
   * Đây là thứ làm đáp án rời rạc: học sinh chỉ đặt được giá trị trùng vạch, nên
   * không cần dung sai và bản chấm server so đúng bằng số.
   */
  yStep?: number;
  /** Nhãn trục dọc, ví dụ "Số học sinh". */
  yLabel?: string;
  /** Nhãn trục ngang, ví dụ "Lớp". */
  xLabel?: string;
}

/**
 * Đáp án: giá trị của từng hạng mục.
 *
 * Cùng dạng cho `correctAnswer` và cho bài làm của học sinh — nhờ vậy chấm là so
 * từng khoá, không phải dịch qua dạng trung gian nào.
 */
export type ChartAnswer = Record<string, number>;
