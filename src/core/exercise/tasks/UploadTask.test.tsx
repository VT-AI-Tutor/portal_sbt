import { act, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { UploadTask } from "./UploadTask";

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  // jsdom không có createObjectURL — UploadTask dùng nó cho preview ảnh local.
  vi.stubGlobal("URL", {
    ...URL,
    createObjectURL: vi.fn(() => "blob:preview"),
    revokeObjectURL: vi.fn(),
  });
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function render(element: ReactElement) {
  act(() => root.render(element));
}

/** Nhét file vào input[type=file] rồi bắn change — đường chọn file thật. */
async function pickFiles(files: File[]) {
  const input = container.querySelector<HTMLInputElement>('input[type="file"]')!;
  Object.defineProperty(input, "files", { value: files, configurable: true });
  await act(async () => {
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

const png = () => new File(["x"], "bai-lam.png", { type: "image/png" });

describe("UploadTask — tích hợp upload LCMS (answer.files)", () => {
  it("có onUploadFile: chọn file → upload → emit answer {files:[{fileUrl,fileId,…}]}", async () => {
    const onUploadFile = vi
      .fn()
      .mockResolvedValue({ fileId: "f1", fileUrl: "https://media.test/f1.png" });
    const onAnswerChange = vi.fn();

    render(
      <UploadTask
        title="Nộp bài"
        onComplete={vi.fn()}
        onAnswerChange={onAnswerChange}
        onUploadFile={onUploadFile}
      />,
    );
    await pickFiles([png()]);

    expect(onUploadFile).toHaveBeenCalledTimes(1);
    expect(onAnswerChange).toHaveBeenLastCalledWith({
      files: [
        {
          fileUrl: "https://media.test/f1.png",
          fileId: "f1",
          name: "bai-lam.png",
          size: 1,
          type: "image/png",
        },
      ],
    });
    // File đã upload hiện trong danh sách.
    expect(container.textContent).toContain("bai-lam.png");
  });

  it("upload thất bại: báo lỗi, KHÔNG đưa file vào answer", async () => {
    const onUploadFile = vi.fn().mockRejectedValue(new Error("mạng rớt"));
    const onAnswerChange = vi.fn();

    render(
      <UploadTask
        title="Nộp bài"
        onComplete={vi.fn()}
        onAnswerChange={onAnswerChange}
        onUploadFile={onUploadFile}
      />,
    );
    await pickFiles([png()]);

    expect(container.textContent).toContain("thất bại");
    const emitted = onAnswerChange.mock.calls.at(-1)?.[0] as
      | { files: unknown[] }
      | undefined;
    expect(emitted?.files ?? []).toEqual([]);
  });

  it("khôi phục từ answer: hiện lại file đã nộp (xem lại bài / chuyển câu)", () => {
    render(
      <UploadTask
        title="Nộp bài"
        onComplete={vi.fn()}
        answer={{
          files: [
            {
              fileUrl: "https://media.test/cu.png",
              fileId: "f9",
              name: "anh-cu.png",
            },
          ],
        }}
        submitted
      />,
    );
    expect(container.textContent).toContain("anh-cu.png");
  });

  it("xoá file đã upload → emit answer còn lại; xoá HẾT → emit null (không phải {files:[]})", async () => {
    const onAnswerChange = vi.fn();
    const onUploadFile = vi.fn().mockImplementation((f: File) =>
      Promise.resolve({ fileId: `id-${f.name}`, fileUrl: `https://m.test/${f.name}` }),
    );
    render(
      <UploadTask
        title="Nộp bài"
        onComplete={vi.fn()}
        onAnswerChange={onAnswerChange}
        onUploadFile={onUploadFile}
      />,
    );
    await pickFiles([
      new File(["a"], "trang-1.png", { type: "image/png" }),
      new File(["b"], "trang-2.png", { type: "image/png" }),
    ]);

    const removeBtn = (name: string) =>
      container.querySelector<HTMLButtonElement>(`button[aria-label="Xoá ${name}"]`)!;
    await act(async () => removeBtn("trang-1.png").click());
    const afterOne = onAnswerChange.mock.calls.at(-1)![0] as {
      files: Array<{ fileId: string }>;
    };
    expect(afterOne.files.map((f) => f.fileId)).toEqual(["id-trang-2.png"]);

    // Xoá nốt: {files:[]} sẽ bị isAnswerEmpty đếm là "đã làm" — phải là null.
    await act(async () => removeBtn("trang-2.png").click());
    expect(onAnswerChange).toHaveBeenLastCalledWith(null);
  });

  it("answer tới MUỘN sau mount (màn Xem lại fetch nền): vẫn hydrate danh sách file", async () => {
    const props = {
      title: "Nộp bài",
      onComplete: vi.fn(),
      onUploadFile: vi.fn(),
      submitted: true,
    };
    render(<UploadTask {...props} answer={undefined} />);
    expect(container.textContent).not.toContain("anh-da-nop.png");

    render(
      <UploadTask
        {...props}
        answer={{
          files: [
            { fileUrl: "https://m.test/x.png", fileId: "f7", name: "anh-da-nop.png" },
          ],
        }}
      />,
    );
    await act(async () => {});
    expect(container.textContent).toContain("anh-da-nop.png");
  });

  it("fileUrl có percent-sequence hỏng: không crash, hiện tên thô", () => {
    render(
      <UploadTask
        title="Nộp bài"
        onComplete={vi.fn()}
        answer={{ files: [{ fileUrl: "https://m.test/f%zz.png", fileId: "f8" }] }}
        submitted
      />,
    );
    expect(container.textContent).toContain("f%zz.png");
  });

  it("chọn thêm lần hai: APPEND vào answer, không thay thế lượt trước", async () => {
    const onUploadFile = vi
      .fn()
      .mockImplementation((f: File) =>
        Promise.resolve({ fileId: `id-${f.name}`, fileUrl: `https://m.test/${f.name}` }),
      );
    const onAnswerChange = vi.fn();
    render(
      <UploadTask
        title="Nộp bài"
        onComplete={vi.fn()}
        onAnswerChange={onAnswerChange}
        onUploadFile={onUploadFile}
      />,
    );

    await pickFiles([new File(["a"], "trang-1.png", { type: "image/png" })]);
    await pickFiles([new File(["b"], "trang-2.png", { type: "image/png" })]);

    const emitted = onAnswerChange.mock.calls.at(-1)![0] as {
      files: Array<{ fileId: string }>;
    };
    expect(emitted.files.map((f) => f.fileId)).toEqual([
      "id-trang-1.png",
      "id-trang-2.png",
    ]);
  });

  it("file quá cỡ: chặn tại chỗ, KHÔNG upload, báo vượt quá giới hạn", async () => {
    const onUploadFile = vi.fn();
    const onAnswerChange = vi.fn();
    render(
      <UploadTask
        title="Nộp bài"
        maxFileSizeMB={1}
        onComplete={vi.fn()}
        onAnswerChange={onAnswerChange}
        onUploadFile={onUploadFile}
      />,
    );
    await pickFiles([
      new File([new ArrayBuffer(2 * 1024 * 1024)], "qua-to.png", { type: "image/png" }),
    ]);

    expect(container.textContent).toContain('File "qua-to.png" vượt quá 1MB');
    expect(onUploadFile).not.toHaveBeenCalled();
    expect(onAnswerChange).not.toHaveBeenCalled();
    expect(container.textContent).not.toContain("qua-to.png\n");
  });

  it("hai file, một cái fail: cái còn lại vẫn vào answer, cái hỏng bị gỡ + báo lỗi", async () => {
    const onUploadFile = vi.fn().mockImplementation((f: File) =>
      f.name === "hong.png"
        ? Promise.reject(new Error("mạng rớt"))
        : Promise.resolve({ fileId: "ok-1", fileUrl: "https://m.test/ok.png" }),
    );
    const onAnswerChange = vi.fn();
    render(
      <UploadTask
        title="Nộp bài"
        onComplete={vi.fn()}
        onAnswerChange={onAnswerChange}
        onUploadFile={onUploadFile}
      />,
    );
    await pickFiles([
      new File(["x"], "ok.png", { type: "image/png" }),
      new File(["y"], "hong.png", { type: "image/png" }),
    ]);

    const emitted = onAnswerChange.mock.calls.at(-1)![0] as {
      files: Array<{ fileId: string }>;
    };
    expect(emitted.files.map((f) => f.fileId)).toEqual(["ok-1"]);
    expect(container.textContent).toContain('Tải file "hong.png" lên thất bại');
    // File hỏng không còn nằm trong danh sách chờ.
    expect(container.querySelector('button[aria-label="Xoá hong.png"]')).toBeNull();
    expect(container.querySelector('button[aria-label="Xoá ok.png"]')).not.toBeNull();
  });

  it("413 (file vượt trần máy chủ): hiện câu dung lượng, không phải câu \'thử lại\' chung", async () => {
    // Shape thật của lỗi: lcmsAuthedFetch parse JSON hỏng trên thân HTML của
    // nginx nên chỉ còn statusCode + message kỹ thuật.
    const tooLarge = Object.assign(new Error("LCMS API error 413"), {
      statusCode: 413,
    });
    render(
      <UploadTask
        title="Nộp bài"
        onComplete={vi.fn()}
        onAnswerChange={vi.fn()}
        onUploadFile={vi.fn().mockRejectedValue(tooLarge)}
      />,
    );
    await pickFiles([new File(["x"], "nang.jpg", { type: "image/jpeg" })]);

    expect(container.textContent).toContain("File quá lớn");
    expect(container.textContent).not.toContain("413");
  });

  it("lỗi khác 413: giữ nguyên câu chung, KHÔNG đẩy message thô của server ra", async () => {
    render(
      <UploadTask
        title="Nộp bài"
        onComplete={vi.fn()}
        onAnswerChange={vi.fn()}
        onUploadFile={vi
          .fn()
          .mockRejectedValue(
            Object.assign(new Error("LCMS API error 500"), { statusCode: 500 }),
          )}
      />,
    );
    await pickFiles([png()]);

    expect(container.textContent).toContain('Tải file "bai-lam.png" lên thất bại');
    expect(container.textContent).not.toContain("500");
  });

  it("không có onUploadFile: giữ hợp đồng cũ — emit metadata local", async () => {
    const onAnswerChange = vi.fn();
    render(
      <UploadTask
        title="Nộp bài"
        onComplete={vi.fn()}
        onAnswerChange={onAnswerChange}
      />,
    );
    await pickFiles([png()]);

    expect(onAnswerChange).toHaveBeenLastCalledWith([
      { name: "bai-lam.png", size: 1, type: "image/png" },
    ]);
  });
});
