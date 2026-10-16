// @vitest-environment jsdom
/**
 * Thẻ "Gói của tôi" là lối vào Premium DUY NHẤT sau khi mục menu bị bỏ, nên hai
 * thứ phải chắc: nút mở trang Premium luôn có, và khi truy vấn gói lỗi thì thẻ
 * im lặng chứ không mời người đang trả tiền "nâng cấp" lần nữa.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const useSubscriptionMock = vi.fn();
const usePlansMock = vi.fn();
const startTrialMutate = vi.fn();

vi.mock("@/modules/student/api/hooks", () => ({
  useSubscription: () => useSubscriptionMock(),
  usePlans: () => usePlansMock(),
  useStartTrial: () => ({ mutate: startTrialMutate, isPending: false }),
}));

const { PremiumSummaryCard } = await import("./PremiumSummaryCard");

const PLANS = {
  data: {
    currency: "VND",
    trial_days: 7,
    plans: [
      { code: "free", name: "Free", price_per_month: 0, features: [] },
      { code: "premium", name: "Premium", price_per_month: 49000, features: [] },
    ],
  },
};

function renderCard() {
  return render(
    <MemoryRouter>
      <PremiumSummaryCard />
    </MemoryRouter>,
  );
}

afterEach(() => {
  cleanup();
  useSubscriptionMock.mockReset();
  usePlansMock.mockReset();
  startTrialMutate.mockReset();
});

describe("PremiumSummaryCard", () => {
  it("gói Free: mời nâng cấp, nêu giá, nút trỏ đúng trang Premium", () => {
    useSubscriptionMock.mockReturnValue({
      data: { is_premium: false, expires_at: null, source: null, trial_eligible: false },
      isLoading: false,
    });
    usePlansMock.mockReturnValue(PLANS);
    renderCard();

    expect(screen.getByText(/Em đang dùng gói Free/)).toBeTruthy();
    expect(screen.getByText(/49\.000 VND\/tháng/)).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "Nâng cấp Premium" }).getAttribute("href"),
    ).toBe("/student/profile/premium");
  });

  it("đang Premium: nói rõ hạn dùng, KHÔNG mời nâng cấp nữa", () => {
    useSubscriptionMock.mockReturnValue({
      data: {
        is_premium: true,
        expires_at: "2026-12-31T00:00:00Z",
        source: "purchase",
        trial_eligible: false,
      },
      isLoading: false,
    });
    usePlansMock.mockReturnValue(PLANS);
    renderCard();

    expect(screen.getByText(/Em đang dùng Premium/)).toBeTruthy();
    expect(screen.getByText(/31\/12\/2026/)).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Nâng cấp Premium" })).toBeNull();
    expect(screen.getByRole("link", { name: "Xem gói" })).toBeTruthy();
  });

  it("còn suất dùng thử: hiện nút dùng thử, bấm là gọi kích hoạt", async () => {
    const { default: userEvent } = await import("@testing-library/user-event");
    useSubscriptionMock.mockReturnValue({
      data: { is_premium: false, expires_at: null, source: null, trial_eligible: true },
      isLoading: false,
    });
    usePlansMock.mockReturnValue(PLANS);
    renderCard();

    expect(screen.getByText(/Dùng thử 7 ngày miễn phí/)).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Dùng thử miễn phí" }));
    expect(startTrialMutate).toHaveBeenCalledTimes(1);
  });

  it("dùng thử đã hết suất thì không còn nút dùng thử", () => {
    useSubscriptionMock.mockReturnValue({
      data: { is_premium: false, expires_at: null, source: null, trial_eligible: false },
      isLoading: false,
    });
    usePlansMock.mockReturnValue(PLANS);
    renderCard();

    expect(screen.queryByRole("button", { name: "Dùng thử miễn phí" })).toBeNull();
  });

  it("truy vấn gói lỗi (không data) thì ẩn hẳn thẻ, không đoán là Free", () => {
    useSubscriptionMock.mockReturnValue({ data: undefined, isLoading: false });
    usePlansMock.mockReturnValue({ data: undefined });
    const { container } = renderCard();

    expect(container.textContent).toBe("");
  });
});
