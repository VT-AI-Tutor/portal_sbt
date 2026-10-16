/** Yêu cầu 5 — năng lực CHỦ ĐỀ đang luyện, sau khi phiên đã cộng vào thành thạo. */
import { Target } from "lucide-react";
import { Card } from "@/core/ui/card";
import type { TopicMastery } from "@/modules/student/api/practiceApi";

export function TopicMasteryCard({
  mastery,
}: {
  mastery: TopicMastery | null;
}) {
  // Phiên Tổng hợp không gắn chủ đề nào — không có gì trung thực để hiện.
  if (!mastery) return null;

  return (
    <Card className="p-4 border-2 space-y-2">
      <h3 className="font-display font-bold flex items-center gap-2">
        <Target className="size-4 text-primary" />
        Năng lực chủ đề đang luyện
      </h3>
      <div className="flex items-baseline justify-between">
        <span className="font-medium">{mastery.label}</span>
        <span className="font-display text-xl font-black tabular-nums">
          {mastery.percent.toLocaleString("vi-VN")}%
        </span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full bg-primary"
          style={{ width: `${Math.min(100, mastery.percent)}%` }}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        Đã làm {mastery.attempted.toLocaleString("vi-VN")} câu ở chủ đề này
      </p>
    </Card>
  );
}
