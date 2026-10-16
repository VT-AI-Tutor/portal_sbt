import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/core/ui/dialog";
import { Button } from "@/core/ui/button";
import {
  ChevronLeft,
  ChevronRight,
  Send,
  FileText,
  ClipboardList,
  Users,
  Clock,
} from "lucide-react";
import { toast } from "sonner";
import { Stepper, OptionCard, CLASSES } from "./PaperWizardShared";
import { useTeacherPapers } from "@/modules/teacher/hooks/useTeacherPaper";
import { cn } from "@/core/lib/utils";

const STEPS = ["Chá»n Ä‘á»", "Giao bÃ i"];
const DURATIONS = [15, 30, 45];

export function CreateTestWizard({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [step, setStep] = useState(0);
  const [className, setClassName] = useState("4A");
  const [paperId, setPaperId] = useState<string | null>(null);
  const [duration, setDuration] = useState(30);

  // Äá» THáº¬T cá»§a giÃ¡o viÃªn (trÆ°á»›c Ä‘Ã¢y lÃ  danh sÃ¡ch máº«u trong `mock-papers`).
  const { data: papers = [] } = useTeacherPapers();
  const paper = papers.find((p) => p.id === paperId);
  const close = () => {
    onOpenChange(false);
    setTimeout(() => {
      setStep(0);
      setPaperId(null);
    }, 200);
  };

  const submit = () => {
    toast.success(`ðŸ“‹ ÄÃ£ giao "${paper?.title}" cho lá»›p ${className}`, {
      description: `Thá»i gian lÃ m bÃ i: ${duration} phÃºt Â· ${paper?.questions.length ?? 0} cÃ¢u`,
    });
    close();
  };

  const canNext = (() => {
    if (step === 0) return !!className && !!paperId && !!duration;
    return true;
  })();

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
            âž• Táº¡o cuá»™c thi / kiá»ƒm tra
          </DialogTitle>
          <DialogDescription>
            2 bÆ°á»›c Ä‘á»ƒ giao bÃ i kiá»ƒm tra hoáº·c luyá»‡n thi cho lá»›p.
          </DialogDescription>
        </DialogHeader>

        <Stepper steps={STEPS} current={step} />

        {step === 0 && (
          <div className="space-y-5">
            {/* Lá»›p */}
            <div className="space-y-2">
              <div className="text-sm text-muted-foreground flex items-center gap-2">
                <Users className="size-4 text-primary" /> Chá»n lá»›p tham gia
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                {CLASSES.map((c) => (
                  <OptionCard
                    key={c}
                    active={className === c}
                    onClick={() => setClassName(c)}
                  >
                    <div className="font-bold text-center">{c}</div>
                  </OptionCard>
                ))}
              </div>
            </div>

            {/* BÃ i */}
            <div className="space-y-2">
              <div className="text-sm text-muted-foreground flex items-center gap-2">
                <FileText className="size-4 text-primary" /> Chá»n bÃ i Ä‘Ã£ táº¡o á»Ÿ
                má»¥c <strong>Táº¡o Ä‘á»/phiáº¿u</strong>
              </div>
              <div className="grid sm:grid-cols-2 gap-2 max-h-[35vh] overflow-y-auto pr-1">
                {papers.map((p) => {
                  const active = paperId === p.id;
                  const Icon = p.kind === "exam" ? FileText : ClipboardList;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        setPaperId(p.id);
                        const mins = p.duration_minutes ?? 0;
                        setDuration(mins <= 15 ? 15 : mins <= 30 ? 30 : 45);
                      }}
                      className={cn(
                        "text-left rounded-xl border-2 p-3 transition-all",
                        active
                          ? "border-primary bg-primary/10 ring-2 ring-primary/30"
                          : "border-border hover:border-primary/50",
                      )}
                    >
                      <div className="flex items-start gap-2">
                        <Icon
                          className={cn(
                            "size-4 mt-0.5 shrink-0",
                            p.kind === "exam" ? "text-primary" : "text-info",
                          )}
                        />
                        <div className="flex-1">
                          <div className="font-bold text-sm">{p.title}</div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {p.kind === "exam"
                              ? "Äá» kiá»ƒm tra"
                              : "Phiáº¿u bÃ i táº­p"}{" "}
                            Â· {p.questions.length} cÃ¢u{p.duration_minutes ? ` Â· ${p.duration_minutes}p` : ""}
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Thá»i gian */}
            <div className="space-y-2">
              <div className="text-sm text-muted-foreground flex items-center gap-2">
                <Clock className="size-4 text-primary" /> Thá»i gian lÃ m bÃ i
              </div>
              <div className="grid grid-cols-3 gap-3">
                {DURATIONS.map((d) => (
                  <OptionCard
                    key={d}
                    active={duration === d}
                    onClick={() => setDuration(d)}
                  >
                    <div className="font-display font-bold text-2xl text-center">
                      {d}p
                    </div>
                    <div className="text-xs text-muted-foreground text-center mt-0.5">
                      {d === 15
                        ? "Kiá»ƒm tra nhanh"
                        : d === 30
                          ? "Kiá»ƒm tra chuáº©n"
                          : "Luyá»‡n thi Ä‘áº§y Ä‘á»§"}
                    </div>
                  </OptionCard>
                ))}
              </div>
              {paper && paper.duration_minutes != null && paper.duration_minutes !== duration && (
                <div className="text-xs text-warning bg-warning/10 border border-warning/40 rounded-lg p-2">
                  âš ï¸ BÃ i gá»‘c thiáº¿t káº¿ cho {paper.duration_minutes} phÃºt â€” báº¡n Ä‘ang
                  Ä‘iá»u chá»‰nh sang {duration} phÃºt.
                </div>
              )}
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
                  ðŸ“‹ <strong>BÃ i:</strong> {paper.title}
                </div>
                <div>
                  ðŸ‘¥ <strong>Lá»›p:</strong> {className}
                </div>
                <div>
                  â±ï¸ <strong>Thá»i gian:</strong> {duration} phÃºt
                </div>
                <div>
                  ðŸ“ <strong>Sá»‘ cÃ¢u:</strong> {paper.questions.length}
                </div>
              </div>
            </div>
            <div className="text-xs text-muted-foreground">
              Há»‡ thá»‘ng sáº½ tá»± Ä‘á»™ng gá»­i thÃ´ng bÃ¡o Ä‘áº¿n táº¥t cáº£ há»c sinh trong lá»›p{" "}
              {className}.
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
            <Button onClick={() => setStep(step + 1)} disabled={!canNext}>
              Tiáº¿p tá»¥c <ChevronRight className="size-4" />
            </Button>
          ) : (
            <Button onClick={submit} className="bg-success hover:bg-success/90">
              <Send className="size-4 mr-1" /> Giao bÃ i
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
