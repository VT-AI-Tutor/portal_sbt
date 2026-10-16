// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { ComponentRadar, wrapLabel } from "./ComponentRadar";

afterEach(cleanup);

const comp = (
  code: string,
  label: string,
  attempted: number,
  correct: number,
) => ({
  code,
  label,
  attempted,
  correct,
  percent: attempted > 0 ? Math.round((correct / attempted) * 1000) / 10 : 0,
  question_available: 10,
});

describe("ComponentRadar", () => {
  it("không có thành tố nào -> null (ẩn khối)", () => {
    const { container } = render(
      <ComponentRadar components={[]} targetPercent={75} />,
    );
    expect(container.innerHTML).toBe("");
  });

  it("0 thành tố có điểm -> chế độ ghost: chỉ khung, không tô, không %", () => {
    render(
      <ComponentRadar
        components={[
          comp("a", "Tư duy và lập luận toán học", 0, 0),
          comp("b", "Mô hình hoá toán học", 0, 0),
          comp("c", "Giải quyết vấn đề toán học", 0, 0),
          comp("d", "Giao tiếp toán học", 0, 0),
        ]}
        targetPercent={75}
      />,
    );
    const svg = screen.getByTestId("radar-svg");
    expect(svg).toBeTruthy();
    expect(svg.querySelectorAll('[data-testid^="radar-fill-"]').length).toBe(0);
    expect(screen.getAllByTestId("radar-hollow-dot").length).toBe(4);
    expect(svg.textContent).not.toContain("%");
    expect(screen.getByText(/Làm bài để tô kín biểu đồ này nhé!/)).toBeTruthy();
  });

  // Điều kiện là SỐ TRỤC, không phải số trục có điểm: mới luyện 1–2 năng lực vẫn
  // phải thấy radar (trước đây rơi về thanh ngang, trong khi 0 điểm lại vẽ ghost).
  it("chỉ 2 trục có điểm nhưng đủ 3 trục -> VẪN vẽ radar", () => {
    render(
      <ComponentRadar
        components={[
          comp("a", "Tư duy và lập luận toán học", 5, 4),
          comp("b", "Mô hình hoá toán học", 4, 2),
          comp("c", "Giao tiếp toán học", 0, 0),
        ]}
        targetPercent={75}
      />,
    );
    expect(screen.getByTestId("radar-svg")).toBeTruthy();
    // Trục chưa luyện vẫn là một trục hợp lệ — chấm rỗng, không tô.
    expect(screen.getAllByTestId("radar-hollow-dot").length).toBe(1);
  });

  it("dưới 3 TRỤC -> không dựng được đa giác, rơi về thanh ngang", () => {
    render(
      <ComponentRadar
        components={[
          comp("a", "Tư duy và lập luận toán học", 5, 4),
          comp("b", "Mô hình hoá toán học", 4, 2),
        ]}
        targetPercent={75}
      />,
    );
    expect(screen.queryByTestId("radar-svg")).toBeNull();
    expect(screen.getAllByTestId("component-bar-row").length).toBe(2);
  });

  it("đủ 3 trục có điểm -> radar; trục chưa luyện có chấm rỗng + nhãn Chưa luyện, vùng tô ngắt", () => {
    render(
      <ComponentRadar
        components={[
          comp("a", "Tư duy và lập luận toán học", 8, 6), // index 0
          comp("b", "Mô hình hoá toán học", 8, 4), // index 1
          comp("c", "Giải quyết vấn đề toán học", 8, 7), // index 2
          comp("d", "Giao tiếp toán học", 0, 0), // index 3 — chưa luyện
        ]}
        targetPercent={75}
      />,
    );
    expect(screen.getByTestId("radar-svg")).toBeTruthy();
    expect(screen.getAllByTestId("radar-hollow-dot").length).toBe(1);
    expect(screen.getByText("Chưa luyện")).toBeTruthy();
    // vùng tô CHỈ có 1 fan duy nhất, đi qua đúng 3 trục có điểm (0,1,2) — KHÔNG
    // phải polygon kín nối cả 4 trục. Nếu thuật toán bị revert về "luôn 1 run
    // gồm mọi trục" thì cả hai khẳng định dưới đây đều fail: sẽ có data-axes
    // "0,1,2,3" thay vì "0,1,2", và số đỉnh (đếm " L ") sẽ là 4 thay vì 3.
    expect(screen.queryAllByTestId(/^radar-fill-/).length).toBe(1);
    const fill = screen.getByTestId("radar-fill-0");
    expect(fill.getAttribute("data-axes")).toBe("0,1,2");
    const vertexCount = (fill.getAttribute("d")?.match(/ L /g) ?? []).length;
    expect(vertexCount).toBe(3);
    expect(fill.getAttribute("d")).toContain("Z");
  });

  it("5 trục, CHỈ trục giữa (index 2) chưa luyện -> 1 fan duy nhất VẮT QUA ranh giới 12 giờ (3→4→0→1)", () => {
    render(
      <ComponentRadar
        components={[
          comp("a", "Tư duy và lập luận toán học", 8, 6), // index 0 — có điểm
          comp("b", "Mô hình hoá toán học", 8, 4), // index 1 — có điểm
          comp("c", "Giao tiếp toán học", 0, 0), // index 2 — chưa luyện (khoảng hở)
          comp("d", "Giải quyết vấn đề toán học", 8, 7), // index 3 — có điểm
          comp("e", "Sử dụng công cụ, phương tiện học toán", 8, 5), // index 4 — có điểm
        ]}
        targetPercent={75}
      />,
    );
    // Chỉ 1 trục chưa luyện -> đúng 1 khoảng hở -> đúng 1 fan, nhưng fan đó
    // phải nối 4 trục còn lại theo thứ tự hình học đi vòng quanh tâm bắt đầu
    // NGAY SAU trục hở (3, 4, rồi vắt qua chỉ số 0 để tới 0, 1) — không phải
    // theo thứ tự chỉ số mảng (0,1,3,4).
    expect(screen.queryAllByTestId(/^radar-fill-/).length).toBe(1);
    const fill = screen.getByTestId("radar-fill-0");
    expect(fill.getAttribute("data-axes")).toBe("3,4,0,1");
    const vertexCount = (fill.getAttribute("d")?.match(/ L /g) ?? []).length;
    expect(vertexCount).toBe(4);
    expect(screen.getAllByTestId("radar-hollow-dot").length).toBe(1);
  });

  it("5 trục, index 0 VÀ index 2 chưa luyện -> HAI fan tách biệt, không gộp lẫn nhau", () => {
    render(
      <ComponentRadar
        components={[
          comp("a", "Tư duy và lập luận toán học", 0, 0), // index 0 — chưa luyện
          comp("b", "Mô hình hoá toán học", 8, 6), // index 1 — có điểm, đứng một mình
          comp("c", "Giao tiếp toán học", 0, 0), // index 2 — chưa luyện
          comp("d", "Giải quyết vấn đề toán học", 8, 7), // index 3 — có điểm
          comp("e", "Sử dụng công cụ, phương tiện học toán", 8, 5), // index 4 — có điểm
        ]}
        targetPercent={75}
      />,
    );
    // Cụm [1] chỉ có 1 trục -> không đủ 2 điểm để vẽ fan (không polygon), còn
    // cụm [3,4] có 2 trục liền kề -> vẽ đúng 1 fan. Tổng cộng CHỈ 1 path được
    // render, nhưng phải tách biệt hẳn khỏi trục 0/1/2 — nếu thuật toán gộp
    // nhầm mọi trục có điểm thành một run duy nhất, data-axes sẽ là
    // "1,3,4" hoặc "0,1,2,3,4" thay vì đúng "3,4".
    const fills = screen.queryAllByTestId(/^radar-fill-/);
    expect(fills.length).toBe(1);
    expect(fills[0].getAttribute("data-axes")).toBe("3,4");
    expect(screen.getAllByTestId("radar-hollow-dot").length).toBe(2);
  });

  it("chưa đo / 0 điểm thật không vẽ giống nhau: thành tố 0% có điểm vẫn là trục dữ liệu", () => {
    render(
      <ComponentRadar
        components={[
          comp("a", "Tư duy và lập luận toán học", 8, 0), // 0% THẬT
          comp("b", "Mô hình hoá toán học", 8, 6),
          comp("c", "Giải quyết vấn đề toán học", 8, 7),
        ]}
        targetPercent={75}
      />,
    );
    expect(screen.queryAllByTestId("radar-hollow-dot").length).toBe(0);
  });

  // Bỏ dòng chú thích cách đọc (Owner 2026-08-08) — biểu đồ tự nói, giữ thẻ gọn.
  // Vòng mục tiêu nét đứt vẫn vẽ theo targetPercent, chỉ không chú thích bằng chữ.
  it("không còn dòng chú thích cách đọc dưới biểu đồ", () => {
    render(
      <ComponentRadar
        components={[
          comp("a", "Tư duy và lập luận toán học", 8, 6),
          comp("b", "Mô hình hoá toán học", 8, 4),
          comp("c", "Giải quyết vấn đề toán học", 8, 7),
        ]}
        targetPercent={75}
      />,
    );
    expect(screen.queryByText(/mục tiêu 75%/)).toBeNull();
    expect(screen.queryByText(/Vùng tô = kết quả/)).toBeNull();
    expect(screen.getByTestId("radar-svg")).toBeTruthy();
  });
});

describe("ComponentRadar — nhãn trục hiện ĐẦY ĐỦ tên", () => {
  const LONG = "Tìm hiểu tự nhiên, tìm hiểu xã hội";

  it("tên dài được ngắt dòng, KHÔNG cắt chữ và không có dấu …", () => {
    render(
      <ComponentRadar
        components={[
          comp("a", "Nhận thức khoa học", 30, 20),
          comp("b", LONG, 20, 10),
          comp("c", "Vận dụng kiến thức, kĩ năng đã học", 20, 10),
        ]}
        targetPercent={75}
      />,
    );

    const svg = screen.getByTestId("radar-svg");
    // Ghép mọi tspan của một nhãn phải ra ĐÚNG tên gốc, không rơi chữ nào.
    const texts = [...svg.querySelectorAll("text")].map((t) =>
      [...t.querySelectorAll("tspan")].map((s) => s.textContent).join(" "),
    );
    expect(texts.some((t) => t === LONG)).toBe(true);
    expect(svg.textContent).not.toContain("…");
  });

  it("thành tố có tên trong dict rút gọn cũng hiện nguyên tên chương trình", () => {
    render(
      <ComponentRadar
        components={[
          comp("a", "Sử dụng công cụ và phương tiện học toán", 30, 20),
          comp("b", "Tư duy và lập luận toán học", 20, 10),
          comp("c", "Mô hình hoá toán học", 20, 10),
        ]}
        targetPercent={75}
      />,
    );

    const svg = screen.getByTestId("radar-svg");
    const texts = [...svg.querySelectorAll("text")].map((t) =>
      [...t.querySelectorAll("tspan")].map((s) => s.textContent).join(" "),
    );
    // Trước đây dict đổi thành "Công cụ & phương tiện"; giờ phải là tên gốc.
    expect(texts).toContain("Sử dụng công cụ và phương tiện học toán");
    expect(svg.textContent).not.toContain("Công cụ & phương tiện");
  });

  it("khung tự giãn theo nhãn: tên dài -> viewBox rộng/cao hơn tên ngắn", () => {
    const short = [comp("a", "Nghe", 10, 5), comp("b", "Nói", 10, 5), comp("c", "Đọc", 10, 5)];
    const long = [
      comp("a", "Tìm hiểu tự nhiên, tìm hiểu xã hội", 10, 5),
      comp("b", "Vận dụng kiến thức, kĩ năng đã học", 10, 5),
      comp("c", "Sử dụng công cụ và phương tiện học toán", 10, 5),
    ];
    const { unmount } = render(<ComponentRadar components={short} targetPercent={75} />);
    const boxShort = screen.getByTestId("radar-svg").getAttribute("viewBox")!;
    unmount();
    render(<ComponentRadar components={long} targetPercent={75} />);
    const boxLong = screen.getByTestId("radar-svg").getAttribute("viewBox")!;

    const [, , wShort, hShort] = boxShort.split(" ").map(Number);
    const [, , wLong, hLong] = boxLong.split(" ").map(Number);
    expect(wLong).toBeGreaterThan(wShort);
    expect(hLong).toBeGreaterThanOrEqual(hShort);
  });

  it("wrapLabel ngắt theo từ và giữ trọn mọi chữ", () => {
    expect(wrapLabel("Tìm hiểu tự nhiên, tìm hiểu xã hội").join(" ")).toBe(
      "Tìm hiểu tự nhiên, tìm hiểu xã hội",
    );
    expect(wrapLabel("Nghe")).toEqual(["Nghe"]);
    // Từ đơn dài hơn ngưỡng vẫn đứng trọn một dòng, không bị chặt đôi.
    expect(wrapLabel("Chuyenmotutrongratdaikhongthengat")).toEqual([
      "Chuyenmotutrongratdaikhongthengat",
    ]);
  });
});
