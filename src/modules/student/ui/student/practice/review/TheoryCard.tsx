/**
 * Yêu cầu 3 — nội dung lý thuyết thật để đọc lại, khớp theo mã thành tố của
 * phần học sinh đang yếu.
 *
 * Mở rộng TẠI CHỖ: rời màn kết quả để đọc lý thuyết là mất luôn phần xem lại bài.
 */
import { useState } from "react";
import { BookOpen, ChevronDown } from "lucide-react";
import {
  ContentBlocksView,
  type RichContent,
} from "@/core/content/ContentBlocksView";
import type { WeakPoint } from "@/modules/student/api/practiceApi";

export function TheoryCard({ entry }: { entry: WeakPoint["theory"][number] }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-lg border border-border/60 bg-card p-2 mt-2">
      <div className="flex items-center gap-2">
        <BookOpen className="size-4 text-primary shrink-0" />
        <span className="text-sm font-medium flex-1">{entry.title}</span>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="text-xs font-bold text-primary inline-flex items-center gap-1"
        >
          {open ? "Thu gọn" : "Đọc lý thuyết"}
          <ChevronDown className={open ? "size-3 rotate-180" : "size-3"} />
        </button>
      </div>
      {open && (
        <ContentBlocksView
          content={{ blocks: entry.blocks } as RichContent}
          className="text-sm space-y-2 mt-2"
        />
      )}
    </div>
  );
}
