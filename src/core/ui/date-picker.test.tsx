// @vitest-environment jsdom
/**
 * DatePicker (shared): hiển thị dd/MM/yyyy, chọn ngày trả về yyyy-MM-dd,
 * placeholder khi rỗng/hỏng, và mốc "hôm nay" theo múi giờ UTC+7.
 */
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { format } from "date-fns";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DatePicker, todayInTimeZone } from "./date-picker";

afterEach(cleanup);

describe("DatePicker", () => {
  it("hiển thị giá trị đã chọn theo dd/MM/yyyy", () => {
    render(<DatePicker value="2010-05-02" onChange={() => {}} />);
    expect(screen.getByRole("button").textContent).toContain("02/05/2010");
  });

  it("hiển thị placeholder khi chưa có giá trị", () => {
    render(
      <DatePicker value="" onChange={() => {}} placeholder="Chọn ngày sinh" />,
    );
    expect(screen.getByRole("button").textContent).toContain("Chọn ngày sinh");
  });

  it("giá trị hỏng không làm sập, coi như chưa chọn", () => {
    render(
      <DatePicker
        value="not-a-date"
        onChange={() => {}}
        placeholder="Chọn ngày sinh"
      />,
    );
    expect(screen.getByRole("button").textContent).toContain("Chọn ngày sinh");
  });

  it("chọn ngày trả về chuỗi yyyy-MM-dd", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<DatePicker value="2010-05-02" onChange={onChange} />);

    await user.click(screen.getByRole("button"));
    // Chọn theo số ngày (độc lập locale), lịch mặc định mở tháng 5/2010.
    const day = await waitFor(() => screen.getByText("15"));
    await user.click(day);

    expect(onChange).toHaveBeenCalledWith("2010-05-15");
  });
});

describe("todayInTimeZone", () => {
  it("áp đúng offset UTC+7 khi qua ranh giới ngày", () => {
    // 18:00Z ngày 13: UTC vẫn 13/08, còn Hà Nội (+7) đã sang 14/08 lúc 01:00.
    const instant = new Date("2026-08-13T18:00:00Z");
    expect(
      format(todayInTimeZone("Asia/Ho_Chi_Minh", instant), "yyyy-MM-dd"),
    ).toBe("2026-08-14");
    expect(format(todayInTimeZone("UTC", instant), "yyyy-MM-dd")).toBe(
      "2026-08-13",
    );
  });
});
