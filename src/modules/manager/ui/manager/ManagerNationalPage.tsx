/**
 * Màn cấp Bộ (Owner 22/08) — mỗi dòng một tỉnh. "Bộ" là gốc toàn quốc, không
 * phải một đơn vị trong cây, nên màn này chỉ mở được với phạm vi toàn cục; máy
 * chủ trả 403 chứ không trả bảng rỗng.
 */
import { TerritoryPageFrame } from "./TerritoryPageFrame";
import { TerritoryReportTable } from "./TerritoryReportTable";
import { useTerritoryExport, useTerritoryReport } from "@/modules/manager/hooks/useTerritory";

export function ManagerNationalPage() {
  const report = useTerritoryReport("province");
  const exporter = useTerritoryExport("province", null, "bao-cao-toan-quoc.xlsx");

  return (
    <TerritoryPageFrame
      title="Báo cáo toàn quốc"
      subtitle="Chất lượng học tập theo tỉnh và thành phố"
      crumbs={[{ label: "Toàn quốc" }]}
      isLoading={report.isLoading}
      error={report.error}
      exportBusy={exporter.busy}
      exportError={exporter.error}
      onExport={exporter.run}
    >
      <TerritoryReportTable
        rows={report.data?.rows ?? []}
        unitLabel="Tỉnh / Thành phố"
        linkTo={(row) => `/manager/province/${row.org_unit_id}`}
      />
    </TerritoryPageFrame>
  );
}
