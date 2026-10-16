// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MASTERY_LEGEND, masteryColor } from "./masteryColor";
import { TopicList } from "./TopicList";

afterEach(cleanup);

const topic = (code: string, label: string, attempted: number, correct: number) => ({
  content_code: code, label, attempted,
  percent: attempted > 0 ? Math.round((correct / attempted) * 1000) / 10 : 0,
});

describe("TopicList", () => {
  it("sắp xếp yếu nhất lên đầu, chưa đủ bài xuống cuối", () => {
    render(
      <TopicList
        topics={[topic("a", "Chủ đề A", 10, 9), topic("b", "Chủ đề B", 10, 3), topic("c", "Chủ đề C", 1, 1)]}
        onPractice={() => {}}
        pendingCode={null}
      />,
    );
    const names = screen.getAllByTestId("topic-name").map((e) => e.getAttribute("title"));
    expect(names).toEqual(["Chủ đề B", "Chủ đề A", "Chủ đề C"]);
  });
  it("tên chủ đề dài KHÔNG còn bị cắt bằng … trong DOM", () => {
    // Trước đây `shortenLabel` cắt ở 28 ký tự nên tên rụng sớm hơn hẳn chỗ cột
    // thật sự có. Nay chỉ CSS `truncate` cắt — theo bề ngang thật, và chỉ khi
    // tràn. DOM luôn giữ nguyên chữ để rê chuột/đọc màn hình lấy được đủ.
    const long = "Nhận biết cấu tạo và chức năng của tế bào thực vật";
    render(<TopicList topics={[topic("a", long, 10, 5)]} onPractice={() => {}} pendingCode={null} />);

    const name = screen.getByTestId("topic-name");
    expect(name.textContent).toBe(long);
    expect(name.textContent).not.toContain("…");
    expect(name.getAttribute("title")).toBe(long);
  });

  it("vẫn bỏ tiền tố đánh số của tên chương trình", () => {
    render(
      <TopicList topics={[topic("a", "1. Mở đầu về khoa học tự nhiên", 10, 5)]} onPractice={() => {}} pendingCode={null} />,
    );
    expect(screen.getByTestId("topic-name").textContent).toBe("Mở đầu về khoa học tự nhiên");
  });

  it("hàng 1–2 câu không có %, có việc cần làm", () => {
    render(<TopicList topics={[topic("c", "Chủ đề C", 2, 0)]} onPractice={() => {}} pendingCode={null} />);
    expect(screen.getByText("Còn 1 câu nữa để đánh giá")).toBeTruthy();
    expect(screen.queryByText(/%/)).toBeNull();
  });
  it("hàng 1-2 câu: quét TOÀN BỘ text + title của hàng, không đâu chứa ký tự %", () => {
    // Test mạnh hơn brief: brief chỉ check queryByText(/%/) trên toàn document
    // (một chuỗi cụ thể). Ở đây quét document.body.textContent (mọi node text
    // gộp lại, kể cả text không đứng riêng thành 1 node) VÀ mọi thuộc tính
    // title trong DOM — đảm bảo không có "%" lọt qua dù render theo cách nào.
    // MASTERY_LEGEND label cố tình không chứa "%" (xem masteryColor.ts) nên
    // việc quét toàn document vẫn có ý nghĩa (không bị chú giải làm nhiễu).
    expect(MASTERY_LEGEND.every((l) => !l.label.includes("%"))).toBe(true);
    const { container } = render(
      <TopicList topics={[topic("c", "Chủ đề C", 2, 0)]} onPractice={() => {}} pendingCode={null} />,
    );
    expect(container.textContent ?? "").not.toContain("%");
    const titledEls = container.querySelectorAll("[title]");
    titledEls.forEach((el) => {
      expect(el.getAttribute("title") ?? "").not.toContain("%");
    });
  });
  it("màu thanh nằm đúng trong chú giải (cùng nguồn masteryColor)", () => {
    render(<TopicList topics={[topic("b", "Chủ đề B", 10, 3)]} onPractice={() => {}} pendingCode={null} />);
    const bar = screen.getByTestId("topic-bar-b");
    const hex = masteryColor(30).hex;
    // jsdom (như trình duyệt thật) chuẩn hoá màu inline style thành rgb(...)
    // khi đọc lại attribute, nên so khớp chuỗi hex thô không đáng tin — dựng
    // một phần tử dò để chuẩn hoá hex về CÙNG định dạng rồi so sánh.
    const probe = document.createElement("div");
    probe.style.backgroundColor = hex;
    expect(bar.style.backgroundColor).toBe(probe.style.backgroundColor);
    expect(MASTERY_LEGEND.some((l) => l.hex === hex)).toBe(true);
  });
  it("mỗi hàng có nút Luyện dẫn đúng chủ đề", () => {
    const spy = vi.fn();
    render(<TopicList topics={[topic("b", "Chủ đề B", 10, 3)]} onPractice={spy} pendingCode={null} />);
    fireEvent.click(screen.getByRole("button", { name: /luyện/i }));
    expect(spy).toHaveBeenCalledWith("b");
  });
  it("mỗi hàng gọi đúng content_code của HÀNG ĐÓ, không phải biến vòng lặp cũ (đóng gói sai)", () => {
    const spy = vi.fn();
    render(
      <TopicList
        topics={[topic("a", "Chủ đề A", 10, 2), topic("b", "Chủ đề B", 10, 3), topic("c", "Chủ đề C", 10, 9)]}
        onPractice={spy}
        pendingCode={null}
      />,
    );
    const buttons = screen.getAllByRole("button", { name: /luyện/i });
    // sort: a(20%) < b(30%) < c(90%) -> thứ tự hàng render là a, b, c
    fireEvent.click(buttons[2]);
    expect(spy).toHaveBeenCalledWith("c");
    fireEvent.click(buttons[0]);
    expect(spy).toHaveBeenCalledWith("a");
  });
  it("chỉ hàng đang tạo (pendingCode) bị vô hiệu hoá nút, các hàng khác vẫn bấm được", () => {
    const spy = vi.fn();
    render(
      <TopicList
        topics={[topic("a", "Chủ đề A", 10, 2), topic("b", "Chủ đề B", 10, 3)]}
        onPractice={spy}
        pendingCode="a"
      />,
    );
    const buttons = screen.getAllByRole("button", { name: /luyện|đang tạo/i }) as HTMLButtonElement[];
    expect(buttons[0].disabled).toBe(true);
    expect(buttons[1].disabled).toBe(false);
    fireEvent.click(buttons[1]);
    expect(spy).toHaveBeenCalledWith("b");
  });
  it("rỗng -> lời mời, không panel trắng", () => {
    render(<TopicList topics={[]} onPractice={() => {}} pendingCode={null} />);
    expect(screen.getByText(/làm bài/i)).toBeTruthy();
  });
  it("không dùng biệt ngữ cấm (N/A, chưa có dữ liệu, không đủ mẫu)", () => {
    const { container } = render(
      <TopicList
        topics={[topic("a", "Chủ đề A", 0, 0), topic("b", "Chủ đề B", 2, 1)]}
        onPractice={() => {}}
        pendingCode={null}
      />,
    );
    const text = container.textContent ?? "";
    expect(text).not.toMatch(/N\/A/i);
    expect(text).not.toMatch(/chưa có dữ liệu/i);
    expect(text).not.toMatch(/không đủ mẫu/i);
  });
});
