// @vitest-environment jsdom
// Ba màn báo cáo địa bàn dùng CHUNG một bảng — kiểm thử khoá hai thứ dễ hỏng
// nhất: dòng "chưa gắn xã" không được bấm xuống cấp dưới, và mỗi màn phải hỏi
// đúng cấp của nó.
import { cleanup, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TerritoryReport, TerritoryRow } from "@/modules/manager/api/territoryApi";

const { reportHook, exportHook, scopeHook } = vi.hoisted(() => ({
  reportHook: vi.fn(),
  exportHook: vi.fn(),
  scopeHook: vi.fn(),
}));

vi.mock("@/modules/manager/hooks/useTerritory", () => ({
  useTerritoryReport: reportHook,
  useTerritoryExport: exportHook,
  useTerritoryScope: scopeHook,
}));

import { ManagerNationalPage } from "./ManagerNationalPage";
import { ManagerProvincePage } from "./ManagerProvincePage";
import { ManagerWardPage } from "./ManagerWardPage";

function row(over: Partial<TerritoryRow> = {}): TerritoryRow {
  return {
    org_unit_id: "u1", code: "C1", name: "Tỉnh Một",
    schools: 3, classes: 12, students: 400, active_30d: 100,
    active_rate: 25, sessions_30d: 900, correct_rate: 62,
    ...over,
  };
}

function report(over: Partial<TerritoryReport> = {}): TerritoryReport {
  return { level: "province", parent: null, rows: [row()], ...over };
}

beforeEach(() => {
  reportHook.mockReturnValue({ data: report(), isLoading: false, error: null });
  exportHook.mockReturnValue({ busy: false, error: null, run: vi.fn() });
  scopeHook.mockReturnValue({ data: { global: true, units: [] }, isLoading: false });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("báo cáo địa bàn", () => {
  it("màn cấp Bộ hỏi cấp tỉnh và bày đủ bảy cột số", () => {
    render(
      <MemoryRouter>
        <ManagerNationalPage />
      </MemoryRouter>,
    );

    expect(reportHook).toHaveBeenLastCalledWith("province");
    expect(screen.getAllByRole("columnheader")).toHaveLength(8);
    const line = screen.getByText("Tỉnh Một").closest("tr")!;
    expect(within(line).getByText("3")).toBeTruthy();      // số trường
    expect(within(line).getByText("12")).toBeTruthy();     // số lớp
    expect(within(line).getByText("400")).toBeTruthy();    // học sinh
    expect(within(line).getByText("25%")).toBeTruthy();    // học đều
    expect(within(line).getByText("62%")).toBeTruthy();    // tỷ lệ đúng
  });

  it("màn cấp Tỉnh hỏi cấp xã kèm mã đơn vị cha", () => {
    reportHook.mockReturnValue({
      data: report({ level: "ward", parent: { id: "p9", name: "Tỉnh Chín", type: "province" } }),
      isLoading: false, error: null,
    });
    render(
      <MemoryRouter initialEntries={["/manager/province/p9"]}>
        <Routes>
          <Route path="/manager/province/:id" element={<ManagerProvincePage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(reportHook).toHaveBeenLastCalledWith("ward", "p9");
    expect(screen.getByRole("heading", { name: "Tỉnh Chín" })).toBeTruthy();
  });

  it("màn cấp Xã hỏi cấp trường", () => {
    reportHook.mockReturnValue({
      data: report({ level: "school", parent: { id: "w4", name: "Xã Bốn", type: "ward" } }),
      isLoading: false, error: null,
    });
    render(
      <MemoryRouter initialEntries={["/manager/ward/w4"]}>
        <Routes>
          <Route path="/manager/ward/:id" element={<ManagerWardPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(reportHook).toHaveBeenLastCalledWith("school", "w4");
    // Mỗi dòng ĐÃ LÀ một trường — cột đếm "số trường" luôn bằng 1, phải tắt đi,
    // nếu không bảng có HAI cột cùng tên "Trường" đứng cạnh nhau.
    expect(screen.getAllByRole("columnheader", { name: "Trường" })).toHaveLength(1);
    expect(screen.getAllByRole("columnheader")).toHaveLength(7);
  });

  it("dòng chưa gắn xã KHÔNG bấm xuống được cấp dưới", () => {
    reportHook.mockReturnValue({
      data: report({
        rows: [row(), row({ org_unit_id: null, code: null, name: "Chưa gắn xã" })],
      }),
      isLoading: false, error: null,
    });
    render(
      <MemoryRouter>
        <ManagerNationalPage />
      </MemoryRouter>,
    );

    // Nó là ghi chú chất lượng dữ liệu, không phải địa bàn — có liên kết thì
    // bấm vào sẽ rơi vào đường dẫn /province/null.
    const unassigned = screen.getByText("Chưa gắn xã").closest("tr")!;
    expect(within(unassigned).queryByRole("link")).toBeNull();

    const real = screen.getByText("Tỉnh Một").closest("tr")!;
    expect(within(real).getByRole("link").getAttribute("href")).toBe("/manager/province/u1");
  });

  it("lỗi ngoài phạm vi hiện nguyên văn, không hiện bảng rỗng", () => {
    reportHook.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error("Tài khoản của bạn không có quyền xem báo cáo ở cấp này."),
    });
    render(
      <MemoryRouter>
        <ManagerNationalPage />
      </MemoryRouter>,
    );

    expect(screen.getByText(/không có quyền xem báo cáo/)).toBeTruthy();
    expect(screen.queryByText(/Chưa có tỉnh/)).toBeNull();
  });
});
