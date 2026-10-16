/**
 * Map độ khó câu hỏi giữa nhãn tiếng Việt hiển thị (Dễ/TB/Khó) và giá trị
 * canonical BE (easy/medium/hard) — Task 4 / lát 2 teacher question bank.
 * Giá trị lạ mặc định về medium/TB thay vì nuốt lỗi.
 */
export type CanonicalDifficulty = "easy" | "medium" | "hard";
export type DifficultyLabel = "Dễ" | "TB" | "Khó";

const TO_CANONICAL: Record<string, CanonicalDifficulty> = {
  Dễ: "easy",
  TB: "medium",
  "Trung bình": "medium",
  Khó: "hard",
  easy: "easy",
  medium: "medium",
  hard: "hard",
};

const TO_LABEL: Record<string, DifficultyLabel> = {
  easy: "Dễ",
  medium: "TB",
  hard: "Khó",
};

export function toCanonical(label: string): CanonicalDifficulty {
  return TO_CANONICAL[label] ?? "medium";
}

export function toLabel(difficulty: string): DifficultyLabel {
  return TO_LABEL[difficulty] ?? "TB";
}
