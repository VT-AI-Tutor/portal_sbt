/**
 * MỘT chỗ duy nhất vẽ `media` của phần tử đáp án (§5.6/§5.6.1) — chip kho từ,
 * ô trống đã điền, dải gợi ý, và ô trống mang ảnh đề bài đều đi qua đây.
 *
 * `media` là một khối §4.2 không bọc mảng, nên loại KHÔNG phải ảnh rơi thẳng
 * về `RichContentBlocks([media])` — audio/video/math render được ngay khi có
 * nhu cầu, không cần sửa component này. Ảnh giữ nhánh `<img>` riêng vì từng
 * ngữ cảnh cần một trần cỡ khác nhau (chip to hơn ô trống đã điền…).
 */
import React from "react";
import type { AnswerElementMedia } from "@/core/question-schema";
import { RichContentBlocks, type ContentBlock } from "./shared";

/** Trần cỡ ảnh theo ngữ cảnh đặt media. */
const IMAGE_SIZE: Record<AnswerMediaSize, string> = {
  /** Chip kéo-thả trong khay của WordBankPlayer. */
  chip: "h-16 max-w-[120px]",
  /** Ô trống ĐÃ ĐIỀN — nhỏ hơn chip để không phá dòng chữ. */
  blank: "h-10 max-w-[80px]",
  /** Dải gợi ý chỉ đọc trên ClozePlayer/FillBlankPlayer. */
  hint: "h-12 max-w-[96px]",
  /** Ảnh đề bài của một ô trống (`blanks[].media`) — đứng cạnh ô nhập. */
  prompt: "h-14 max-w-[140px]",
};

export type AnswerMediaSize = "chip" | "blank" | "hint" | "prompt";

export interface AnswerMediaViewProps {
  media: AnswerElementMedia;
  /** Chữ thay thế khi media là ảnh — thường là `text` của phần tử. */
  alt?: string;
  size: AnswerMediaSize;
}

export const AnswerMediaView: React.FC<AnswerMediaViewProps> = ({ media, alt, size }) => {
  if (media.type === "image") {
    if (!media.url) return null;
    return (
      <img
        src={media.url}
        alt={media.altText || alt || ""}
        className={`w-auto object-contain ${IMAGE_SIZE[size]}`}
        draggable={false}
      />
    );
  }
  // Loại §4.2 khác (audio/video/math…) — renderer chung đã có sẵn hai phía.
  return (
    <span className="inline-block max-w-[220px] align-middle">
      <RichContentBlocks blocks={[media as ContentBlock]} compact />
    </span>
  );
};
