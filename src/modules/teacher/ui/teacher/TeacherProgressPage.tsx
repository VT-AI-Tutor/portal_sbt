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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/core/ui/dialog";
import { useTeacherClasses } from "@/modules/teacher/hooks/useTeacherClasses";
import { useClassProgress } from "@/modules/teacher/hooks/useTeacherReporting";
import type {
  ProgressStudent,
  ReportPeriod,
} from "@/modules/teacher/api/teacherReportingApi";

const PERIODS: { value: ReportPeriod; label: string }[] = [
  { value: "thang_nay", label: "ThÃ¡ng nÃ y" },
  { value: "hoc_ky_1", label: "Há»c ká»³ I" },
  { value: "hoc_ky_2", label: "Há»c ká»³ II" },
  { value: "ca_nam", label: "Cáº£ nÄƒm" },
];

const BAND_LABEL: Record<string, string> = {
  hoc_tot: "Há»c tá»‘t",
  trung_binh: "Trung bÃ¬nh",
  can_ho_tro: "Cáº§n há»— trá»£",
  chua_du_lieu: "ChÆ°a Ä‘á»§ dá»¯ liá»‡u",
};

function scoreColor(score: number | null): string {
  if (score === null) return "text-muted-foreground";
  if (score >= 8) return "text-success";
  if (score >= 6.5) return "text-warning";
  return "text-destructive";
}

export function TeacherProgressPage() {
  const { data: classes = [], isLoading: classesLoading } = useTeacherClasses();
  const [classId, setClassId] = useState<string | undefined>(undefined);
  const [period, setPeriod] = useState<ReportPeriod>("thang_nay");
  const [detail, setDetail] = useState<ProgressStudent | null>(null);

  const activeClassId = classId ?? classes[0]?.id;
  const { data, isLoading, error } = useClassProgress(activeClassId, {
    period,
  });
  const selectedClass = classes.find((c) => c.id === activeClassId);
  const counts = data?.counts ?? { hoc_tot: 0, trung_binh: 0, can_ho_tro: 0 };

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-8 space-y-5">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold">
            ðŸ“ˆ Theo dÃµi tiáº¿n Ä‘á»™
            {selectedClass ? ` â€” ${selectedClass.name}` : ""}
          </h1>
          <p className="text-muted-foreground">
            Äiá»ƒm trung bÃ¬nh vÃ  phÃ¢n loáº¡i há»c lá»±c tá»«ng há»c sinh
          </p>
        </div>
        <div className="flex gap-2">
          <Select value={activeClassId} onValueChange={setClassId}>
            <SelectTrigger className="w-40 rounded-full">
              <SelectValue placeholder="Chá»n lá»›p" />
            </SelectTrigger>
            <SelectContent>
              {classes.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={period}
            onValueChange={(v) => setPeriod(v as ReportPeriod)}
          >
            <SelectTrigger className="w-40 rounded-full">
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
        </div>
      </div>

      {classesLoading || isLoading ? (
        <div className="text-sm text-muted-foreground">Äang táº£iâ€¦</div>
      ) : !activeClassId ? (
        <Card className="p-8 text-center border-2 border-dashed text-muted-foreground">
          Báº¡n chÆ°a phá»¥ trÃ¡ch lá»›p nÃ o.
        </Card>
      ) : error ? (
        <div className="rounded-xl border-2 border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          KhÃ´ng táº£i Ä‘Æ°á»£c tiáº¿n Ä‘á»™ lá»›p. Thá»­ láº¡i sau.
        </div>
      ) : (
        <>
          <div className="grid sm:grid-cols-3 gap-3">
            <Card className="p-4 border-2 border-success bg-success/5">
              <div className="text-xs text-muted-foreground">Há»c tá»‘t</div>
              <div className="font-display text-2xl font-bold text-success">
                {counts.hoc_tot} HS
              </div>
            </Card>
            <Card className="p-4 border-2 border-warning bg-warning/5">
              <div className="text-xs text-muted-foreground">Trung bÃ¬nh</div>
              <div className="font-display text-2xl font-bold">
                {counts.trung_binh} HS
              </div>
            </Card>
            <Card className="p-4 border-2 border-destructive bg-destructive/5">
              <div className="text-xs text-muted-foreground">Cáº§n há»— trá»£</div>
              <div className="font-display text-2xl font-bold text-destructive">
                {counts.can_ho_tro} HS
              </div>
            </Card>
          </div>

          <Card className="p-0 border-2 overflow-hidden">
            <div className="p-4 border-b-2 font-display font-bold">
              Danh sÃ¡ch há»c sinh
            </div>
            {(data?.students.length ?? 0) === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">
                ChÆ°a cÃ³ há»c sinh nÃ o trong lá»›p.
              </div>
            ) : (
              <div className="divide-y">
                {data!.students.map((s) => (
                  <div key={s.user_id} className="p-3 flex items-center gap-3">
                    <div className="size-10 rounded-full bg-gradient-to-br from-primary to-fun flex items-center justify-center text-primary-foreground font-bold shrink-0">
                      {s.name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-sm truncate">{s.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {s.done}/{s.total} bÃ i Â· {BAND_LABEL[s.band]}
                      </div>
                    </div>
                    <div
                      className={`font-bold text-lg ${scoreColor(s.avg_score)}`}
                    >
                      {s.avg_score === null ? "â€”" : s.avg_score.toFixed(1)}
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setDetail(s)}
                    >
                      Chi tiáº¿t
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </>
      )}

      <Dialog
        open={detail !== null}
        onOpenChange={(v) => !v && setDetail(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">{detail?.name}</DialogTitle>
          </DialogHeader>
          {detail && (
            <div className="space-y-2 text-sm">
              <div>
                <strong>Tiáº¿n Ä‘á»™:</strong> {detail.done}/{detail.total} bÃ i Ä‘Ã£
                ná»™p
              </div>
              <div>
                <strong>Äiá»ƒm TB:</strong>{" "}
                <span className={scoreColor(detail.avg_score)}>
                  {detail.avg_score === null
                    ? "â€”"
                    : detail.avg_score.toFixed(1)}
                </span>
              </div>
              <div>
                <strong>PhÃ¢n loáº¡i:</strong> {BAND_LABEL[detail.band]}
              </div>
              <p className="text-xs text-muted-foreground pt-2 border-t">
                Chi tiáº¿t tá»«ng bÃ i (phiáº¿u / thi) sáº½ bá»• sung sau.
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
