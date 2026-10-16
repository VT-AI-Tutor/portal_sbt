import { Button } from "@/core/ui/button";
import type { CompetencySubjectDetail } from "@/modules/student/api/practiceApi";
import { masteryColor } from "./masteryColor";

type Unit = NonNullable<CompetencySubjectDetail["units"]>[number];

/**
 * Lát L5 (SPEC §8.5): phân rã theo ĐƠN VỊ KIẾN THỨC — tầng ước lượng thành
 * thạo đúng của hệ, mịn hơn chủ đề. Yếu nhất lên đầu (BE đã sắp); nút "Luyện"
 * là đường vào bù lấp: phiên scope đúng MỘT unit (source=unit).
 */
export function UnitList({
  units,
  onPractice,
  pendingCode,
  disabled = false,
}: {
  units: Unit[];
  onPractice: (unitCode: string) => void;
  pendingCode: string | null;
  disabled?: boolean;
}) {
  if (units.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4">
        {"Sau khi em luyện theo lộ trình, từng kỹ năng nhỏ sẽ hiện ở đây — chỗ nào hổng sẽ thấy ngay."}
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {units.map((u) => {
        const pct = Math.round(u.percent);
        return (
          <div key={u.unit_code} className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <span className="truncate text-sm">{u.label}</span>
                <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                  {pct}% · {u.attempted.toLocaleString("vi-VN")} câu
                </span>
              </div>
              <div className="mt-1 h-2 rounded-full bg-muted">
                <div
                  className="h-2 rounded-full"
                  style={{
                    width: `${Math.min(100, Math.max(4, pct))}%`,
                    backgroundColor: masteryColor(pct).hex,
                  }}
                />
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              disabled={disabled}
              onClick={() => onPractice(u.unit_code)}
            >
              {pendingCode === u.unit_code ? "Đang tạo…" : "Luyện →"}
            </Button>
          </div>
        );
      })}
    </div>
  );
}
