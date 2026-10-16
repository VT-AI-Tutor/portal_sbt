import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/core/ui/card";
import { Button } from "@/core/ui/button";
import { Skeleton } from "@/core/ui/skeleton";
import { useAccessToken } from "@/core/auth/AuthContext";
import { managerApi, type ManagerClassRow } from "@/modules/manager/api/managerApi";
import { downloadTable } from "@/modules/manager/lib/exportTable";
import { BAND_CLASSES, BAND_LABELS, formatScore } from "./bandLabels";

/**
 * Tab "Lớp học" của khu Ban giám hiệu: danh sách lớp VÀ so sánh giữa các lớp/khối trên cùng
 * một bảng — cùng một dữ liệu, tách hai màn chỉ tổ làm lệch số.
 *
 * Thanh điểm vẽ kèm vạch mốc trung bình toàn trường, để thấy ngay lớp nào dưới mặt bằng thay
 * vì bắt người đọc tự so từng con số.
 */
export function ManagerClassesTab({ schoolId }: { schoolId: string }) {
  const token = useAccessToken();
  const [sort, setSort] = useState<"name" | "score">("name");
  const [dir, setDir] = useState<"asc" | "desc">("asc");

  const params = { school_org_unit_id: schoolId, sort, dir };
  const { data, isLoading, error } = useQuery({
    queryKey: ["manager-classes", params],
    queryFn: () => managerApi.classes(token!, params),
    enabled: !!token,
  });

  const changeSort = (next: "name" | "score") => {
    if (sort === next) {
      setDir(dir === "asc" ? "desc" : "asc");

      return;
    }
    setSort(next);
    setDir("asc");
  };

  const exportCsv = () => {
    downloadTable({
      filename: "danh-sach-lop",
      headers: [
        "Lớp", "Khối", "Giáo viên chủ nhiệm", "Sĩ số", "Có luyện tập",
        "Số phiên", "Điểm TB lớp", "Xếp loại", "Cần hỗ trợ", "Dưới báo động",
      ],
      rows: (data?.items ?? []).map((c) => [
        c.name, c.grade, c.homeroom_teacher?.full_name ?? "", c.student_count,
        c.students_active, c.sessions,
        c.avg_score === null ? "" : formatScore(c.avg_score),
        BAND_LABELS[c.band], c.need_support, c.alerting,
      ]),
    });
  };

  if (error) {
    return (
      <Card className="p-6 text-sm text-destructive">
        {error instanceof Error ? error.message : "Không tải được danh sách lớp."}
      </Card>
    );
  }

  if (isLoading && !data) {
    return <Skeleton className="h-60 w-full" />;
  }

  const items = data?.items ?? [];
  const schoolAvg = data?.school_avg_score ?? null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm text-muted-foreground">
          {items.length} lớp · Điểm trung bình toàn trường:{" "}
          <span className="font-medium text-foreground">{formatScore(schoolAvg)}</span>
        </span>
        <Button variant="outline" className="ml-auto" onClick={exportCsv} disabled={items.length === 0}>
          Xuất Excel
        </Button>
      </div>

      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className="px-4 py-3 font-medium">
                <button className="hover:underline" onClick={() => changeSort("name")}>
                  Lớp {sort === "name" ? (dir === "asc" ? "▲" : "▼") : "↕"}
                </button>
              </th>
              <th className="px-4 py-3 font-medium">Giáo viên chủ nhiệm</th>
              <th className="px-4 py-3 font-medium">Sĩ số</th>
              <th className="px-4 py-3 font-medium">Có luyện tập</th>
              <th className="px-4 py-3 font-medium">
                <button className="hover:underline" onClick={() => changeSort("score")}>
                  Điểm TB lớp {sort === "score" ? (dir === "asc" ? "▲" : "▼") : "↕"}
                </button>
              </th>
              <th className="px-4 py-3 font-medium">Cần hỗ trợ</th>
            </tr>
          </thead>
          <tbody>
            {items.map((c) => (
              <tr key={c.class_id} className="border-b last:border-0">
                <td className="px-4 py-2">
                  <div className="font-medium">{c.name}</div>
                  <div className="text-xs text-muted-foreground">Khối {c.grade}</div>
                </td>
                <td className="px-4 py-2">{c.homeroom_teacher?.full_name ?? "Chưa gán"}</td>
                <td className="px-4 py-2">{c.student_count}</td>
                <td className="px-4 py-2">
                  {c.students_active}
                  {c.student_count > 0 && (
                    <span className="ml-1 text-xs text-muted-foreground">
                      ({Math.round((c.students_active / c.student_count) * 100)}%)
                    </span>
                  )}
                </td>
                <td className="px-4 py-2">
                  <ScoreBar score={c.avg_score} schoolAvg={schoolAvg} />
                </td>
                <td className="px-4 py-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs ${BAND_CLASSES[c.band]}`}>
                    {BAND_LABELS[c.band]}
                  </span>
                  {c.need_support > 0 && (
                    <span className="ml-2 text-xs text-muted-foreground">
                      {c.need_support} em
                      {c.alerting > 0 && (
                        <span className="text-destructive"> · {c.alerting} dưới báo động</span>
                      )}
                    </span>
                  )}
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                  Trường chưa có lớp nào trong năm học này.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

/** Thanh điểm 0-10 kèm vạch mốc trung bình trường. */
function ScoreBar({ score, schoolAvg }: { score: number | null; schoolAvg: number | null }) {
  if (score === null) {
    return <span className="text-muted-foreground">Chưa có dữ liệu</span>;
  }
  const below = schoolAvg !== null && score < schoolAvg;

  return (
    <div className="flex items-center gap-2">
      <div className="relative h-2 w-28 overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full rounded-full ${below ? "bg-destructive" : "bg-primary"}`}
          style={{ width: `${Math.max(0, Math.min(100, score * 10))}%` }}
        />
        {schoolAvg !== null && (
          <span
            className="absolute inset-y-0 w-px bg-foreground/60"
            style={{ left: `${Math.max(0, Math.min(100, schoolAvg * 10))}%` }}
            aria-hidden
          />
        )}
      </div>
      <span className={`font-medium ${below ? "text-destructive" : ""}`}>{formatScore(score)}</span>
    </div>
  );
}

export type { ManagerClassRow };
