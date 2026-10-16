import { useState } from "react";
import { Card } from "@/core/ui/card";
import { Button } from "@/core/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/core/ui/select";
import { Download, Loader2 } from "lucide-react";
import { useTeacherClasses } from "@/modules/teacher/hooks/useTeacherClasses";
import { useClassReport } from "@/modules/teacher/hooks/useTeacherReporting";
import { useSubjects, getSubjectDisplay } from "@/core/reference";
import type { ReportPeriod } from "@/modules/teacher/api/teacherReportingApi";

const PERIODS: { value: ReportPeriod; label: string }[] = [
  { value: "thang_nay", label: "Tháng này" },
  { value: "hoc_ky_1", label: "Học kỳ I" },
  { value: "hoc_ky_2", label: "Học kỳ II" },
  { value: "ca_nam", label: "Cả năm" },
];

function masteryColor(band: string): string {
  if (band === "gioi") return "bg-success";
  if (band === "kha") return "bg-info";
  if (band === "tb") return "bg-warning";
  return "bg-destructive";
}

export function TeacherReportsPage() {
  const { data: classes = [] } = useTeacherClasses();
  const { data: subjects = [] } = useSubjects();
  const [classId, setClassId] = useState<string | undefined>(undefined);
  const [subject, setSubject] = useState<string | undefined>(undefined);
  const [period, setPeriod] = useState<ReportPeriod>("hoc_ky_1");

  const activeClassId = classId ?? classes[0]?.id;
  const activeSubject = subject ?? subjects[0]?.code;
  const selectedClass = classes.find((c) => c.id === activeClassId);
  const { data, isLoading, error } = useClassReport(activeClassId, {
    subject: activeSubject,
    period,
  });

  const num = (v: number | null | undefined, suffix = "") =>
    v == null ? "—" : `${v}${suffix}`;

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-8 space-y-5">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold">
            📊 Báo cáo {selectedClass?.name ?? "lớp"}
          </h1>
          <p className="text-muted-foreground">
            Tổng hợp kết quả học tập theo môn &amp; kỳ
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Select value={activeClassId} onValueChange={setClassId}>
            <SelectTrigger className="w-32 rounded-full">
              <SelectValue placeholder="Lớp" />
            </SelectTrigger>
            <SelectContent>
              {classes.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={activeSubject} onValueChange={setSubject}>
            <SelectTrigger className="w-40 rounded-full">
              <SelectValue placeholder="Môn" />
            </SelectTrigger>
            <SelectContent>
              {subjects.map((s) => (
                <SelectItem key={s.code} value={s.code}>
                  {getSubjectDisplay(s.code, s.label).label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={period}
            onValueChange={(v) => setPeriod(v as ReportPeriod)}
          >
            <SelectTrigger className="w-36 rounded-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PERIODS.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {/* TREPORT-R9: xuất PDF read-only (in trang). Nút gửi phụ huynh gỡ theo R10. */}
          <Button
            variant="outline"
            className="rounded-full"
            onClick={() => window.print()}
          >
            <Download className="size-4 mr-1" />
            Xuất PDF
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/40 rounded-lg p-4">
          <Loader2 className="size-4 animate-spin" /> Đang tải…
        </div>
      ) : !activeClassId ? (
        <Card className="p-8 text-center border-2 border-dashed text-muted-foreground">
          Bạn chưa phụ trách lớp nào.
        </Card>
      ) : error ? (
        <div className="text-sm text-destructive bg-destructive/10 rounded-lg p-4">
          Không tải được báo cáo lớp. Thử lại sau.
        </div>
      ) : (
        data && (
          <>
            <div className="grid sm:grid-cols-3 gap-3">
              <Card className="p-4 border-2 border-primary/30 bg-primary/5">
                <div className="text-xs text-muted-foreground">Điểm TB lớp</div>
                <div className="font-display text-2xl font-bold">
                  {data.class_avg_score === null
                    ? "—"
                    : data.class_avg_score.toFixed(1)}
                </div>
              </Card>
              <Card className="p-4 border-2 border-success/30 bg-success/5">
                <div className="text-xs text-muted-foreground">
                  Tỉ lệ hoàn thành
                </div>
                <div className="font-display text-2xl font-bold">
                  {num(data.avg_completion, "%")}
                </div>
              </Card>
              <Card className="p-4 border-2 border-info/30 bg-info/5">
                <div className="text-xs text-muted-foreground">
                  Câu hỏi đã làm
                </div>
                <div className="font-display text-2xl font-bold">
                  {data.questions_done.toLocaleString("vi-VN")}
                </div>
              </Card>
            </div>

            <Card className="p-5 border-2">
              <div className="font-display font-bold mb-3">
                🎯 Mức độ thành thạo theo chủ đề
              </div>
              {data.topics.length === 0 ? (
                <div className="text-sm text-muted-foreground">
                  Chưa có dữ liệu mức thành thạo cho môn này.
                </div>
              ) : (
                <div className="space-y-3">
                  {data.topics.map((t) => (
                    <div key={t.topic}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="font-bold">{t.topic}</span>
                        <span>Mức thành thạo {t.mastery_percent}%</span>
                      </div>
                      <div className="h-3 rounded-full bg-muted overflow-hidden">
                        <div
                          className={`h-full ${masteryColor(t.band)}`}
                          style={{ width: `${t.mastery_percent}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </>
        )
      )}
    </div>
  );
}
