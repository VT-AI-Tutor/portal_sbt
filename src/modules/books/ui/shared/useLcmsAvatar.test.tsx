// @vitest-environment jsdom
/**
 * Hai cache dùng chung: hồ sơ /current và blob ảnh. Hai component cùng cần một
 * thứ thì chỉ được tải MỘT lượt — đây là lý do tồn tại của hai hook này.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const lcmsGetCurrentUser = vi.fn(async () => ({
  id: "42",
  avatarId: "345413326815101013",
}));
const lcmsFetchAvatarDataUrl = vi.fn(
  async (_id: string) => "data:image/png;base64,iVBORw0KGgo",
);

vi.mock("@/core/api/lcmsAdapter", () => ({
  lcmsGetCurrentUser: () => lcmsGetCurrentUser(),
  lcmsFetchAvatarDataUrl: (id: string) => lcmsFetchAvatarDataUrl(id),
}));

import { useLcmsAvatarUrl, useLcmsCurrentUser } from "./useLcmsAvatar";

afterEach(cleanup);
afterEach(() => vi.clearAllMocks());

function withClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
  );
}

function ProfileName({ label }: { label: string }) {
  const { data } = useLcmsCurrentUser(true);
  return <span data-testid={label}>{data?.avatarId ?? "…"}</span>;
}

function AvatarImg({ label }: { label: string }) {
  const url = useLcmsAvatarUrl("345413326815101013");
  return <span data-testid={label}>{url ?? "…"}</span>;
}

describe("useLcmsCurrentUser", () => {
  it("hai chỗ cùng cần hồ sơ thì chỉ gọi /current MỘT lần", async () => {
    withClient(
      <>
        <ProfileName label="header" />
        <ProfileName label="dialog" />
      </>,
    );
    await waitFor(() =>
      expect(screen.getByTestId("dialog").textContent).toBe(
        "345413326815101013",
      ),
    );
    expect(screen.getByTestId("header").textContent).toBe("345413326815101013");
    expect(lcmsGetCurrentUser).toHaveBeenCalledTimes(1);
  });
});

describe("useLcmsAvatarUrl", () => {
  it("hai chỗ cùng một id ảnh thì chỉ tải MỘT lượt", async () => {
    withClient(
      <>
        <AvatarImg label="header" />
        <AvatarImg label="dialog" />
      </>,
    );
    await waitFor(() =>
      expect(screen.getByTestId("dialog").textContent).toContain("data:image/"),
    );

    expect(lcmsFetchAvatarDataUrl).toHaveBeenCalledTimes(1);
    // Cùng một chuỗi data: URI cho cả hai — ảnh của một id là bất biến nên
    // không cần bản sao riêng, và cũng không có object URL nào phải thu hồi.
    expect(screen.getByTestId("header").textContent).toBe(
      screen.getByTestId("dialog").textContent,
    );
  });
});
