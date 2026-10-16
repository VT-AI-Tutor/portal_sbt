import { createContext, useContext } from "react";

/**
 * Container element để portal các overlay con (lightbox, tooltip, popover
 * lồng trong dialog) vào BÊN TRONG Dialog content thay vì `document.body`.
 *
 * Lý do cần: Radix Dialog dùng `composedPath()` để xác định pointer có nằm
 * trong content không (xem `@radix-ui/react-dismissable-layer` `handlePointerDown`).
 * Nếu portal ra body, Radix thấy "outside" và đóng dialog khi user click vào
 * overlay con — đó là lỗi "đóng ảnh đóng luôn popup làm bài" của bài tập
 * nâng cao. Portal vào content thì Radix thấy "inside" → không đóng.
 *
 * `null` = không có Dialog cha, fallback về `document.body` (hành vi cũ).
 */
export const DialogPortalContext = createContext<HTMLElement | null>(null);

export const useDialogPortalContainer = (): HTMLElement | null =>
  useContext(DialogPortalContext);
