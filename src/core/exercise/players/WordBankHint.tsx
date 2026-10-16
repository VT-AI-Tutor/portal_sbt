/**
 * Dải gợi ý ngân hàng từ — bản CHỈ ĐỌC dùng ở `ClozePlayer` (P13) và
 * `FillBlankPlayer` (P12). Hai player này không kéo-thả; ngân hàng chỉ là gợi ý
 * đặt trên đề bài. (Bản tương tác kéo-thả là `WordBankPlayer` — P25.)
 *
 * Tách ra một chỗ vì phần tử ngân hàng nay có thể mang MEDIA (§5.6.1): nếu để
 * hai player tự render, chỉ cần một bên quên nhánh media là câu Mỹ thuật hiện
 * ra một dải chip trống. Màu nhấn vẫn theo từng player nên truyền vào qua
 * `fallbackChipClass` — skin bật thì `skin.chip()` thắng như cũ.
 */
import React from "react";
import { useSkin } from "@/core/exercise/skin";
import { wordBankEntryLabel, type WordBankEntry } from "@/core/question-schema";
import { AnswerMediaView } from "./AnswerMediaView";

export interface WordBankHintProps {
  entries: WordBankEntry[];
  /** Lớp chip mặc định của player khi skin không cung cấp `chip()`. */
  fallbackChipClass: string;
}

export const WordBankHint: React.FC<WordBankHintProps> = ({ entries, fallbackChipClass }) => {
  const skin = useSkin();
  if (entries.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2 mb-5">
      {entries.map((entry) => (
        <span
          key={entry.id}
          className={`px-3 py-1.5 text-sm sm:text-base ${skin.chip?.("idle", "primary") ?? fallbackChipClass}`}
        >
          {entry.media ? (
            <span className="inline-flex items-center gap-2 align-middle">
              <AnswerMediaView media={entry.media} alt={entry.text} size="hint" />
              {entry.text ? <span>{entry.text}</span> : null}
            </span>
          ) : (
            wordBankEntryLabel(entry)
          )}
        </span>
      ))}
    </div>
  );
};
