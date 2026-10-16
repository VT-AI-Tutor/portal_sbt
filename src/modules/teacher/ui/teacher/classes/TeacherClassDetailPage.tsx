import { useCallback, useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Card } from "@/core/ui/card";
import { Skeleton } from "@/core/ui/skeleton";
import { useAccessToken } from "@/core/auth/AuthContext";
import { teacherClassesApi } from "@/modules/teacher/api/teacherClassesApi";
import type { ClassDetail } from "@/modules/teacher/api/classTypes";
import { OverviewTab } from "./tabs/OverviewTab";
import { RosterTab } from "./tabs/RosterTab";
import { SessionsTab } from "./tabs/SessionsTab";
import { MaterialsTab } from "./tabs/MaterialsTab";
import { AssignmentsTab } from "./tabs/AssignmentsTab";

const TABS = [
  { key: "overview", label: "Tổng quan" },
  { key: "roster", label: "Học viên" },
  { key: "sessions", label: "Buổi học" },
  { key: "materials", label: "Học liệu" },
  { key: "assignments", label: "Bài giao" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export function TeacherClassDetailPage() {
  const { id } = useParams<{ id: string }>();
  const token = useAccessToken();
  const [cls, setCls] = useState<ClassDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabKey>("overview");

  const load = useCallback(() => {
    if (!id || !token) return;
    setLoading(true);
    teacherClassesApi
      .getClass(id, token)
      .then((c) => {
        setCls(c);
        setError(null);
      })
      .catch(() => setError("Không tải được lớp."))
      .finally(() => setLoading(false));
  }, [id, token]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-8 space-y-5">
      <Link
        to="/teacher/classes"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary"
      >
        <ArrowLeft className="size-4" /> Danh sách lớp
      </Link>

      {loading && <Skeleton className="h-24 rounded-xl" />}
      {error && (
        <Card className="p-5 border-2 text-center text-muted-foreground">
          Không tải được lớp: {error}
        </Card>
      )}

      {!loading && cls && id && token && (
        <>
          <div>
            <h1 className="font-display text-3xl font-bold">
              {cls.name}
            </h1>
            <p className="text-muted-foreground">
              Mã lớp: {cls.code}
              {cls.status ? ` · ${cls.status}` : ""}
            </p>
          </div>

          <div className="flex flex-wrap gap-2 border-b-2 border-border">
            {TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={`px-4 py-2 text-sm font-semibold -mb-0.5 border-b-2 transition-colors ${
                  tab === t.key
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {tab === "overview" && (
            <OverviewTab classId={id} token={token} cls={cls} reload={load} />
          )}
          {tab === "roster" && (
            <RosterTab classId={id} token={token} cls={cls} reload={load} />
          )}
          {tab === "sessions" && (
            <SessionsTab classId={id} token={token} cls={cls} reload={load} />
          )}
          {tab === "materials" && (
            <MaterialsTab classId={id} token={token} cls={cls} reload={load} />
          )}
          {tab === "assignments" && (
            <AssignmentsTab classId={id} token={token} cls={cls} reload={load} />
          )}
        </>
      )}
    </div>
  );
}
