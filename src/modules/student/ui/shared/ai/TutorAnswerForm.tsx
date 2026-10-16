import { Button } from "@/core/ui/button";
import { Send } from "lucide-react";
import type { HintField } from "./tutorHints";

// Ô tương tác dưới bong bóng trợ giảng: điền chỗ trống + trắc nghiệm chọn 1. Chỉ để HS NHẬP
// câu trả lời cho thân thiện — bấm "Gửi câu trả lời" thì gộp lại thành lượt chat cho AI xem.
export function TutorAnswerForm({
  fields,
  values,
  onChange,
  onSubmit,
  disabled,
}: {
  fields: HintField[];
  values: Record<number, string>;
  onChange: (index: number, value: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
}) {
  const hasAny = Object.values(values).some((v) => v.trim() !== "");

  return (
    <div className="mt-3 rounded-xl border-2 border-primary/30 bg-background/70 p-3 space-y-2.5">
      {fields.map((f, i) =>
        f.kind === "blank" ? (
          <div key={i} className="flex items-center gap-2 flex-wrap">
            {f.label && (
              <span className="text-sm font-medium">{f.label} =</span>
            )}
            <input
              value={values[i] ?? ""}
              onChange={(e) => onChange(i, e.target.value)}
              disabled={disabled}
              className="flex-1 min-w-[6rem] rounded-lg border-2 bg-background px-2 py-1 text-sm outline-none focus:border-primary"
              placeholder="Điền đáp án…"
            />
          </div>
        ) : (
          <div key={i} className="space-y-1">
            {f.label && <span className="text-sm font-medium">{f.label}</span>}
            <div className="flex flex-wrap gap-2">
              {f.options.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  disabled={disabled}
                  onClick={() => onChange(i, opt)}
                  className={
                    "rounded-full border-2 px-3 py-1 text-sm transition-colors " +
                    (values[i] === opt
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-primary/30 hover:border-primary")
                  }
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>
        ),
      )}

      <Button
        size="sm"
        onClick={onSubmit}
        disabled={disabled || !hasAny}
        className="gap-1"
      >
        <Send className="size-3.5" /> Gửi câu trả lời
      </Button>
    </div>
  );
}
