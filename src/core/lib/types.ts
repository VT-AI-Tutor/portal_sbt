// Types cho hệ thống câu hỏi NXBGDVN - SBT Khoa học 4

export type InteractionType =
  // Cơ bản
  | "single_choice"
  | "multiple_choice"
  | "true_false"
  | "fill_blank"
  | "drag_drop"
  | "matching"
  | "ordering"
  // Nâng cao
  | "short_answer"
  | "essay"
  | "code_input"
  | "math_input"
  | "image_hotspot"
  // Gamification
  | "kahoot"
  | "speed"
  | "flashcard"
  | "leaderboard"
  | "level"
  | "puzzle"
  | "story"
  // Học tập nâng cao
  | "step_hint"
  | "explanation"
  | "peer_compare"
  | "adaptive";

export interface BaseQuestion {
  id: string;
  type: InteractionType;
  prompt: string;
  hint?: string;
  explanation?: string;
  /** Giải thích chi tiết VÌ SAO đáp án đúng là đúng (hiển thị khi HS trả lời đúng). */
  whyCorrect?: string;
  /** Giải thích chi tiết VÌ SAO câu trả lời sai (hiển thị khi HS trả lời sai), nêu lỗi thường gặp. */
  whyWrong?: string;
  difficulty?: "easy" | "medium" | "hard";
  points?: number;
}

export interface SingleChoiceQ extends BaseQuestion {
  type: "single_choice";
  options: { id: string; text: string }[];
  correct: string;
}
export interface MultipleChoiceQ extends BaseQuestion {
  type: "multiple_choice";
  options: { id: string; text: string }[];
  correct: string[];
}
export interface TrueFalseQ extends BaseQuestion {
  type: "true_false";
  statements: { id: string; text: string; answer: boolean }[];
}
export interface FillBlankQ extends BaseQuestion {
  type: "fill_blank";
  // template uses {{1}} {{2}} placeholders
  template: string;
  blanks: { id: string; answer: string; suggestions?: string[] }[];
}
export interface DragDropQ extends BaseQuestion {
  type: "drag_drop";
  items: { id: string; text: string }[];
  zones: { id: string; label: string; accepts: string[] }[];
}
export interface MatchingQ extends BaseQuestion {
  type: "matching";
  left: { id: string; text: string }[];
  right: { id: string; text: string }[];
  pairs: Record<string, string>; // leftId -> rightId
}
export interface OrderingQ extends BaseQuestion {
  type: "ordering";
  items: { id: string; text: string }[];
  correctAnswer: string[];
}
export interface ShortAnswerQ extends BaseQuestion {
  type: "short_answer";
  sampleAnswer: string;
  keywords?: string[];
}
export interface EssayQ extends BaseQuestion {
  type: "essay";
  rubric: string[];
  minWords?: number;
}
export interface CodeInputQ extends BaseQuestion {
  type: "code_input";
  language: string;
  starter: string;
  expected: string;
}
export interface MathInputQ extends BaseQuestion {
  type: "math_input";
  answer: number;
  unit?: string;
}
export interface ImageHotspotQ extends BaseQuestion {
  type: "image_hotspot";
  imageUrl: string;
  hotspots: {
    id: string;
    x: number;
    y: number;
    r: number;
    label: string;
    correct: boolean;
  }[];
}
export interface KahootQ extends BaseQuestion {
  type: "kahoot";
  options: {
    id: string;
    text: string;
    color: "red" | "blue" | "yellow" | "green";
  }[];
  correct: string;
  timeLimit: number;
}
export interface SpeedQ extends BaseQuestion {
  type: "speed";
  options: { id: string; text: string }[];
  correct: string;
  timeLimit: number;
}
export interface FlashcardQ extends BaseQuestion {
  type: "flashcard";
  front: string;
  back: string;
}
export interface LeaderboardQ extends BaseQuestion {
  type: "leaderboard";
  options: { id: string; text: string }[];
  correct: string;
}
export interface LevelQ extends BaseQuestion {
  type: "level";
  levels: { name: string; questionRef: string }[];
}
export interface PuzzleQ extends BaseQuestion {
  type: "puzzle";
  imageUrl: string;
  pieces: number;
}
export interface StoryQ extends BaseQuestion {
  type: "story";
  scenes: {
    narrator: string;
    choice?: { options: { id: string; text: string }[]; correct: string };
  }[];
}
export interface StepHintQ extends BaseQuestion {
  type: "step_hint";
  question: string;
  steps: { hint: string; reveal: string }[];
  finalAnswer: string;
}
export interface ExplanationQ extends BaseQuestion {
  type: "explanation";
  question: string;
  options: { id: string; text: string }[];
  correct: string;
  detailedExplanation: string;
}
export interface PeerCompareQ extends BaseQuestion {
  type: "peer_compare";
  options: { id: string; text: string }[];
  correct: string;
  peerStats: Record<string, number>;
}
export interface AdaptiveQ extends BaseQuestion {
  type: "adaptive";
  pool: { difficulty: "easy" | "medium" | "hard"; q: SingleChoiceQ }[];
}

export type Question =
  | SingleChoiceQ
  | MultipleChoiceQ
  | TrueFalseQ
  | FillBlankQ
  | DragDropQ
  | MatchingQ
  | OrderingQ
  | ShortAnswerQ
  | EssayQ
  | CodeInputQ
  | MathInputQ
  | ImageHotspotQ
  | KahootQ
  | SpeedQ
  | FlashcardQ
  | LeaderboardQ
  | LevelQ
  | PuzzleQ
  | StoryQ
  | StepHintQ
  | ExplanationQ
  | PeerCompareQ
  | AdaptiveQ;

export interface Lesson {
  id: string;
  topic: string;
  title: string;
  questions: Question[];
}

export type Role = "teacher" | "manager" | "admin";
