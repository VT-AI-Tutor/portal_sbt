// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { LessonTitleText } from "./LessonTitleText";

afterEach(cleanup);

describe("LessonTitleText", () => {
  it("in nghiêng riêng tên tác phẩm Ánh trăng", () => {
    const { container } = render(
      <div>
        <LessonTitleText title="Bét-tô-ven và bản xô-nát Ánh trăng" />
      </div>,
    );

    expect(screen.getByText("Ánh trăng").tagName).toBe("EM");
    expect(container.textContent).toBe("Bét-tô-ven và bản xô-nát Ánh trăng");
  });

  it("giữ nguyên tiêu đề không có cụm cần định dạng", () => {
    const { container } = render(
      <div>
        <LessonTitleText title="Vẽ màu" />
      </div>,
    );

    expect(container.querySelector("em")).toBeNull();
    expect(container.textContent).toBe("Vẽ màu");
  });
});

describe("LessonTitleText — tiêu đề mang thẻ từ studio", () => {
  it("vẽ chữ nghiêng thật, không hiện nguyên thẻ", () => {
    const { container } = render(
      <div>
        <LessonTitleText title="Bài 5: <em>Bàn tay cô giáo</em>" />
      </div>,
    );

    expect(container.querySelector("em")?.textContent).toBe("Bàn tay cô giáo");
    expect(container.textContent).toBe("Bài 5: Bàn tay cô giáo");
  });

  it("vẫn nhận cả chữ đậm", () => {
    const { container } = render(
      <div>
        <LessonTitleText title="<strong>Ôn tập</strong> cuối học kì 1" />
      </div>,
    );

    expect(container.querySelector("strong")?.textContent).toBe("Ôn tập");
    expect(container.textContent).toBe("Ôn tập cuối học kì 1");
  });

  it("cầu tạm vẫn chạy cho nội dung chưa có thẻ", () => {
    const { container } = render(
      <div>
        <LessonTitleText title="Bét-tô-ven và bản xô-nát Ánh trăng" />
      </div>,
    );

    expect(container.querySelector("em")?.textContent).toBe("Ánh trăng");
  });
});

/**
 * Tên CHỦ ĐỀ cũng mang thẻ được, không riêng tên bài.
 *
 * Bản đầu chỉ nghĩ tới tên bài, nên tiêu đề chủ đề trên thẻ mục lục hiện nguyên
 * `<em>` khi biên tập in nghiêng nó — chỉ lộ ra khi chạy thử với dữ liệu thật.
 */
describe("LessonTitleText — dùng cho cả tên chủ đề", () => {
  it("vẽ nghiêng trong tiêu đề chủ đề", () => {
    const { container } = render(
      <div>
        <LessonTitleText title="Chủ đề 1: Mái trường mến <em>yêu</em>" />
      </div>,
    );

    expect(container.querySelector("em")?.textContent).toBe("yêu");
    expect(container.textContent).toBe("Chủ đề 1: Mái trường mến yêu");
  });

  it("vẽ được khi nằm giữa một câu", () => {
    const { container } = render(
      <p>
        Bắt đầu với Bài 1 — <LessonTitleText title="Bài 5: <em>Bàn tay cô giáo</em>" />, hoặc xem tổng quan.
      </p>,
    );

    expect(container.querySelector("em")?.textContent).toBe("Bàn tay cô giáo");
    expect(container.textContent).toContain("Bắt đầu với Bài 1 — Bài 5: Bàn tay cô giáo, hoặc");
  });
});
