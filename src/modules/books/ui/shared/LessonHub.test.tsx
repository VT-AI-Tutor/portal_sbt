// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { FileText, History, Library, PlayCircle, RotateCw } from "lucide-react";
import { LessonHub, type LessonHubItem } from "./LessonHub";

/**
 * Hub là menu đầu bài học (Owner 03/8): vào bài KHÔNG tự mở gì, user bấm mới
 * vào màn. Hub thuần trình bày nên test ở đây chốt hợp đồng hiển thị; việc dựng
 * danh sách mục theo cờ dữ liệu nằm ở BookLessonPage.
 */

function item(over: Partial<LessonHubItem> = {}): LessonHubItem {
  return {
    key: "exercise",
    label: "Làm bài tập",
    icon: PlayCircle,
    onSelect: vi.fn(),
    ...over,
  };
}

// Repo không bật globals của testing-library nên auto-cleanup không tự đăng ký;
// thiếu dòng này thì render của test trước còn trong DOM và getByText kêu
// "found multiple elements".
afterEach(cleanup);

describe("LessonHub", () => {
  it("hiện tên bài + mọi mục được truyền vào", () => {
    render(
      <LessonHub
        lessonTitle="Âm thanh kì diệu"
        isGuest={false}
        items={[
          item({ key: "pdf-book", label: "Vở bài tập", icon: FileText }),
          item({ key: "pdf-answer", label: "Đáp án", icon: FileText }),
          item({ key: "exercise", label: "Làm bài tập" }),
          item({ key: "history", label: "Lịch sử làm bài", icon: History }),
          item({ key: "reference", label: "Tham khảo", icon: Library }),
        ]}
      />,
    );

    expect(screen.getByText("Âm thanh kì diệu")).toBeTruthy();
    for (const label of [
      "Vở bài tập",
      "Đáp án",
      "Làm bài tập",
      "Lịch sử làm bài",
      "Tham khảo",
    ]) {
      expect(screen.getByText(label)).toBeTruthy();
    }
  });

  it("bấm một mục thì gọi đúng onSelect của mục đó", () => {
    const onPdf = vi.fn();
    const onExercise = vi.fn();
    render(
      <LessonHub
        lessonTitle="Bài 1"
        isGuest={false}
        items={[
          item({ key: "pdf-book", label: "Vở bài tập", onSelect: onPdf }),
          item({ key: "exercise", onSelect: onExercise }),
        ]}
      />,
    );

    screen.getByText("Làm bài tập").click();
    expect(onExercise).toHaveBeenCalledTimes(1);
    expect(onPdf).not.toHaveBeenCalled();
  });

  it("hiện dòng phụ (số câu / số câu đã làm) khi có description", () => {
    render(
      <LessonHub
        lessonTitle="Bài 1"
        isGuest={false}
        items={[
          item({
            key: "exercise-resume",
            label: "Tiếp tục làm bài",
            description: "Đã làm 5/13 câu",
            icon: RotateCw,
          }),
        ]}
      />,
    );
    expect(screen.getByText("Đã làm 5/13 câu")).toBeTruthy();
  });

  it("khách: hiện lời mời đăng nhập và bấm được", () => {
    const onLogin = vi.fn();
    render(
      <LessonHub
        lessonTitle="Bài 1"
        isGuest
        onLoginClick={onLogin}
        items={[item()]}
      />,
    );

    const cta = screen.getByText("Đăng nhập để lưu bài làm và xem lịch sử");
    expect(cta).toBeTruthy();
    cta.click();
    expect(onLogin).toHaveBeenCalledTimes(1);
  });

  it("đã đăng nhập: KHÔNG hiện lời mời đăng nhập", () => {
    render(<LessonHub lessonTitle="Bài 1" isGuest={false} items={[item()]} />);
    expect(
      screen.queryByText("Đăng nhập để lưu bài làm và xem lịch sử"),
    ).toBeNull();
  });

  it("không có mục nào thì vẫn render được, không vỡ", () => {
    render(<LessonHub lessonTitle="Bài trống" isGuest={false} items={[]} />);
    expect(screen.getByText("Bài trống")).toBeTruthy();
  });

  it("mục Ôn tập không hiện nhãn Bài N", () => {
    render(
      <LessonHub
        lessonTitle="Ôn tập giữa kì học kì 1"
        isGuest={false}
        items={[]}
      />,
    );

    expect(screen.getByText("Ôn tập", { selector: "p" })).toBeTruthy();
    expect(screen.queryByText(/^Bài \d+$/)).toBeNull();
  });

  it("tắt showLessonNumber thì bỏ hẳn dòng nhãn, không lùi về 'Bài học'", () => {
    render(
      <LessonHub
        lessonTitle="Bài 1"
        lessonNumber={2}
        showLessonNumber={false}
        isGuest={false}
        items={[item({ key: "pdf-book", label: "Vở tập viết", icon: FileText })]}
      />,
    );

    expect(screen.queryByText("Bài 2")).toBeNull();
    expect(screen.queryByText("Bài học", { selector: "p" })).toBeNull();
    expect(screen.getByText("Bài 1")).toBeTruthy();
    expect(screen.getByText("Vở tập viết")).toBeTruthy();
  });
});
