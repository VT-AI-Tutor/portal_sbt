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
  Users,
  BookOpen,
  CheckCircle,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTeacherClasses } from "@/modules/teacher/hooks/useTeacherClasses";
import { useClassDashboard } from "@/modules/teacher/hooks/useTeacherReporting";

const SUPPORT_REASON: Record<string, string> = {
  diem_thap: "Äiá»ƒm trung bÃ¬nh tháº¥p",
  qua_han: "CÃ³ bÃ i quÃ¡ háº¡n chÆ°a ná»™p",
};

export function TeacherHomePage() {
  const navigate = useNavigate();
  const { data: classes = [], isLoading: classesLoading } = useTeacherClasses();
  const [classId, setClassId] = useState<string | undefined>(undefined);
  const activeClassId = classId ?? classes[0]?.id;
  const { data, isLoading, error } = useClassDashboard(activeClassId);

  const pct = (v: number | null | undefined) => (v == null ? "â€”" : `${v}%`);

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-8 space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold">
            ðŸ“Š Dashboard {data?.class_name ?? "lá»›p"}
          </h1>
          <p className="text-muted-foreground">
            Tá»•ng quan tÃ¬nh hÃ¬nh há»c táº­p
            {data ? ` cá»§a ${data.student_count} há»c sinh` : ""}
          </p>
        </div>
        {classes.length > 0 && (
          <Select value={activeClassId} onValueChange={setClassId}>
            <SelectTrigger className="w-56">
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
        )}
      </div>

      {classesLoading || isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/40 rounded-lg p-4">
          <Loader2 className="size-4 animate-spin" /> Äang táº£iâ€¦
        </div>
      ) : error ? (
        <div className="text-sm text-destructive bg-destructive/10 rounded-lg p-4">
          KhÃ´ng táº£i Ä‘Æ°á»£c dashboard. Thá»­ láº¡i sau.
        </div>
      ) : !activeClassId ? (
        <div className="text-sm text-muted-foreground bg-muted/40 rounded-lg p-4">
          Báº¡n chÆ°a phá»¥ trÃ¡ch lá»›p nÃ o.
        </div>
      ) : (
        data && (
          <>
            <div className="grid sm:grid-cols-4 gap-3">
              <Stat
                icon={Users}
                label="Há»c sinh"
                value={String(data.student_count)}
                color="primary"
              />
              <Stat
                icon={BookOpen}
                label="BÃ i Ä‘ang giao"
                value={String(data.active_assignment_count)}
                color="info"
              />
              <Stat
                icon={CheckCircle}
                label="HoÃ n thÃ nh TB"
                value={pct(data.avg_completion)}
                color="success"
              />
              <Stat
                icon={AlertCircle}
                label="HS yáº¿u cáº§n há»— trá»£"
                value={String(data.support_count)}
                color="destructive"
              />
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <Card className="p-5 border-2">
                <div className="font-display font-bold mb-3">
                  ðŸ“ˆ Tiáº¿n Ä‘á»™ bÃ i táº­p gáº§n nháº¥t
                </div>
                {data.recent_progress.length === 0 ? (
                  <div className="text-sm text-muted-foreground">
                    ChÆ°a cÃ³ bÃ i giao nÃ o Ä‘ang má»Ÿ.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {data.recent_progress.map((b) => (
                      <div key={b.title}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="font-bold">{b.title}</span>
                          <span>
                            {b.done}/{b.total}
                          </span>
                        </div>
                        <div className="h-2 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full bg-primary"
                            style={{
                              width: `${b.total > 0 ? (b.done / b.total) * 100 : 0}%`,
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              <Card className="p-5 border-2 border-warning bg-warning/5">
                <div className="font-display font-bold text-warning mb-3 flex items-center gap-2">
                  <AlertCircle className="text-warning" /> Há»c sinh cáº§n há»— trá»£
                </div>
                {data.support_students.length === 0 ? (
                  <div className="text-sm text-muted-foreground">
                    KhÃ´ng cÃ³ há»c sinh nÃ o cáº§n há»— trá»£.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {/* TREPORT-R10: nÃºt "LiÃªn há»‡" áº©n tá»›i khi cÃ³ sub-project bÃ¡o cÃ¡o phá»¥ huynh. */}
                    {data.support_students.map((s) => (
                      <div
                        key={s.user_id}
                        className="flex justify-between items-center p-2 rounded-lg bg-card border"
                      >
                        <span className="text-sm font-medium">{s.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {SUPPORT_REASON[s.reason] ?? ""}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>

            <Card className="p-5 border-2 border-fun bg-fun/5">
              <div className="font-display font-bold text-fun mb-2">
                ðŸ¤– Gá»£i Ã½ tá»« AI
              </div>
              <p className="text-sm">
                {data.support_count > 0
                  ? `CÃ³ ${data.support_count} há»c sinh cáº§n há»— trá»£. Báº¡n cÃ³ thá»ƒ táº¡o bá»™ cÃ¢u há»i luyá»‡n táº­p riÃªng cho nhÃ³m nÃ y.`
                  : "Lá»›p Ä‘ang tiáº¿n triá»ƒn tá»‘t â€” chÆ°a cÃ³ nhÃ³m cáº§n há»— trá»£ ná»•i báº­t."}
              </p>
              <Button
                className="btn-pop mt-3 rounded-full"
                size="sm"
                onClick={() => navigate("/teacher/bank")}
              >
                Táº¡o bá»™ cÃ¢u há»i
              </Button>
            </Card>
          </>
        )
      )}
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <Card className={`p-4 border-2 border-${color}/30 bg-${color}/5`}>
      <Icon className={`text-${color} size-5 mb-1`} />
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-display text-2xl font-bold">{value}</div>
    </Card>
  );
}
