/**
 * Màn cấp Xã (Owner 22/08) — mỗi dòng một trường, bấm vào rơi thẳng vào báo cáo
 * 5 bảng của trường đó đã có sẵn.
 */
import { useParams } from "react-router-dom";
import { TerritoryPageFrame } from "./TerritoryPageFrame";
import { TerritoryReportTable } from "./TerritoryReportTable";
import { useTerritoryExport, useTerritoryReport } from "@/modules/manager/hooks/useTerritory";

export function ManagerWardPage() {
  const { id } = useParams<{ id: string }>();
  const report = useTerritoryReport("school", id);
  const name = report.data?.parent?.name ?? "Xã";
  const exporter = useTerritoryExport("school", id, "bao-cao-xa.xlsx");

  return (
    <TerritoryPageFrame
      title={name}
      subtitle="Chất lượng học tập theo từng trường"
      crumbs={[{ label: "Toàn quốc", to: "/manager/national" }, { label: name }]}
      isLoading={report.isLoading}
      error={report.error}
      exportBusy={exporter.busy}
      exportError={exporter.error}
      onExport={exporter.run}
    >
      <TerritoryReportTable
        rows={report.data?.rows ?? []}
        unitLabel="Trường"
        showSchoolCount={false}
        linkTo={(row) => `/manager/school/${row.org_unit_id}`}
      />
    </TerritoryPageFrame>
  );
}
