import type { Question } from "@/core/lib/types";
import { SingleChoice, MultipleChoice, TrueFalse } from "./basic-choice";
import {
  FillBlank,
  ShortAnswer,
  Essay,
  MathInput,
  CodeInput,
} from "./text-input";
import { DragDrop, Matching, Ordering, ImageHotspot } from "./spatial";
import {
  Kahoot,
  Speed,
  Flashcard,
  LeaderboardChallenge,
  LevelProgression,
  Puzzle,
  Story,
} from "./gamification";
import {
  StepHint,
  Explanation,
  PeerCompare,
  Adaptive,
} from "./advanced-learning";

export function QuestionRenderer({
  question,
  onAnswer,
}: {
  question: Question;
  onAnswer: (r: {
    correct: boolean;
    partial?: boolean;
    userAnswer?: unknown;
  }) => void;
}) {
  switch (question.type) {
    case "single_choice":
      return <SingleChoice question={question} onAnswer={onAnswer} />;
    case "multiple_choice":
      return <MultipleChoice question={question} onAnswer={onAnswer} />;
    case "true_false":
      return <TrueFalse question={question} onAnswer={onAnswer} />;
    case "fill_blank":
      return <FillBlank question={question} onAnswer={onAnswer} />;
    case "drag_drop":
      return <DragDrop question={question} onAnswer={onAnswer} />;
    case "matching":
      return <Matching question={question} onAnswer={onAnswer} />;
    case "ordering":
      return <Ordering question={question} onAnswer={onAnswer} />;
    case "short_answer":
      return <ShortAnswer question={question} onAnswer={onAnswer} />;
    case "essay":
      return <Essay question={question} onAnswer={onAnswer} />;
    case "code_input":
      return <CodeInput question={question} onAnswer={onAnswer} />;
    case "math_input":
      return <MathInput question={question} onAnswer={onAnswer} />;
    case "image_hotspot":
      return <ImageHotspot question={question} onAnswer={onAnswer} />;
    case "kahoot":
      return <Kahoot question={question} onAnswer={onAnswer} />;
    case "speed":
      return <Speed question={question} onAnswer={onAnswer} />;
    case "flashcard":
      return <Flashcard question={question} onAnswer={onAnswer} />;
    case "leaderboard":
      return <LeaderboardChallenge question={question} onAnswer={onAnswer} />;
    case "level":
      return <LevelProgression question={question} onAnswer={onAnswer} />;
    case "puzzle":
      return <Puzzle question={question} onAnswer={onAnswer} />;
    case "story":
      return <Story question={question} onAnswer={onAnswer} />;
    case "step_hint":
      return <StepHint question={question} onAnswer={onAnswer} />;
    case "explanation":
      return <Explanation question={question} onAnswer={onAnswer} />;
    case "peer_compare":
      return <PeerCompare question={question} onAnswer={onAnswer} />;
    case "adaptive":
      return <Adaptive question={question} onAnswer={onAnswer} />;
  }
}

export const TYPE_LABELS: Record<Question["type"], string> = {
  single_choice: "Trắc nghiệm 1 đáp án",
  multiple_choice: "Trắc nghiệm nhiều đáp án",
  true_false: "Đúng / Sai",
  fill_blank: "Điền khuyết",
  drag_drop: "Kéo & Thả",
  matching: "Nối cặp",
  ordering: "Sắp xếp thứ tự",
  short_answer: "Tự luận ngắn",
  essay: "Tự luận dài (AI chấm)",
  code_input: "Code (Tin học)",
  math_input: "Nhập số (Toán)",
  image_hotspot: "Chọn vùng trên hình",
  kahoot: "Quiz Kahoot",
  speed: "Ai nhanh hơn",
  flashcard: "Flashcard",
  leaderboard: "Đua top",
  level: "Vượt màn",
  puzzle: "Ghép hình",
  story: "Story-based",
  step_hint: "Hint từng bước",
  explanation: "Giải thích sau khi làm",
  peer_compare: "So sánh đáp án bạn",
  adaptive: "Adaptive AI",
};
