// @vitest-environment jsdom
/**
 * Màn trống chỉ được kết luận "chưa liên kết trường" khi truy vấn liên kết
 * THÀNH CÔNG và rỗng. Lỗi mạng hay chưa có token cũng cho data rỗng — kết luận
 * theo đó là mắng oan em đã liên kết trường rồi.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

vi.mock("@/modules/student/api/assignmentsApi", () => ({
  getMyAssignments: () => Promise.resolve([]),
}));

const useMyAffiliationsMock = vi.fn();
vi.mock("@/modules/student/api/useAffiliations", () => ({
  useMyAffiliations: () => useMyAffiliationsMock(),
}));

const { StudentAssignmentsPage } = await import("./StudentAssignmentsPage");

function renderPage() {
  return render(
    <MemoryRouter>
      <StudentAssignmentsPage />
    </MemoryRouter>,
  );
}

afterEach(() => {
  cleanup();
  useMyAffiliationsMock.mockReset();
});

describe("StudentAssignmentsPage — màn trống", () => {
  it("liên kết tải lỗi thì dùng lời nhắc trung tính, không nói chưa liên kết trường", async () => {
    // Đúng hình dạng react-query trả về khi truy vấn lỗi: hết pending, không data.
    useMyAffiliationsMock.mockReturnValue({
      data: undefined,
      isSuccess: false,
      isLoading: false,
    });
    renderPage();

    await waitFor(() =>
      expect(screen.getByText(/Chưa có bài giao nào/)).toBeTruthy(),
    );
    expect(screen.queryByText(/chưa liên kết với trường nào/i)).toBeNull();
    expect(screen.getByText(/có tên trong lớp chưa/i)).toBeTruthy();
  });

  it("tải xong mà không có liên kết nào thì chỉ đường sang Hồ sơ", async () => {
    useMyAffiliationsMock.mockReturnValue({ data: [], isSuccess: true });
    renderPage();

    await waitFor(() =>
      expect(screen.getByText(/chưa liên kết với trường nào/i)).toBeTruthy(),
    );
  });

  it("liên kết còn là Khách thì nhắc chờ nhà trường duyệt", async () => {
    useMyAffiliationsMock.mockReturnValue({
      data: [{ affiliation: "guest" }],
      isSuccess: true,
    });
    renderPage();

    await waitFor(() =>
      expect(screen.getByText(/chờ nhà trường duyệt/i)).toBeTruthy(),
    );
  });
});
