import { useState } from "react";
import { missingAssignFields } from "./assignWizardLogic";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/core/ui/dialog";
import { Button } from "@/core/ui/button";
import { Input } from "@/core/ui/input";
import {
  ChevronLeft,
  ChevronRight,
  Send,
  ClipboardList,
  Users,
  Calendar,
  Bell,
} from "lucide-react";
import { toast } from "sonner";
import {
  Stepper,
  OptionCard,
  AssignModeSelector,
  ASSIGN_MODE_LABEL,
  type AssignMode,
} from "./PaperWizardShared";
import { cn } from "@/core/lib/utils";
import {
  useTeacherClasses,
  useAssign,
} from "@/modules/teacher/hooks/useTeacherClasses";
import { useTeacherPapers } from "@/modules/teacher/hooks/useTeacherPaper";

const STEPS = ["Chá»n phiáº¿u", "Giao bÃ i"];

function defaultDue() {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return d.toISOString().slice(0, 10);
}

export function AssignWizard({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [step, setStep] = useState(0);
  const [classId, setClassId] = useState<string>("");
  const [paperId, setPaperId] = useState<string | null>(null);
  const [due, setDue] = useState(defaultDue());
  const [notify, setNotify] = useState(true);
  const [assignMode, setAssignMode] = useState<AssignMode>("required");

  const { data: classes = [], isLoading: classesLoading } = useTeacherClasses();
  const { data: papers = [], isLoading: papersLoading } = useTeacherPapers();
  const assignMutation = useAssign();

  // PAPER-R5: giao Ä‘á»/phiáº¿u THáº¬T â€” assignment_id = id Ä‘á»/phiáº¿u; resolver BE phá»¥c vá»¥
  // nhÆ° exercise nÃªn há»c sinh lÃ m Ä‘Æ°á»£c, tiáº¿n Ä‘á»™ + cháº¥m khá»›p (khÃ´ng cáº§n lÃ¡t 1 Ä‘á»•i gÃ¬).
  const worksheets = papers.filter((p) => p.kind === "worksheet");
  const paper = worksheets.find((p) => p.id === paperId);
  const selectedClass = classes.find((c) => c.id === classId);
  const className = selectedClass?.name ?? "";

  const close = () => {
    onOpenChange(false);
    setTimeout(() => {
      setStep(0);
      setPaperId(null);
      setDue(defaultDue());
      setNotify(true);
    }, 200);
  };

  const submit = () => {
    if (!classId || !paperId) return;
    assignMutation.mutate(
      {
        classId,
        input: {
          assignment_id: paperId,
          title_snapshot: paper?.title ?? "",
          due_at: due,
        },
      },
      {
        onSuccess: () => {
          toast.success("ÄÃ£ giao bÃ i cho lá»›p.");
          close();
        },
        onError: (e) => toast.error(e.message),
      },
    );
  };

  const canNext = !!classId && !!paperId && !!due;

  const missing = missingAssignFields({ classId, paperId, due });

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) close();
        else onOpenChange(true);
      }}
    >
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">
            ðŸ“¤ Giao phiáº¿u bÃ i táº­p
          </DialogTitle>
          <DialogDescription>
            2 bÆ°á»›c Ä‘á»ƒ giao phiáº¿u bÃ i táº­p Ä‘Ã£ táº¡o cho há»c sinh.
          </DialogDescription>
        </DialogHeader>

        <Stepper steps={STEPS} current={step} />

        {step === 0 && (
          <div className="space-y-5">
            <div className="space-y-2">
              <div className="text-sm text-muted-foreground flex items-center gap-2">
                <Users className="size-4 text-primary" /> Chá»n lá»›p nháº­n bÃ i
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                {classesLoading ? (
                  <div className="col-span-full text-sm text-muted-foreground">
                    Äang táº£i danh sÃ¡ch lá»›pâ€¦
                  </div>
                ) : classes.length === 0 ? (
                  <div className="col-span-full rounded-xl border-2 border-dashed p-4 text-center text-sm text-muted-foreground">
                    ChÆ°a cÃ³ lá»›p nÃ o.
                  </div>
                ) : (
                  classes.map((c) => (
                    <OptionCard
                      key={c.id}
                      active={classId === c.id}
                      onClick={() => setClassId(c.id)}
                    >
                      <div className="font-bold text-center">{c.name}</div>
                      {typeof c.roster_count === "number" && (
                        <div className="text-center text-[11px] text-muted-foreground">
                          {c.roster_count} HS
                        </div>
                      )}
                    </OptionCard>
                  ))
                )}
              </div>
              {selectedClass?.roster_count === 0 && (
                <p className="rounded-lg border-2 border-warning bg-warning/10 px-3 py-2 text-sm text-warning">
                  Lá»›p <b>{selectedClass.name}</b> chÆ°a cÃ³ há»c sinh nÃ o â€” giao
                  bÃ i bÃ¢y giá» thÃ¬ sáº½ khÃ´ng em nÃ o nháº­n Ä‘Æ°á»£c. CÃ´/tháº§y xáº¿p há»c
                  sinh vÃ o lá»›p trÆ°á»›c nhÃ©.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <div className="text-sm text-muted-foreground flex items-center gap-2">
                <ClipboardList className="size-4 text-primary" /> Chá»n phiáº¿u bÃ i
                táº­p
              </div>
              {papersLoading ? (
                <div className="rounded-xl border-2 border-dashed p-6 text-center text-sm text-muted-foreground">
                  Äang táº£i danh sÃ¡ch phiáº¿uâ€¦
                </div>
              ) : worksheets.length === 0 ? (
                <div className="rounded-xl border-2 border-dashed p-6 text-center text-sm text-muted-foreground">
                  ChÆ°a cÃ³ phiáº¿u nÃ o. VÃ o <strong>Táº¡o Ä‘á»/phiáº¿u</strong> Ä‘á»ƒ táº¡o
                  phiáº¿u trÆ°á»›c.
                </div>
              ) : (
                <div className="grid sm:grid-cols-2 gap-2 max-h-[35vh] overflow-y-auto pr-1">
                  {worksheets.map((p) => {
                    const active = paperId === p.id;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setPaperId(p.id)}
                        className={cn(
                          "text-left rounded-xl border-2 p-3 transition-all",
                          active
                            ? "border-primary bg-primary/10 ring-2 ring-primary/30"
                            : "border-border hover:border-primary/50",
                        )}
                      >
                        <div className="flex items-start gap-2">
                          <ClipboardList className="size-4 mt-0.5 shrink-0 text-info" />
                          <div className="flex-1">
                            <div className="font-bold text-sm">{p.title}</div>
                            <div className="text-xs text-muted-foreground mt-0.5">
                              Phiáº¿u bÃ i táº­p Â· {p.questions.length} cÃ¢u
                              {p.duration_minutes
                                ? ` Â· ~${p.duration_minutes}p`
                                : ""}
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <div className="text-sm text-muted-foreground flex items-center gap-2">
                <Calendar className="size-4 text-primary" /> Háº¡n ná»™p bÃ i
              </div>
              <Input
                type="date"
                value={due}
                onChange={(e) => setDue(e.target.value)}
                min={new Date().toISOString().slice(0, 10)}
                className="max-w-xs"
              />
            </div>
          </div>
        )}

        {step === 1 && paper && (
          <div className="space-y-3">
            <div className="rounded-lg bg-success/10 border-2 border-success/40 p-4">
              <div className="font-display font-bold text-success mb-2">
                âœ… Sáºµn sÃ ng giao bÃ i
              </div>
              <div className="text-sm space-y-1">
                <div>
                  ðŸ“‹ <strong>Phiáº¿u:</strong> {paper.title}
                </div>
                <div>
                  ðŸ‘¥ <strong>Lá»›p:</strong> {className}
                </div>
                <div>
                  ðŸ“… <strong>Háº¡n ná»™p:</strong>{" "}
                  {new Date(due).toLocaleDateString("vi-VN")}
                </div>
                <div>
                  ðŸ“ <strong>Sá»‘ cÃ¢u:</strong> {paper.questions.length} cÃ¢u
                  {paper.duration_minutes
                    ? ` (~${paper.duration_minutes} phÃºt)`
                    : ""}
                </div>
                <div>
                  ðŸ“Œ <strong>HÃ¬nh thá»©c:</strong> {ASSIGN_MODE_LABEL[assignMode]}
                </div>
              </div>
            </div>

            <AssignModeSelector value={assignMode} onChange={setAssignMode} />

            <button
              type="button"
              onClick={() => setNotify(!notify)}
              className={cn(
                "w-full flex items-center gap-3 rounded-xl border-2 p-3 text-left transition-all",
                notify
                  ? "border-primary bg-primary/10"
                  : "border-border bg-background",
              )}
            >
              <div
                className={cn(
                  "size-5 rounded border-2 grid place-items-center shrink-0",
                  notify ? "bg-primary border-primary" : "border-border",
                )}
              >
                {notify && (
                  <span className="text-primary-foreground text-xs font-bold">
                    âœ“
                  </span>
                )}
              </div>
              <div className="flex-1">
                <div className="font-medium text-sm flex items-center gap-1.5">
                  <Bell className="size-3.5" /> Gá»­i thÃ´ng bÃ¡o cho há»c sinh
                </div>
                <div className="text-xs text-muted-foreground">
                  Há»c sinh nháº­n thÃ´ng bÃ¡o trÃªn app + email (náº¿u Ä‘Ã£ liÃªn káº¿t).
                </div>
              </div>
            </button>

            <div className="text-xs text-muted-foreground">
              Há»‡ thá»‘ng sáº½ táº¡o báº£n ghi giao bÃ i cho lá»›p{" "}
              <strong>{className}</strong> vÃ  xuáº¥t hiá»‡n trong má»¥c "BÃ i Ä‘Ã£ giao".
            </div>
          </div>
        )}

        <div className="flex justify-between mt-4 pt-3 border-t">
          <Button
            variant="outline"
            onClick={() => (step === 0 ? close() : setStep(step - 1))}
          >
            <ChevronLeft className="size-4" /> {step === 0 ? "Huá»·" : "Quay láº¡i"}
          </Button>
          {step < STEPS.length - 1 ? (
            <div className="flex items-center gap-3">
              {missing.length > 0 && (
                <span className="text-sm text-muted-foreground" role="status">
                  CÃ²n thiáº¿u: {missing.join(', ')}.
                </span>
              )}
              <Button onClick={() => setStep(step + 1)} disabled={!canNext}>
                Tiáº¿p tá»¥c <ChevronRight className="size-4" />
              </Button>
            </div>
          ) : (
            <Button
              onClick={submit}
              disabled={assignMutation.isPending}
              className="bg-success hover:bg-success/90"
            >
              <Send className="size-4 mr-1" />{" "}
              {assignMutation.isPending ? "Äang giao..." : "Giao bÃ i"}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
