import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/core/ui/card";
import { Button } from "@/core/ui/button";
import { useAccessToken } from "@/core/auth/AuthContext";
import { useMyAffiliations, useDeclareAffiliation, useLeaveAffiliation } from "@/modules/student/api/useAffiliations";
import { searchSchools, type SchoolOption } from "@/modules/student/api/schoolsApi";

function AffiliationBadge({ affiliation }: { affiliation: "guest" | "official" }) {
  return (
    <span
      className={`text-xs px-2 py-0.5 rounded-full font-bold ${
        affiliation === "official" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
      }`}
    >
      {affiliation === "official" ? "Chính thức" : "Khách"}
    </span>
  );
}

export function MySchoolSection() {
  const token = useAccessToken();
  const { data: affiliations = [] } = useMyAffiliations();
  const declare = useDeclareAffiliation();
  const leave = useLeaveAffiliation();

  const [q, setQ] = useState("");
  const { data: results = [] } = useQuery<SchoolOption[], Error>({
    queryKey: ["school-search", q],
    queryFn: () => searchSchools(q, token!),
    enabled: !!token && q.trim().length >= 2,
  });

  return (
    <Card className="p-6 border-2 space-y-4">
      <h2 className="font-display text-xl font-bold">🏫 Trường của tôi</h2>

      {affiliations.length === 0 ? (
        <p className="text-muted-foreground text-sm">Bạn chưa liên kết trường nào.</p>
      ) : (
        <ul className="space-y-2">
          {affiliations.map((a) => (
            <li key={a.membership_id} className="flex items-center gap-2">
              <span className="font-medium">{a.org_unit_name ?? "—"}</span>
              <AffiliationBadge affiliation={a.affiliation} />
              <Button variant="outline" size="sm" className="ml-auto rounded-full" onClick={() => leave.mutate(a.membership_id)}>
                Rời
              </Button>
            </li>
          ))}
        </ul>
      )}

      <div className="space-y-2">
        <input
          className="w-full rounded border px-3 py-2"
          placeholder="Tìm trường theo tên (ít nhất 2 ký tự)…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        {declare.error && <p className="text-sm text-destructive">{declare.error.message}</p>}
        {results.length > 0 && (
          <ul className="rounded border divide-y">
            {results.map((s) => (
              <li key={s.id} className="flex items-center gap-2 px-3 py-2">
                <div>
                  <div className="font-medium">{s.name}</div>
                  <div className="text-xs text-muted-foreground">{[s.ward_name, s.province_name].filter(Boolean).join(" · ")}</div>
                </div>
                <Button
                  size="sm"
                  className="ml-auto rounded-full"
                  disabled={declare.isPending}
                  onClick={() => declare.mutate(s.id, { onSuccess: () => setQ("") })}
                >
                  Chọn
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}
