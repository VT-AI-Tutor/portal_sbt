/**
 * Báo cáo chi tiết 1 trường (Task 9) — đọc managerApi.schoolReport theo :id
 * trong route + năm học chọn được (mặc định năm hiện hành). Bốn khối: tổng
 * quan, theo khối, luyện tập 30 ngày qua, thành thạo theo môn.
 */
import { useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { Card } from "@/core/ui/card";
import { Skeleton } from "@/core/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/core/ui/select";
import { useAccessToken } from "@/core/auth/AuthContext";
import { academicYearOptions, currentAcademicYear } from "@/core/reference/academicYear";
import { useSubjects } from "@/core/reference";
import { managerApi } from "@/modules/manager/api/managerApi";
import type { ActivityDay } from "@/modules/manager/api/managerApi";

function formatRate(rate: number | null): string {
  if (rate === null) return "Chưa có dữ liệu";
  return `${Math.round(rate * 1000) / 10}%`;
}

const LEVEL_LABELS: Record<string, string> = {
  biet: "Biết",
  hieu: "Hiểu",
  van_dung: "Vận dụng",
  vd_cao: "Vận dụng cao",
};

function ActivitySparkline({ days }: { days: ActivityDay[] }) {
  const max = days.length === 0 ? 0 : Math.max(...days.map((d) => d.sessions));
  if (max === 0)
    return (
      <div className="p-8 text-center text-sm text-muted-foreground">
        Chưa có dữ liệu
      </div>
    );
  const W = 600,
    H = 80,
    bw = W / days.length;
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full"
      role="img"
      aria-label="Phiên luyện tập theo ngày, 30 ngày"
    >
      {days.map((d, i) => (
        <rect
          key={d.date}
          x={i * bw + 1}
          width={bw - 2}
          y={H - (d.sessions / max) * (H - 8)}
          height={(d.sessions / max) * (H - 8)}
          rx={2}
          className="fill-primary/70"
        >
          <title>{`${d.date}: ${d.sessions} phiên`}</title>
        </rect>
      ))}
    </svg>
  );
}

const STAT_TILE_STYLES = [
  "border-primary/30 bg-primary/5",
  "border-success/30 bg-success/5",
  "border-info/30 bg-info/5",
  "border-warning/30 bg-warning/5",
  // "fun" (tím/hồng) — cùng công thức viền/nền với 4 thẻ trên, tránh trơ trụi
  // như accent (vốn đã rất nhạt sẵn nên border/30 + bg/5 gần như vô hình).
  "border-fun/30 bg-fun/5",
];

function StatTile({
  label,
  value,
  index,
}: {
  label: string;
  value: string | number;
  index: number;
}) {
  return (
    <Card className={`border-2 p-4 ${STAT_TILE_STYLES[index % STAT_TILE_STYLES.length]}`}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-display text-2xl font-bold">
        {typeof value === "number" ? value.toLocaleString("vi-VN") : value}
      </div>
    </Card>
  );
}

export function SchoolReportPage() {
  const { id } = useParams<{ id: string }>();
  const token = useAccessToken();
  const [year, setYear] = useState(currentAcademicYear());
  const { data: subjects = [] } = useSubjects();

  const { data, isLoading, error } = useQuery({
    queryKey: ["manager-school-report", id, year],
    queryFn: () =>
      managerApi.schoolReport(token!, {
        school_org_unit_id: id!,
        academic_year: year,
      }),
    enabled: !!token && !!id,
  });

  const subjectLabel = (code: string) =>
    subjects.find((s) => s.code === code)?.label ?? code;

  if (!token) {
    return (
      <div className="mx-auto max-w-6xl p-4 md:p-8">
        <Card className="p-6 text-sm text-muted-foreground">
          Bạn cần đăng nhập để xem báo cáo.
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-6xl space-y-3 p-4 md:p-8">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-6xl p-4 md:p-8">
        <Card className="p-6 text-sm text-destructive">
          {error instanceof Error
            ? error.message
            : "Không tải được báo cáo trường."}
        </Card>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-4 md:p-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold">
            🏫 {data.school.name}
          </h1>
          <p className="text-muted-foreground">Báo cáo tổng hợp cấp trường</p>
        </div>
        <Select value={year} onValueChange={setYear}>
          <SelectTrigger className="w-36 rounded-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {academicYearOptions().map((y) => (
              <SelectItem key={y} value={y}>
                {y}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <StatTile
          index={0}
          label="Khối / Lớp"
          value={`${data.by_grade.length} / ${data.totals.classes}`}
        />
        <StatTile index={1} label="Học sinh" value={data.totals.students} />
        <StatTile index={2} label="Giáo viên" value={data.totals.teachers} />
        <StatTile index={3} label="Phân công" value={data.totals.assignments} />
        <StatTile
          index={4}
          label="Hoạt động 7 ngày"
          value={data.activity.students_active_7d}
        />
      </div>

      <Card className="overflow-x-auto">
        <div className="border-b p-4 font-display font-bold">
          📚 Thống kê theo khối
        </div>
        {data.by_grade.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            Chưa có dữ liệu lớp.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="px-4 py-3 font-medium">Khối</th>
                <th className="px-4 py-3 font-medium">Số lớp</th>
                <th className="px-4 py-3 font-medium">Sĩ số</th>
                <th className="px-4 py-3 font-medium">
                  Tham gia luyện tập 30 ngày
                </th>
                <th className="px-4 py-3 font-medium">Tỉ lệ đúng</th>
              </tr>
            </thead>
            <tbody>
              {data.by_grade.map((g) => {
                const share =
                  g.student_count > 0
                    ? g.students_active_30d / g.student_count
                    : null;
                return (
                  <tr key={g.grade} className="border-b last:border-0">
                    <td className="px-4 py-3 font-medium">{g.grade}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {g.class_count.toLocaleString("vi-VN")}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {g.student_count.toLocaleString("vi-VN")}
                    </td>
                    <td className="px-4 py-3">
                      {share === null ? (
                        <span className="text-muted-foreground">
                          Chưa có dữ liệu
                        </span>
                      ) : (
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-28 overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full rounded-full bg-primary"
                              style={{ width: `${Math.round(share * 100)}%` }}
                            />
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {Math.round(share * 100)}%
                          </span>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {formatRate(g.correct_rate)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>

      {data.totals.students > 0 && (
        <Card className="p-4">
          {data.totals.classes === 0 ? (
            // Đầu năm học chưa xếp lớp: "đã vào lớp 0/N" gây hoảng — thay bằng
            // thông điệp trung tính, không phải một tỉ lệ trông như sự cố.
            <div className="text-sm text-muted-foreground">
              Chưa có lớp cho năm học {year}
            </div>
          ) : (
            <>
              <div className="mb-2 text-sm font-medium">
                🎒 Biên chế {year}: đã vào lớp {data.enrollment.in_class}/
                {data.totals.students} học sinh
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{
                    width: `${Math.round(
                      (data.enrollment.in_class / data.totals.students) * 100,
                    )}%`,
                  }}
                />
              </div>
            </>
          )}
        </Card>
      )}

      <Card className="p-5 border-2">
        <div className="mb-3 font-display font-bold">
          🎯 Luyện tập 30 ngày qua
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <div className="text-xs text-muted-foreground">Phiên</div>
            <div className="font-display text-2xl font-bold">
              {data.practice_30d.sessions.toLocaleString("vi-VN")}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">
              Học sinh hoạt động
            </div>
            <div className="font-display text-2xl font-bold">
              {data.practice_30d.students_active.toLocaleString("vi-VN")}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Tỉ lệ đúng</div>
            <div className="font-display text-2xl font-bold">
              {formatRate(data.practice_30d.correct_rate)}
            </div>
          </div>
        </div>
      </Card>

      <Card className="overflow-x-auto">
        <div className="border-b p-4 font-display font-bold">
          🧠 Thành thạo theo môn (tích luỹ)
        </div>
        {data.mastery_by_subject.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            Chưa có dữ liệu luyện tập.
          </div>
        ) : (
          <div className="divide-y">
            {data.mastery_by_subject.map((m) => (
              <div
                key={m.subject_code}
                className="flex items-center gap-3 px-4 py-2"
              >
                <div className="w-28 shrink-0 font-medium">
                  {subjectLabel(m.subject_code)}
                </div>
                <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{
                      width: `${Math.round((m.correct_rate ?? 0) * 100)}%`,
                    }}
                  />
                </div>
                <div className="w-56 shrink-0 text-right text-xs text-muted-foreground">
                  {formatRate(m.correct_rate)}
                  {m.high_share !== null && (
                    <> · ≥80%: {Math.round(m.high_share * 100)}%</>
                  )}{" "}
                  · {m.students.toLocaleString("vi-VN")} HS
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {data.cognitive_levels.length > 0 && (
        <Card className="overflow-x-auto">
          <div className="border-b p-4 font-display font-bold">
            📊 Phân bố mức nhận thức
          </div>
          <div className="divide-y">
            {data.cognitive_levels.map((s) => (
              <div key={s.subject_code} className="px-4 py-2">
                <div className="mb-1 text-sm font-medium">
                  {subjectLabel(s.subject_code)}
                </div>
                <div className="flex flex-wrap gap-4">
                  {s.levels.map((lv) => (
                    <div key={lv.key} className="flex items-center gap-2 text-xs">
                      <span className="w-20 text-muted-foreground">
                        {LEVEL_LABELS[lv.key] ?? lv.key}
                      </span>
                      <div className="h-2 w-24 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{
                            width: `${Math.round((lv.correct_rate ?? 0) * 100)}%`,
                          }}
                        />
                      </div>
                      <span>
                        {formatRate(lv.correct_rate)} ·{" "}
                        {lv.attempted.toLocaleString("vi-VN")} lượt
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card className="p-5 border-2">
        <div className="mb-3 font-display font-bold">
          📈 Hoạt động 30 ngày qua
        </div>
        <ActivitySparkline days={data.activity.by_day} />
      </Card>
    </div>
  );
}
