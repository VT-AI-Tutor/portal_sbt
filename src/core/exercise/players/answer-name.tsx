/**
 * Tên một phần tử trong khối "Đáp án đúng" và trong nhãn trợ năng.
 *
 * Luật: client chỉ dựng lại thứ TÁC GIẢ đã khai — chữ trong `content`, rồi
 * `text`, rồi `label`. Id và URL ảnh là định danh máy, không bao giờ là tên.
 * Phần tử không khai tên thì gọi theo thứ tự tác giả nhập ("Thẻ 3") — mặt bài
 * dùng cùng tên đó (dispatch `textItems` / `itemText`) nên bảng đáp án luôn
 * khớp với chữ trên thẻ, kể cả khi thẻ bị xáo. Phần tử chỉ có ảnh thì hiện ảnh.
 */
import React from "react";
import type { RichContent } from "@/core/question-schema";
import { plainTextFromRichContent } from "@/core/rich-text/html";
import { resolveAssetUrl } from "@/core/content/assetUrl";
import { PlayerTextValue } from "./shared";

export interface NamedEntry {
  content?: RichContent;
  text?: unknown;
  label?: unknown;
  imageUrl?: string;
}

/**
 * `String(...)` không thừa: payload đi thẳng từ kho schemaless, một
 * `label: 361` không nháy sẽ làm `.trim()` ném lỗi và sập cả câu hỏi.
 */
function nonEmpty(value: unknown): string | undefined {
  if (value == null) return undefined;
  const s = String(value).trim();
  return s || undefined;
}

export function authoredName(entry: NamedEntry | null | undefined): string | undefined {
  if (!entry) return undefined;
  return (
    nonEmpty(entry.content ? plainTextFromRichContent(entry.content) : undefined) ??
    nonEmpty(entry.text) ??
    nonEmpty(entry.label)
  );
}

/** Một mảnh của dòng đáp án: chữ, hoặc ảnh của phần tử chỉ có ảnh. */
export type RevealPart = string | { image: string; alt: string };

export function revealName(
  entry: NamedEntry | null | undefined,
  index: number,
  noun: string,
): RevealPart {
  // Đáp án trỏ tới id không có trong payload: không có vị trí nào để gọi.
  if (!entry || index < 0) return "";
  const name = authoredName(entry);
  if (name) return name;
  const ordinal = `${noun} ${index + 1}`;
  if (entry?.imageUrl) return { image: entry.imageUrl, alt: ordinal };
  return ordinal;
}

/** Tên chữ cho nơi không đặt được ảnh (aria-label, chuỗi nối). */
export function nameOrOrdinal(entry: NamedEntry | null | undefined, index: number, noun: string): string {
  if (!entry || index < 0) return "";
  return authoredName(entry) ?? `${noun} ${index + 1}`;
}

/**
 * Ghép các dòng đáp án. Toàn chữ thì trả CHUỖI như trước — đi qua đúng biên
 * toán học của `CorrectAnswerReveal`. Có ảnh thì dựng node, mỗi mảnh chữ vẫn
 * qua `PlayerTextValue` để `\( … \)` không lọt ra thô.
 */
export function joinReveal(lines: RevealPart[][]): React.ReactNode {
  if (lines.every((line) => line.every((part) => typeof part === "string"))) {
    return lines.map((line) => line.join("")).join("\n");
  }
  return (
    <>
      {lines.map((line, i) => (
        <div key={i}>
          {line.map((part, j) =>
            typeof part === "string" ? (
              <PlayerTextValue key={j} value={part} />
            ) : (
              <img
                key={j}
                src={resolveAssetUrl(part.image)}
                alt={part.alt}
                className="inline-block h-8 w-auto max-w-24 rounded object-contain align-middle"
              />
            ),
          )}
        </div>
      ))}
    </>
  );
}
