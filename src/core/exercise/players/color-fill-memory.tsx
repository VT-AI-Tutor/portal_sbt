/**
 * web-own: chưa upstream lên studio — xem WEB-OWN PATCHES trong
 * apps/learner/scripts/detokenize-players.mjs.
 *
 * Sổ nhớ màu cho câu color_fill. Đáp án chỉ mang id phương án (màu không vào
 * chấm điểm), nên khi rời câu rồi quay lại, player dựng lại từ `answer` và mọi ô
 * về màu mặc định. Runner giữ một sổ suốt lượt làm; player đọc/ghi theo
 * questionId. Không có provider (studio, /dev/players) thì như cũ.
 */
import React, { createContext, useContext, useEffect } from "react";

export interface ColorFillMemo {
  /** optionId → màu học sinh đã tô. */
  fills: Record<string, string>;
  /** Màu bút đang cầm lúc rời câu. */
  brush: string;
}

export type ColorFillMemory = Map<string, ColorFillMemo>;

export const createColorFillMemory = (): ColorFillMemory => new Map();

/**
 * Xoá màu đã nhớ của câu `questionId` và mọi câu con của nó (khoá
 * `${cha}/${con}`). Runner gọi cùng lúc với "Làm lại" để câu dựng lại từ màu
 * mặc định chứ không mang màu của lượt trước.
 */
export function forgetColorFill(store: ColorFillMemory, questionId: string): void {
  for (const key of [...store.keys()]) {
    if (key === questionId || key.startsWith(`${questionId}/`)) store.delete(key);
  }
}

const ColorFillMemoryContext = createContext<ColorFillMemory | null>(null);

/** Store do runner sở hữu (useState) để không mất khi runner đổi màn tải/kết quả. */
export function ColorFillMemoryProvider({
  store,
  children,
}: {
  store: ColorFillMemory;
  children: React.ReactNode;
}) {
  return <ColorFillMemoryContext.Provider value={store}>{children}</ColorFillMemoryContext.Provider>;
}

/** Màu đã nhớ của câu `key`; undefined khi không có sổ hoặc câu không có id. */
export function useColorFillRecall(key: string | undefined): ColorFillMemo | undefined {
  const store = useContext(ColorFillMemoryContext);
  return store && key !== undefined ? store.get(key) : undefined;
}

/** Ghi màu hiện tại vào sổ mỗi khi đổi. */
export function useRememberColorFill(
  key: string | undefined,
  fills: Record<string, string>,
  brush: string,
): void {
  const store = useContext(ColorFillMemoryContext);
  useEffect(() => {
    if (store && key !== undefined) store.set(key, { fills, brush });
  }, [store, key, fills, brush]);
}
