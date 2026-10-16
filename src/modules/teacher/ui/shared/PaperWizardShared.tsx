import { cn } from "@/core/lib/utils";
import { Check } from "lucide-react";

// GAP-108: đã gỡ TEACHER_SUBJECT_CODES/TEACHER_LEVEL_CODES — môn và khối nay đến từ danh mục
// chuẩn (useSubjects/useLevels), không giới hạn cứng ở tiểu học.

export const FORMATS = [
  {
    value: "quiz",
    label: "Quiz",
    emoji: "📝",
    desc: "Trắc nghiệm, tự luận, điền khuyết.",
  },
  {
    value: "gamification",
    label: "Gamification",
    emoji: "🎮",
    desc: "Kéo–thả, ghép cặp, tương tác.",
  },
] as const;
export type PaperFormat = "quiz" | "gamification";

export const CLASSES = ["4A", "4B", "4C", "5A", "5B"];

export const COMPETENCY_GROUPS = [
  {
    value: "all",
    label: "Toàn lớp",
    desc: "Cùng một phiếu cho tất cả học sinh.",
  },
  {
    value: "by-level",
    label: "Theo nhóm năng lực",
    desc: "AI tự chia 3 nhóm: Giỏi / Khá / Cần hỗ trợ.",
  },
  {
    value: "personalized",
    label: "Cá nhân hoá",
    desc: "Mỗi học sinh nhận phiếu riêng theo điểm yếu.",
  },
] as const;

export const DURATION_PRESETS = [
  { min: 15, count: 8 },
  { min: 20, count: 10 },
  { min: 30, count: 15 },
  { min: 45, count: 20 },
];

export function Stepper({
  steps,
  current,
}: {
  steps: string[];
  current: number;
}) {
  return (
    <div className="flex items-center gap-1.5 mb-4 overflow-x-auto pb-1">
      {steps.map((s, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <div key={s} className="flex items-center gap-1.5 shrink-0">
            <div
              className={cn(
                "size-7 rounded-full grid place-items-center text-xs font-bold border-2",
                done && "bg-success text-success-foreground border-success",
                active && "bg-primary text-primary-foreground border-primary",
                !done &&
                  !active &&
                  "bg-muted text-muted-foreground border-border",
              )}
            >
              {done ? <Check className="size-4" /> : i + 1}
            </div>
            <span
              className={cn(
                "text-xs font-medium whitespace-nowrap",
                active ? "text-foreground" : "text-muted-foreground",
              )}
            >
              {s}
            </span>
            {i < steps.length - 1 && (
              <div className="w-4 h-px bg-border mx-1" />
            )}
          </div>
        );
      })}
    </div>
  );
}

export function OptionCard({
  active,
  onClick,
  children,
  tone = "primary",
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  tone?: "primary" | "warning" | "fun" | "info";
}) {
  const toneCls = {
    primary: "border-primary bg-primary/10",
    warning: "border-warning bg-warning/15",
    fun: "border-fun bg-fun/10",
    info: "border-info bg-info/10",
  }[tone];
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-xl border-2 p-3 text-left transition-all w-full",
        active
          ? `${toneCls} shadow-sm`
          : "border-border bg-background hover:border-primary/40",
      )}
    >
      {children}
    </button>
  );
}

export type AssignMode = "required" | "extra";

export const ASSIGN_MODE_LABEL: Record<AssignMode, string> = {
  required: "Bắt buộc",
  extra: "Giao thêm",
};

export function AssignModeSelector({
  value,
  onChange,
}: {
  value: AssignMode;
  onChange: (v: AssignMode) => void;
}) {
  const options: {
    value: AssignMode;
    emoji: string;
    label: string;
    desc: string;
    tone: "primary" | "info";
  }[] = [
    {
      value: "required",
      emoji: "📌",
      label: "Bắt buộc",
      desc: "Hiện trong Bài tập của HS — phải hoàn thành.",
      tone: "primary",
    },
    {
      value: "extra",
      emoji: "✨",
      label: "Giao thêm",
      desc: "Hiện trong Luyện tập — HS làm tự nguyện.",
      tone: "info",
    },
  ];
  return (
    <div className="space-y-2">
      <div className="text-sm font-medium">Hình thức giao</div>
      <div className="grid sm:grid-cols-2 gap-2">
        {options.map((o) => (
          <OptionCard
            key={o.value}
            active={value === o.value}
            onClick={() => onChange(o.value)}
            tone={o.tone}
          >
            <div className="font-bold text-sm flex items-center gap-1.5">
              <span>{o.emoji}</span> {o.label}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">{o.desc}</div>
          </OptionCard>
        ))}
      </div>
    </div>
  );
}
