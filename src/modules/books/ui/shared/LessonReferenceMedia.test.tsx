// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { LessonReferenceMedia } from "./LessonReferenceMedia";
import type { LessonExtraMedia } from "@/modules/catalog/api/types";

const video: LessonExtraMedia = {
  code: "Trang 15.1 Bài 19 chữ ng",
  title: "Trang 15.1 Bài 19 chữ ng",
  url: "https://cdn.example.vn/lcms/abc.mp4",
  type: "video",
};

afterEach(cleanup);

describe("LessonReferenceMedia", () => {
  it("mặc định hiện tên file kèm nhãn loại", () => {
    render(<LessonReferenceMedia items={[video]} />);
    expect(screen.getByText("Trang 15.1 Bài 19 chữ ng")).toBeTruthy();
    expect(screen.getByText("Video")).toBeTruthy();
  });

  it("hideItemTitle: giấu tên file, vẫn giữ nhãn loại và chính media", () => {
    const { container } = render(
      <LessonReferenceMedia items={[video]} hideItemTitle />,
    );
    expect(screen.queryByText("Trang 15.1 Bài 19 chữ ng")).toBeNull();
    expect(screen.getByText("Video")).toBeTruthy();
    expect(container.querySelector("video")).toBeTruthy();
  });
});
