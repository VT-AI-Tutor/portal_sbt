// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { LectureSection } from "@/modules/teacher/api/teacherLectureApi";
import { LectureSectionReview } from "./LectureSectionReview";

const section: LectureSection = {
  key: "hinhthanh",
  title: "Hình thành kiến thức",
  objective: "Học sinh nắm được khái niệm phân số.",
  blocks: [
    { type: "text", content: "Khối một" },
    { type: "example", content: "Khối hai" },
  ],
  slides: [
    {
      layout: "bullets",
      title: "Slide một",
      bullets: ["Ý một", "Ý hai"],
      notes: "Ghi chú cho giáo viên",
    },
  ],
  question_ids: ["q1", "q2"],
  generated_at: "2026-08-20T00:00:00Z",
  edited_at: null,
};

afterEach(cleanup);

describe("LectureSectionReview", () => {
  it("hiện nội dung của các khối và slide", () => {
    render(
      <LectureSectionReview
        section={section}
        onRegenerate={vi.fn()}
        onSave={vi.fn()}
      />,
    );

    expect(screen.getByText("Hình thành kiến thức")).toBeTruthy();
    expect(screen.getByDisplayValue("Khối một")).toBeTruthy();
    expect(screen.getByDisplayValue("Khối hai")).toBeTruthy();
    expect(screen.getByDisplayValue("Slide một")).toBeTruthy();
  });

  it("bấm Sinh lại phần này gọi onRegenerate với đúng khoá hoạt động", async () => {
    const user = userEvent.setup();
    const onRegenerate = vi.fn();
    render(
      <LectureSectionReview
        section={section}
        onRegenerate={onRegenerate}
        onSave={vi.fn()}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: /Sinh lại phần này/ }),
    );

    expect(onRegenerate).toHaveBeenCalledWith("hinhthanh");
  });

  it("sửa textarea của một khối rồi bấm Lưu phần này gọi onSave với blocks mới", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(
      <LectureSectionReview
        section={section}
        onRegenerate={vi.fn()}
        onSave={onSave}
      />,
    );

    const textarea = screen.getByDisplayValue("Khối một");
    await user.clear(textarea);
    await user.type(textarea, "Khối một đã sửa");

    await user.click(screen.getByRole("button", { name: /Lưu phần này/ }));

    expect(onSave).toHaveBeenCalledWith("hinhthanh", {
      blocks: [
        { type: "text", content: "Khối một đã sửa" },
        { type: "example", content: "Khối hai" },
      ],
      slides: section.slides,
    });
  });

  it("thấy thông điệp lỗi tiếng Việt chung khi sectionErrors là chuỗi tiếng Anh", () => {
    render(
      <LectureSectionReview
        section={section}
        errorMessage="Failed to fetch"
        onRegenerate={vi.fn()}
        onSave={vi.fn()}
      />,
    );

    expect(
      screen.getByText("Không sinh được hoạt động này. Thầy cô thử lại nhé!"),
    ).toBeTruthy();
    expect(screen.queryByText("Failed to fetch")).toBeNull();
  });

  it("giữ nguyên thông điệp lỗi khi đã là tiếng Việt", () => {
    render(
      <LectureSectionReview
        section={section}
        errorMessage="Trợ lý AI đang tắt."
        onRegenerate={vi.fn()}
        onSave={vi.fn()}
      />,
    );

    expect(screen.getByText("Trợ lý AI đang tắt.")).toBeTruthy();
  });
});
