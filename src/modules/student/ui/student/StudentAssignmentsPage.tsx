import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Calendar, CheckCircle2, ClipboardList, Loader2 } from "lucide-react";
import { Card } from "@/core/ui/card";
import { Button } from "@/core/ui/button";
import { cn } from "@/core/lib/utils";
import {
  getMyAssignments,
  type StudentAssignment,
} from "@/modules/student/api/assignmentsApi";
import { useMyAffiliations } from "@/modules/student/api/useAffiliations";

// Tráº¡ng thÃ¡i bÃ i giao (tá»« ClassAssignmentLink) â†’ nhÃ£n + mÃ u hiá»ƒn thá»‹.
const STATUS_META: Record<
  string,
  { label: string; className: string; done: boolean }
> = {
  assigned: {
    label: "ChÆ°a lÃ m",
    className: "bg-warning/15 text-warning border-warning",
    done: false,
  },
  in_progress: {
    label: "Äang lÃ m",
    className: "bg-info/15 text-info border-info",
    done: false,
  },
  submitted: {
    label: "ÄÃ£ ná»™p",
    className: "bg-success/15 text-success border-success",
    done: true,
  },
  completed: {
    label: "HoÃ n thÃ nh",
    className: "bg-success/15 text-success border-success",
    done: true,
  },
  graded: {
    label: "ÄÃ£ cháº¥m",
    className: "bg-success/15 text-success border-success",
    done: true,
  },
};

function statusMeta(status: string) {
  return (
    STATUS_META[status] ?? {
      label: status,
      className: "bg-muted text-muted-foreground border-border",
      done: false,
    }
  );
}

function formatDeadline(iso: string | null): string {
  if (!iso) return "KhÃ´ng Ä‘áº·t háº¡n";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

function AssignmentCard({ a }: { a: StudentAssignment }) {
  const meta = statusMeta(a.status);
  return (
    <Card className="p-5 border-2 hover:border-primary transition-all">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full bg-primary/15 text-primary">
          <ClipboardList className="size-3" /> BÃ i giao
        </span>
        <span
          className={cn(
            "text-xs font-bold px-2 py-1 rounded-full border",
            meta.className,
          )}
        >
          {meta.done && <CheckCircle2 className="size-3 inline mr-1" />}
          {meta.label}
        </span>
      </div>
      <div className="font-display font-bold mt-2">{a.title || "BÃ i giao"}</div>
      <div className="text-xs text-muted-foreground mt-1">{a.class_name}</div>
      <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Calendar className="size-3" /> Háº¡n: {formatDeadline(a.deadline)}
        </span>
      </div>
      <Link
        to={`/student/assignments/run/${a.assignment_id}`}
        className="block mt-4"
      >
        <Button className="btn-pop w-full rounded-full">
          {meta.done
            ? "Xem láº¡i"
            : a.status === "in_progress"
              ? "Tiáº¿p tá»¥c â†’"
              : "Báº¯t Ä‘áº§u â†’"}
        </Button>
      </Link>
    </Card>
  );
}

/**
 * DÃ¹ng liÃªn káº¿t TRÆ¯á»œNG Ä‘á»ƒ Ä‘oÃ¡n lÃ½ do, vÃ¬ danh sÃ¡ch Lá»šP cá»§a há»c sinh chÆ°a cÃ³
 * endpoint riÃªng (GET /api/v1/classes tráº£ má»i lá»›p, khÃ´ng lá»c theo ngÆ°á»i gá»i).
 */
function EmptyAssignments() {
  const { data: affiliations, isSuccess } = useMyAffiliations();

  // Pháº£i lÃ  isSuccess, khÃ´ng pháº£i !isLoading: truy váº¥n lá»—i hoáº·c Ä‘ang bá»‹ táº¯t
  // (chÆ°a cÃ³ token) cÅ©ng cho data rá»—ng, Ä‘oÃ¡n theo Ä‘Ã³ lÃ  máº¯ng oan em Ä‘Ã£ liÃªn káº¿t
  // trÆ°á»ng rá»“i. KhÃ´ng cháº¯c thÃ¬ rÆ¡i vá» lá»i nháº¯c trung tÃ­nh.
  const notLinked = isSuccess && affiliations.length === 0;
  const guestOnly =
    isSuccess &&
    affiliations.length > 0 &&
    affiliations.every((a) => a.affiliation === "guest");

  return (
    <Card className="p-8 text-center text-muted-foreground border-2 border-dashed space-y-2">
      <p className="font-medium text-foreground">ChÆ°a cÃ³ bÃ i giao nÃ o.</p>
      {notLinked ? (
        <p>
          Em chÆ°a liÃªn káº¿t vá»›i trÆ°á»ng nÃ o nÃªn chÆ°a vÃ o Ä‘Æ°á»£c lá»›p. VÃ o{" "}
          <Link to="/student/profile" className="text-primary hover:underline">
            Há»“ sÆ¡ â†’ TrÆ°á»ng cá»§a tÃ´i
          </Link>{" "}
          Ä‘á»ƒ chá»n trÆ°á»ng, rá»“i bÃ¡o giÃ¡o viÃªn xáº¿p em vÃ o lá»›p nhÃ©.
        </p>
      ) : guestOnly ? (
        <p>
          LiÃªn káº¿t trÆ°á»ng cá»§a em Ä‘ang lÃ  <b>KhÃ¡ch</b> â€” chá» nhÃ  trÆ°á»ng duyá»‡t
          thÃ nh <b>ChÃ­nh thá»©c</b> thÃ¬ má»›i Ä‘Æ°á»£c xáº¿p lá»›p vÃ  nháº­n bÃ i giao. Em bÃ¡o
          giÃ¡o viÃªn duyá»‡t giÃºp nhÃ©.
        </p>
      ) : (
        <p>
          Khi giÃ¡o viÃªn giao bÃ i trong lá»›p cá»§a em, bÃ i sáº½ hiá»‡n á»Ÿ Ä‘Ã¢y. Náº¿u cÃ¡c
          báº¡n cÃ¹ng lá»›p Ä‘Ã£ tháº¥y bÃ i mÃ  em chÆ°a tháº¥y, nhá» giÃ¡o viÃªn kiá»ƒm tra xem
          em Ä‘Ã£ cÃ³ tÃªn trong lá»›p chÆ°a nhÃ©.
        </p>
      )}
    </Card>
  );
}

export function StudentAssignmentsPage() {
  const [items, setItems] = useState<StudentAssignment[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getMyAssignments()
      .then((data) => {
        if (!cancelled) setItems(data);
      })
      .catch((e) => {
        if (!cancelled)
          setError(e instanceof Error ? e.message : "KhÃ´ng táº£i Ä‘Æ°á»£c bÃ i giao.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // NhÃ³m bÃ i chÆ°a xong lÃªn trÆ°á»›c.
  const sorted = useMemo(() => {
    if (items === null) return [];
    return [...items].sort(
      (a, b) =>
        Number(statusMeta(a.status).done) - Number(statusMeta(b.status).done),
    );
  }, [items]);

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-8">
      <h1 className="font-display text-3xl font-bold mb-1">
        ðŸ“ BÃ i táº­p cá»§a tÃ´i
      </h1>
      <p className="text-muted-foreground mb-5">
        BÃ i giÃ¡o viÃªn giao trong cÃ¡c lá»›p em Ä‘ang theo há»c
      </p>

      {loading ? (
        <Card className="p-8 flex items-center justify-center gap-2 border-2 text-muted-foreground">
          <Loader2 className="size-4 animate-spin text-primary" /> Äang táº£i bÃ i
          giaoâ€¦
        </Card>
      ) : error ? (
        <Card className="p-8 text-center border-2 border-dashed">
          <p className="text-destructive font-medium">{error}</p>
          <Button
            variant="outline"
            className="mt-3"
            onClick={() => window.location.reload()}
          >
            Thá»­ láº¡i
          </Button>
        </Card>
      ) : sorted.length === 0 ? (
        <EmptyAssignments />
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {sorted.map((a) => (
            <AssignmentCard key={a.id} a={a} />
          ))}
        </div>
      )}
    </div>
  );
}
