// @vitest-environment jsdom
/**
 * Đường KHÁCH (chưa đăng nhập / xem trước) chấm câm y hệt đường đã đăng nhập —
 * góp ý 2026-08 mục 4 áp cho cả hai.
 *
 * Làm xong thì kết quả hiện NGAY TRONG runner đang chạy — không mở màn xem lại
 * riêng — và về câu 1 để soát lại từ đầu cho dễ.
 *
 * Dấu chấm do CHÍNH PLAYER tô (`submitted` + `revealCorrect`) chứ không phải
 * runner bơm verdict xuống — nhờ vậy mọi câu đều đúng khi chuyển qua lại, và
 * hình thức y hệt chấm ngay. `hideResultBanner` vì kết quả phải nằm TRONG câu,
 * không phải một khung verdict riêng.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

// Stub player: phơi các prop quyết định cách hiển thị kết quả.
vi.mock("@/core/exercise/QuestionPlayer", () => ({
  QuestionPlayer: ({
    index,
    onAnswerChange,
    ...rest
  }: {
    index: number;
    onAnswerChange?: (a: unknown) => void;
  } & Record<string, unknown>) => {
    const r = rest as {
      gradeMode?: string;
      submitted?: boolean;
      revealCorrect?: boolean;
      hideResultBanner?: boolean;
    };
    return (
      <div data-testid="qp">
        câu={index} gradeMode={String(r.gradeMode)} submitted=
        {String(r.submitted)} revealCorrect={String(r.revealCorrect)}{" "}
        hideResultBanner={String(r.hideResultBanner)}
        <button
          type="button"
          onClick={() => onAnswerChange?.(`ans-${index}`)}
        >
          trả-lời-đúng
        </button>
        <button
          type="button"
          onClick={() => onAnswerChange?.(`ans-${index}`)}
        >
          trả-lời-sai
        </button>
      </div>
    );
  },
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const question = (id: string) => ({
  id,
  question_type: "fill_blank",
  payload: { content: { blocks: [{ type: "paragraph", text: "Điền số" }] } },
});

async function renderRunner() {
  const { StandaloneExerciseRunner } = await import("./StandaloneExerciseRunner");
  render(
    <StandaloneExerciseRunner
      lessonTitle="Bài"
      questions={[question("q1"), question("q2")]}
    />,
  );
}

const player = () => screen.getByTestId("qp").textContent ?? "";

describe("StandaloneExerciseRunner — khách cũng chấm câm", () => {
  it("đang làm: chấm câm, không lộ gì", async () => {
    await renderRunner();

    fireEvent.click(screen.getByRole("button", { name: "trả-lời-đúng" }));

    expect(player()).toContain("gradeMode=silent");
    expect(player()).toContain("submitted=false");
    expect(player()).toContain("revealCorrect=false");
    expect(player()).toContain("hideResultBanner=false");
  });

  it("làm xong: chấm ngay trong runner, về câu 1, kèm toast", async () => {
    const { toast } = await import("sonner");
    await renderRunner();

    fireEvent.click(screen.getByRole("button", { name: "trả-lời-đúng" }));
    fireEvent.click(screen.getByRole("button", { name: /Câu tiếp/ }));
    fireEvent.click(screen.getByRole("button", { name: "trả-lời-sai" }));
    fireEvent.click(screen.getByRole("button", { name: /Hoàn thành/ }));

    // Về câu 1 để soát lại từ đầu, vẫn là chính runner này.
    expect(player()).toContain("câu=0");
    expect(player()).toContain("submitted=true");
    expect(player()).toContain("revealCorrect=true");
    expect(player()).toContain("hideResultBanner=true");
    expect(toast.success).toHaveBeenCalledTimes(1);
  });

  it("chuyển câu: câu nào cũng ở trạng thái đã chấm", async () => {
    await renderRunner();

    fireEvent.click(screen.getByRole("button", { name: "trả-lời-đúng" }));
    fireEvent.click(screen.getByRole("button", { name: /Câu tiếp/ }));
    fireEvent.click(screen.getByRole("button", { name: "trả-lời-sai" }));
    fireEvent.click(screen.getByRole("button", { name: /Hoàn thành/ }));

    fireEvent.click(screen.getByRole("button", { name: /Câu tiếp/ }));
    expect(player()).toContain("câu=1");
    // Câu nào cũng ở trạng thái đã chấm — player tự tô dấu trong câu.
    expect(player()).toContain("submitted=true");
    expect(player()).toContain("revealCorrect=true");
  });

  it("KHÔNG còn dòng điểm ở màn Hoàn thành", async () => {
    await renderRunner();

    fireEvent.click(screen.getByRole("button", { name: "trả-lời-đúng" }));
    fireEvent.click(screen.getByRole("button", { name: /Câu tiếp/ }));
    fireEvent.click(screen.getByRole("button", { name: "trả-lời-đúng" }));
    fireEvent.click(screen.getByRole("button", { name: /Hoàn thành/ }));
    // Đã chấm: có nút "Hoàn thành" phụ để thoát thẳng, khỏi soát hết từng câu.
    fireEvent.click(screen.getByRole("button", { name: /Hoàn thành/ }));

    expect(screen.getByText(/Em đã làm xong bài tập/)).toBeTruthy();
    expect(document.body.textContent).not.toContain("Em làm đúng");
  });

  it("đang làm thì KHÔNG có lối tắt Hoàn thành ở câu không phải câu cuối", async () => {
    await renderRunner();

    fireEvent.click(screen.getByRole("button", { name: "trả-lời-đúng" }));
    // Câu 1/2 khi đang làm: nút bên phải là "Câu tiếp", không có "Hoàn thành".
    expect(screen.queryByRole("button", { name: /Hoàn thành/ })).toBeNull();
  });

  it("đã chấm ở câu cuối: chỉ MỘT nút Hoàn thành, không trùng lối tắt", async () => {
    await renderRunner();

    fireEvent.click(screen.getByRole("button", { name: "trả-lời-đúng" }));
    fireEvent.click(screen.getByRole("button", { name: /Câu tiếp/ }));
    fireEvent.click(screen.getByRole("button", { name: "trả-lời-đúng" }));
    fireEvent.click(screen.getByRole("button", { name: /Hoàn thành/ }));
    fireEvent.click(screen.getByRole("button", { name: /Câu tiếp/ }));

    expect(screen.getAllByRole("button", { name: /Hoàn thành/ })).toHaveLength(1);
  });

  it('"Làm lại từ đầu" đưa về lại chấm câm', async () => {
    await renderRunner();

    fireEvent.click(screen.getByRole("button", { name: "trả-lời-đúng" }));
    fireEvent.click(screen.getByRole("button", { name: /Câu tiếp/ }));
    fireEvent.click(screen.getByRole("button", { name: "trả-lời-đúng" }));
    fireEvent.click(screen.getByRole("button", { name: /Hoàn thành/ }));
    fireEvent.click(screen.getByRole("button", { name: /Hoàn thành/ }));
    fireEvent.click(screen.getByRole("button", { name: /Làm lại từ đầu/ }));

    // Lượt mới: về lại chấm câm, dấu chấm lượt trước biến mất.
    expect(player()).toContain("gradeMode=silent");
    expect(player()).toContain("hideResultBanner=false");
  });
});
