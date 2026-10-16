/**
 * Bảng báo cáo địa bàn — dùng chung cho CẢ BA màn (Bộ · Tỉnh · Xã). Ba màn là ba
 * tệp riêng theo quyết định của Owner, nhưng bảy cột chỉ được định nghĩa ở đây:
 * ba bản chép tay sẽ trôi khỏi nhau ngay lần đổi chỉ số đầu tiên.
 */
import { Link } from "react-router-dom";
import { Card } from "@/core/ui/card";
import type { TerritoryRow } from "@/modules/manager/api/territoryApi";

interface Props {
  rows: TerritoryRow[];
  /** Đường dẫn đi xuống cấp dưới; null = dòng không bấm được (đã là cấp cuối). */
  linkTo: ((row: TerritoryRow) => string) | null;
  unitLabel: string;
  /**
   * Cột "số trường". Tắt ở màn cấp Xã: ở đó mỗi dòng ĐÃ LÀ một trường nên cột
   * này luôn bằng 1, đứng cạnh tên trường chỉ gây rối.
   */
  showSchoolCount?: boolean;
}

function pct(value: number): string {
  return `${value}%`;
}

export function TerritoryReportTable({
  rows,
  linkTo,
  unitLabel,
  showSchoolCount = true,
}: Props) {
  if (rows.length === 0) {
    return (
      <Card className="p-6 text-sm text-muted-foreground">
        Chưa có {unitLabel.toLowerCase()} nào trong phạm vi này.
      </Card>
    );
  }

  return (
    <Card className="overflow-x-auto p-0">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/40 text-xs uppercase text-muted-foreground">
            <th className="px-3 py-2 text-left font-bold">{unitLabel}</th>
            {showSchoolCount && (
              <th className="px-3 py-2 text-right font-bold">Trường</th>
            )}
            <th className="px-3 py-2 text-right font-bold">Lớp</th>
            <th className="px-3 py-2 text-right font-bold">Học sinh</th>
            <th className="px-3 py-2 text-right font-bold">Hoạt động 30 ngày</th>
            <th className="px-3 py-2 text-right font-bold">Học đều</th>
            <th className="px-3 py-2 text-right font-bold">Phiên 30 ngày</th>
            <th className="px-3 py-2 text-right font-bold">Tỷ lệ đúng</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const href = row.org_unit_id !== null && linkTo ? linkTo(row) : null;
            return (
              <tr
                key={row.org_unit_id ?? "__unassigned__"}
                className="border-b last:border-0 hover:bg-muted/30"
              >
                <td className="px-3 py-2">
                  {href ? (
                    <Link className="font-medium text-primary hover:underline" to={href}>
                      {row.name}
                    </Link>
                  ) : (
                    // Dòng gộp "chưa gắn xã": ghi chú chất lượng dữ liệu, không
                    // phải một địa bàn đi xuống được.
                    <span className="font-medium text-muted-foreground">{row.name}</span>
                  )}
                </td>
                {showSchoolCount && (
                  <td className="px-3 py-2 text-right tabular-nums">{row.schools}</td>
                )}
                <td className="px-3 py-2 text-right tabular-nums">{row.classes}</td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {row.students.toLocaleString("vi-VN")}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {row.active_30d.toLocaleString("vi-VN")}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{pct(row.active_rate)}</td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {row.sessions_30d.toLocaleString("vi-VN")}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{pct(row.correct_rate)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Card>
  );
}
