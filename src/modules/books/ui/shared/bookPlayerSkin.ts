/**
 * Skin của player theo QUYỂN SÁCH đang mở.
 *
 * Player không biết nó nằm trong sách nào (`PlayerProps` không có môn), nên
 * khác biệt theo môn đi bằng skin: tầng app quyết định và bọc runner trong một
 * `SkinProvider` lồng. Hiện chỉ sách Đạo đức lệch — tắt dòng gợi ý của câu nối
 * chuỗi, xem `hidesChainMatchHint`.
 */
import { useMemo } from "react";
import {
  getDefaultSkin,
  isAccentAware,
  type AnySkin,
  type QuestionPlayerSkin,
  type SkinPresentation,
} from "@/core/exercise/skin";
import { hidesChainMatchHint, type SubjectRef } from "./lessonLabels";

function mergePresentation(
  skin: QuestionPlayerSkin,
  presentation: SkinPresentation,
): QuestionPlayerSkin {
  return { ...skin, presentation: { ...skin.presentation, ...presentation } };
}

/**
 * Thêm cờ presentation vào một skin bất kỳ. Không spread thẳng được: skin mặc
 * định là ACCENT-AWARE (`{ name, forAccent }`), token sinh lúc render nên
 * `{ ...skin, presentation }` ra skin rỗng token — phải bọc lại `forAccent`.
 */
export function withPresentation(
  skin: AnySkin,
  presentation: SkinPresentation,
): AnySkin {
  if (isAccentAware(skin)) {
    return {
      name: skin.name,
      forAccent: (accent) => mergePresentation(skin.forAccent(accent), presentation),
    };
  }
  return mergePresentation(skin, presentation);
}

/**
 * Skin để bọc phần bài tập của một quyển sách. `useMemo` để giữ NGUYÊN THAM
 * CHIẾU: `useSkin()` memo theo (skin, accent), skin mới mỗi render là player
 * mất memo và tính lại toàn bộ token.
 */
export function useBookPlayerSkin(subject: SubjectRef): AnySkin {
  const hideChainHint = hidesChainMatchHint(subject);
  return useMemo(
    () =>
      hideChainHint
        ? withPresentation(getDefaultSkin(), { hideChainMatchHint: true })
        : getDefaultSkin(),
    [hideChainHint],
  );
}
