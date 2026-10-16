// @vitest-environment jsdom
/**
 * SBT_1308 (đỏ, dòng 58): dữ liệu đã tải là của PHIÊN vừa đăng xuất, nhưng
 * react-query không xoá cache khi query bị `enabled: false` — trong gcTime,
 * người đăng nhập kế tiếp trên cùng máy vẫn đọc được bài đang làm dở của người
 * trước. AppProviders dọn cache khi `clearSession` phát SESSION_CLEARED_EVENT,
 * nên MỌI lối kết thúc phiên (9 nút Đăng xuất, refresh hỏng, 401) đều được phủ.
 */
import { afterEach, describe, expect, it } from "vitest";
import { render, cleanup, waitFor } from "@testing-library/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AppProviders } from "./AppProviders";
import { clearSession } from "@/core/auth/storage";

function Probe({ onClient }: { onClient: (c: unknown) => void }) {
  const client = useQueryClient();
  onClient(client);
  const { data } = useQuery({
    queryKey: ["bai-dang-lam"],
    queryFn: async () => "đáp án của học sinh A",
  });
  return <span data-testid="cached">{data ?? "∅"}</span>;
}

afterEach(cleanup);

describe("AppProviders — dọn cache khi phiên kết thúc", () => {
  it("clearSession() → cache react-query bị xoá sạch", async () => {
    let client: { getQueryData: (k: unknown[]) => unknown } | null = null;
    const { getByTestId } = render(
      <AppProviders>
        <Probe onClient={(c) => (client = c as typeof client)} />
      </AppProviders>,
    );

    await waitFor(() =>
      expect(getByTestId("cached").textContent).toBe("đáp án của học sinh A"),
    );

    clearSession();

    await waitFor(() =>
      expect(client!.getQueryData(["bai-dang-lam"])).toBeUndefined(),
    );
  });
});
