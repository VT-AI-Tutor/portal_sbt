import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Card } from "@/core/ui/card";
import { Button } from "@/core/ui/button";
import { Input } from "@/core/ui/input";
import { Label } from "@/core/ui/label";
import { Skeleton } from "@/core/ui/skeleton";
import { useAccessToken } from "@/core/auth/AuthContext";
import {
  managerApi,
  type StudentBand,
  type StudentListQuery,
} from "@/modules/manager/api/managerApi";
import { downloadTable } from "@/modules/manager/lib/exportTable";
import { BAND_CLASSES, BAND_LABELS, formatScore } from "./bandLabels";

const PER_PAGE = 50;

/**
 * Tab "Học sinh" của khu Ban giám hiệu: danh sách từng em kèm điểm, xếp loại và cảnh báo —
 * phần mà khu này trước đây hoàn toàn không có (chỉ toàn số liệu tổng hợp).
 *
 * Ngưỡng xếp loại KHÔNG cứng ở web: mặc định do máy chủ quyết (config), người xem đổi được
 * ngay trên màn và máy chủ trả lại đúng ngưỡng đã dùng để hiển thị lại.
 */
export function ManagerStudentsTab({ schoolId }: { schoolId: string }) {
  const token = useAccessToken();

  const [q, setQ] = useState("");
  const [band, setBand] = useState<StudentBand | "">("");
  const [alertingOnly, setAlertingOnly] = useState(false);
  const [sort, setSort] = useState<"name" | "score">("name");
  const [dir, setDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);
  // Ô ngưỡng để trống = dùng mặc định của máy chủ; chỉ gửi lên khi người dùng thực sự nhập.
  const [bandGood, setBandGood] = useState("");
  const [bandMid, setBandMid] = useState("");
  const [bandAlert, setBandAlert] = useState("");

  const params: StudentListQuery = {
    school_org_unit_id: schoolId,
    sort,
    dir,
    page,
    per_page: PER_PAGE,
    q: q.trim() || undefined,
    band: band || undefined,
    alerting: alertingOnly || undefined,
    band_good: bandGood === "" ? undefined : Number(bandGood),
    band_mid: bandMid === "" ? undefined : Number(bandMid),
    band_alert: bandAlert === "" ? undefined : Number(bandAlert),
  };

  const { data, isLoading, error } = useQuery({
    queryKey: ["manager-students", params],
    queryFn: () => managerApi.students(token!, params),
    enabled: !!token,
    // Giữ trang cũ trong lúc tải trang mới — bảng không nhấp nháy khi đổi bộ lọc.
    placeholderData: keepPreviousData,
  });

  const changeSort = (next: "name" | "score") => {
    setPage(1);
    if (sort === next) {
      setDir(dir === "asc" ? "desc" : "asc");

      return;
    }
    setSort(next);
    // Tên mặc định A-Z; điểm mặc định thấp lên trước — lãnh đạo mở bảng là để tìm em yếu.
    setDir(next === "name" ? "asc" : "asc");
  };

  const exportCsv = () => {
    const rows = (data?.items ?? []).map((s) => [
      s.full_name,
      s.class?.name ?? "",
      s.grade ?? "",
      s.sessions,
      s.avg_score === null ? "" : formatScore(s.avg_score),
      BAND_LABELS[s.band],
      s.alerting ? "Có" : "",
      s.email ?? "",
    ]);
    downloadTable({
      filename: "danh-sach-hoc-sinh",
      headers: ["Họ tên", "Lớp", "Khối", "Số phiên", "Điểm TB", "Xếp loại", "Báo động", "Email"],
      rows,
    });
  };

  if (error) {
    return (
      <Card className="p-6 text-sm text-destructive">
        {error instanceof Error ? error.message : "Không tải được danh sách học sinh."}
      </Card>
    );
  }

  const items = data?.items ?? [];
  const counts = data?.counts;
  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / PER_PAGE));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label htmlFor="student-q">Tìm theo tên</Label>
          <Input
            id="student-q"
            className="w-56"
            placeholder="Gõ tên học sinh…"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="student-band">Xếp loại</Label>
          <select
            id="student-band"
            className="h-10 rounded-md border px-3 text-sm"
            value={band}
            onChange={(e) => {
              setBand(e.target.value as StudentBand | "");
              setPage(1);
            }}
          >
            <option value="">Tất cả</option>
            {(Object.keys(BAND_LABELS) as StudentBand[]).map((b) => (
              <option key={b} value={b}>
                {BAND_LABELS[b]}
              </option>
            ))}
          </select>
        </div>

        <label className="flex h-10 items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={alertingOnly}
            onChange={(e) => {
              setAlertingOnly(e.target.checked);
              setPage(1);
            }}
          />
          Chỉ em dưới mức báo động
        </label>

        <div className="ml-auto flex items-end gap-2">
          <Button variant="outline" onClick={exportCsv} disabled={items.length === 0}>
            Xuất Excel
          </Button>
        </div>
      </div>

      {/* Ngưỡng là THAM SỐ, không hard-code: trường chấm chặt/lỏng hơn mặt bằng vẫn dùng
          chung một màn. Bỏ trống = theo mặc định của hệ thống. */}
      <Card className="flex flex-wrap items-end gap-3 p-3">
        <span className="text-sm font-medium">Ngưỡng xếp loại (thang 10):</span>
        {[
          { id: "band-good", label: "Học tốt từ", value: bandGood, set: setBandGood, hint: data?.thresholds.good },
          { id: "band-mid", label: "Trung bình từ", value: bandMid, set: setBandMid, hint: data?.thresholds.mid },
          { id: "band-alert", label: "Báo động dưới", value: bandAlert, set: setBandAlert, hint: data?.thresholds.alert },
        ].map((f) => (
          <div key={f.id} className="space-y-1">
            <Label htmlFor={f.id} className="text-xs text-muted-foreground">
              {f.label}
            </Label>
            <Input
              id={f.id}
              className="w-24"
              inputMode="decimal"
              placeholder={f.hint === null || f.hint === undefined ? "—" : String(f.hint)}
              value={f.value}
              onChange={(e) => {
                f.set(e.target.value);
                setPage(1);
              }}
            />
          </div>
        ))}
        <span className="text-xs text-muted-foreground">
          Bỏ trống = dùng mặc định của hệ thống.
        </span>
      </Card>

      {counts && (
        <div className="flex flex-wrap gap-2 text-sm">
          {(Object.keys(BAND_LABELS) as StudentBand[]).map((b) => (
            <span key={b} className={`rounded-full px-3 py-1 ${BAND_CLASSES[b]}`}>
              {BAND_LABELS[b]}: {counts[b] ?? 0}
            </span>
          ))}
          <span className="rounded-full bg-destructive/10 px-3 py-1 text-destructive">
            Dưới báo động: {counts.alerting ?? 0}
          </span>
          <span className="self-center text-muted-foreground">
            (tính trên toàn trường, không đổi theo bộ lọc)
          </span>
        </div>
      )}

      {data?.truncated && (
        <p className="text-sm text-destructive" role="alert">
          Trường có quá nhiều học sinh nên danh sách đã bị cắt bớt — hãy lọc theo khối hoặc lớp
          để xem đủ.
        </p>
      )}

      <Card className="overflow-x-auto">
        {isLoading && !data ? (
          <div className="space-y-2 p-4">
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-full" />
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="px-4 py-3 font-medium">
                  <button className="hover:underline" onClick={() => changeSort("name")}>
                    Họ tên {sort === "name" ? (dir === "asc" ? "▲" : "▼") : "↕"}
                  </button>
                </th>
                <th className="px-4 py-3 font-medium">Lớp</th>
                <th className="px-4 py-3 font-medium">Số phiên</th>
                <th className="px-4 py-3 font-medium">
                  <button className="hover:underline" onClick={() => changeSort("score")}>
                    Điểm TB {sort === "score" ? (dir === "asc" ? "▲" : "▼") : "↕"}
                  </button>
                </th>
                <th className="px-4 py-3 font-medium">Xếp loại</th>
              </tr>
            </thead>
            <tbody>
              {items.map((s) => (
                <tr
                  key={s.user_id}
                  className={`border-b last:border-0 ${s.alerting ? "bg-destructive/5" : ""}`}
                >
                  <td className="px-4 py-2">
                    <div className="font-medium">{s.full_name || "—"}</div>
                    {s.email && (
                      <div className="text-xs text-muted-foreground">{s.email}</div>
                    )}
                  </td>
                  <td className="px-4 py-2">{s.class?.name ?? "Chưa xếp lớp"}</td>
                  <td className="px-4 py-2">{s.sessions}</td>
                  <td className="px-4 py-2 font-medium">{formatScore(s.avg_score)}</td>
                  <td className="px-4 py-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs ${BAND_CLASSES[s.band]}`}>
                      {BAND_LABELS[s.band]}
                    </span>
                    {s.alerting && (
                      <span className="ml-2 rounded-full bg-destructive px-2 py-0.5 text-xs text-destructive-foreground">
                        Dưới báo động
                      </span>
                    )}
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                    Không có học sinh nào khớp bộ lọc.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-end gap-3 text-sm">
          <span className="text-muted-foreground">
            Trang {data?.page ?? 1} / {totalPages} · {data?.total ?? 0} em
          </span>
          <Button
            size="sm"
            variant="outline"
            disabled={(data?.page ?? 1) <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Trước
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={(data?.page ?? 1) >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Sau
          </Button>
        </div>
      )}
    </div>
  );
}
