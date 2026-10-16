// @vitest-environment jsdom
/**
 * Hai màn chờ `isFetchedAfterMount` mới dựng runner, nên cache còn tươi thì
 * mount vẫn PHẢI gọi lại — bỏ `refetchOnMount: "always"` là treo màn xoay.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

const getCurrentArenaAttemptMock = vi.fn();
vi.mock("./arenaApi", async (importOriginal) => {
  const mod = await importOriginal<typeof import("./arenaApi")>();
  return { ...mod, getCurrentArenaAttempt: () => getCurrentArenaAttemptMock() };
});

const getPracticeSessionMock = vi.fn();
vi.mock("./practiceApi", async (importOriginal) => {
  const mod = await importOriginal<typeof import("./practiceApi")>();
  return { ...mod, getPracticeSession: () => getPracticeSessionMock() };
});

const { useCurrentArenaAttempt } = await import("./arenaHooks");
const { usePracticeSession } = await import("./hooks");

/** Cùng cấu hình mặc định với AppProviders — staleTime là mấu chốt của lỗi. */
function makeClient() {
  return new QueryClient({
    defaultOptions: { queries: { staleTime: 30_000, retry: false } },
  });
}

function wrapperFor(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  };
}

beforeEach(() => {
  getCurrentArenaAttemptMock.mockReset();
  getPracticeSessionMock.mockReset();
});

describe("nạp lại lúc mount dù cache còn tươi", () => {
  it("useCurrentArenaAttempt: vào lại phòng thi trong 30 giây vẫn gọi lại API", async () => {
    const client = makeClient();
    // Cache vừa được ghi xong — với staleTime 30s thì đây là dữ liệu "tươi".
    client.setQueryData(["arena", "attempt", "current"], {
      attempt_id: "a1",
    });
    getCurrentArenaAttemptMock.mockResolvedValue({ attempt_id: "a1" });

    const { result } = renderHook(() => useCurrentArenaAttempt(), {
      wrapper: wrapperFor(client),
    });

    await waitFor(() => expect(result.current.isFetchedAfterMount).toBe(true));
    expect(getCurrentArenaAttemptMock).toHaveBeenCalledTimes(1);
  });

  it("usePracticeSession: mở lại đúng phiên trong 30 giây vẫn gọi lại API", async () => {
    const client = makeClient();
    client.setQueryData(["practice", "session", "s1"], { id: "s1" });
    getPracticeSessionMock.mockResolvedValue({ id: "s1" });

    const { result } = renderHook(() => usePracticeSession("s1"), {
      wrapper: wrapperFor(client),
    });

    await waitFor(() => expect(result.current.isFetchedAfterMount).toBe(true));
    expect(getPracticeSessionMock).toHaveBeenCalledTimes(1);
  });
});
