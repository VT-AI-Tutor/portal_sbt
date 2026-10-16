// @vitest-environment jsdom
/**
 * I5 (review cuối) — `SlideViewer` cũ gắn phím mũi tên lên `window`, mà
 * `StudentLectureViewer` render MỘT bộ slide cho MỖI hoạt động (4 bộ trên
 * cùng một trang). Nhấn mũi tên lật đồng thời CẢ BỐN, và không né ô nhập
 * liệu (gõ trong ô tự luận, di con trỏ bằng mũi tên, cũng lật slide theo).
 *
 * Sửa: gắn sự kiện lên chính phần tử chứa (tabIndex + onKeyDown cục bộ) thay
 * vì `window` — bàn phím chỉ tác động khi bộ slide đó đang có tiêu điểm, và
 * bỏ qua sự kiện phát sinh từ input/textarea.
 */
import { afterEach, describe, expect, it } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { SlideViewer } from "./SlideViewer";
import type { LectureSlide } from "@/modules/teacher/api/teacherLectureApi";

const slidesA: LectureSlide[] = [
  { layout: "title", title: "Bộ A — trang 1" },
  { layout: "title", title: "Bộ A — trang 2" },
];
const slidesB: LectureSlide[] = [
  { layout: "title", title: "Bộ B — trang 1" },
  { layout: "title", title: "Bộ B — trang 2" },
];

afterEach(cleanup);

describe("SlideViewer — phạm vi bàn phím (I5)", () => {
  it("hai bộ slide cùng trên màn: tác động phím vào bộ thứ nhất KHÔNG đổi trang bộ thứ hai", async () => {
    const { userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup();

    render(
      <div>
        <div data-testid="viewer-a">
          <SlideViewer slides={slidesA} />
        </div>
        <div data-testid="viewer-b">
          <SlideViewer slides={slidesB} />
        </div>
      </div>,
    );

    expect(screen.getByText("Bộ A — trang 1")).toBeTruthy();
    expect(screen.getByText("Bộ B — trang 1")).toBeTruthy();

    // Đưa tiêu điểm vào bộ A rồi bấm mũi tên phải — chỉ bộ A được lật.
    const viewerA = screen.getByTestId("viewer-a").firstElementChild as HTMLElement;
    viewerA.focus();
    await user.keyboard("{ArrowRight}");

    expect(screen.getByText("Bộ A — trang 2")).toBeTruthy();
    expect(screen.getByText("Bộ B — trang 1")).toBeTruthy();
    expect(screen.queryByText("Bộ B — trang 2")).toBeNull();
  });

  it("gõ mũi tên trong ô nhập liệu bên trong bộ slide KHÔNG lật trang", async () => {
    const { userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup();

    function Wrapper() {
      return (
        <div>
          <SlideViewer slides={slidesA} />
          <input data-testid="essay-input" />
        </div>
      );
    }
    render(<Wrapper />);

    const input = screen.getByTestId("essay-input");
    input.focus();
    await user.keyboard("{ArrowRight}");

    // Sự kiện phát sinh từ input (ngoài cây SlideViewer) không lọt tới đây do
    // không cùng nhánh DOM — vẫn còn trang 1.
    expect(screen.getByText("Bộ A — trang 1")).toBeTruthy();
  });
});
