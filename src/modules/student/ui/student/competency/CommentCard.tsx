import { Sparkles } from "lucide-react";
import { Button } from "@/core/ui/button";
import type { CommentAction, CommentPlan } from "./insights";

/**
 * Khối E — Nhận xét (spec §7): tối đa 2 câu, sinh máy móc từ đúng dữ liệu các
 * biểu đồ phía trên (không LLM — không được nói điều biểu đồ không thể hiện),
 * kết bằng ĐÚNG MỘT hành động.
 */
export function CommentCard({
  plan,
  onAction,
  pending,
  disabled = false,
}: {
  plan: CommentPlan;
  onAction: (a: CommentAction) => void;
  /** ĐÚNG hành động này là hành động đang tạo phiên — đổi nhãn nút thành "Đang tạo...". */
  pending: boolean;
  /** Có phiên đang tạo ở NƠI KHÁC trên trang — khoá nút này để tránh đua hai
   * phiên (xem TopicList.disabled cùng lý do). */
  disabled?: boolean;
}) {
  return (
    <div className="rounded-xl border-2 border-primary/40 bg-primary/5 p-4">
      <div className="flex items-start gap-3">
        <Sparkles className="size-5 text-primary shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="font-display font-bold text-primary mb-1">{"Nhận xét"}</div>
          <p className="text-sm text-foreground/90">{plan.text}</p>
          <Button size="sm" className="btn-pop mt-3" disabled={pending || disabled} onClick={() => onAction(plan.action)}>
            {pending ? "Đang tạo phiên..." : plan.action.label}
          </Button>
        </div>
      </div>
    </div>
  );
}
