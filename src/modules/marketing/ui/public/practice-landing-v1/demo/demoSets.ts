import type { DemoQuestion } from "./demoEngine";

export interface DemoSet {
  level: string; // level string "1".."12" (chuẩn hoá toàn hệ)
  subjectCode: string; // subject_code từ reference collection
  subjectLabel: string;
  questions: DemoQuestion[];
}

const TOAN_3: DemoSet = {
  level: "3",
  subjectCode: "toan",
  subjectLabel: "Toán",
  questions: [
    {
      kind: "sort",
      skill: "Số chẵn, số lẻ",
      prompt: "Kéo mỗi số vào đúng nhóm chẵn / lẻ.",
      groups: ["Nhóm CHẴN", "Nhóm LẺ"],
      items: [
        { text: "12", group: 0 },
        { text: "7", group: 1 },
        { text: "48", group: 0 },
        { text: "25", group: 1 },
      ],
    },
    {
      kind: "choice",
      skill: "Phép nhân trong bảng",
      prompt: "7 × 8 = ?",
      options: ["54", "56", "63"],
      correctIndex: 1,
    },
    {
      kind: "choice",
      skill: "Phép chia",
      prompt: "45 : 5 = ?",
      options: ["9", "8", "7"],
      correctIndex: 0,
    },
    {
      kind: "sort",
      skill: "So sánh số trong phạm vi 1000",
      prompt: "Kéo mỗi số vào đúng nhóm so với 500.",
      groups: ["Bé hơn 500", "Lớn hơn 500"],
      items: [
        { text: "385", group: 0 },
        { text: "612", group: 1 },
        { text: "499", group: 0 },
      ],
    },
    {
      kind: "choice",
      skill: "Hình học — chu vi",
      prompt: "Hình vuông cạnh 5 cm có chu vi bằng bao nhiêu?",
      options: ["10 cm", "20 cm", "25 cm"],
      correctIndex: 1,
    },
  ],
};

/** Bộ đầu tiên là fallback mặc định (spec §5). Soạn thêm bộ cho môn/khối khác thì append. */
export const DEMO_SETS: DemoSet[] = [TOAN_3];

export function findDemoSet(level: string, subjectCode: string): DemoSet {
  return (
    DEMO_SETS.find((s) => s.level === level && s.subjectCode === subjectCode) ??
    DEMO_SETS[0]
  );
}
