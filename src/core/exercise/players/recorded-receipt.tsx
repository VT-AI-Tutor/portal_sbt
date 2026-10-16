/**
 * web-own: chưa upstream lên studio — xem WEB-OWN PATCHES (mục I) trong
 * apps/learner/scripts/detokenize-players.mjs.
 *
 * Câu học sinh tự viết / tự vẽ, không có đáp án (SBT-61, góp ý NXB mục 3): nút
 * "Nộp câu trả lời" ngay trong câu, bấm thì thành "Hệ thống đã ghi nhận". Nút chỉ là lời
 * xác nhận của học sinh — không khoá câu, không gửi gì (đáp án vẫn autosave).
 */
import React, { useMemo } from "react";
import { motion } from "motion/react";
import { GradeModeContext, useGradeMode } from "./shared";
import { useSkin } from "@/core/exercise/skin";

export const RECORDED_TEXT = "Hệ thống đã ghi nhận";
// Cố ý KHÁC "Nộp bài" của runner (nộp cả bài): ở câu cuối hai nút đứng cạnh nhau,
// trùng tên thì học sinh bấm nút trong câu rồi tưởng đã nộp xong (review PR #110).
export const SUBMIT_TEXT = "Nộp câu trả lời";

export function RecordedLine() {
  const skin = useSkin();
  return (
    <p role="status" className={skin.feedback?.("success") ?? "mt-4 text-center font-black text-green-600"}>
      {RECORDED_TEXT}
    </p>
  );
}

export function RecordedSubmitButton({
  onClick,
  disabled = false,
}: {
  onClick: () => void;
  disabled?: boolean;
}) {
  const skin = useSkin();
  return (
    <div className="mt-4 flex justify-center">
      <motion.button
        type="button"
        whileTap={disabled ? undefined : { scale: 0.94 }}
        onClick={onClick}
        disabled={disabled}
        className={
          skin.actionButton?.(!disabled, "primary") ??
          (disabled
            ? "px-8 py-3 rounded-full border-4 border-slate-200 bg-slate-100 text-slate-400 font-black text-base sm:text-lg cursor-not-allowed"
            : "px-8 py-3 rounded-full border-4 border-sky-500 bg-sky-400 text-white font-black text-base sm:text-lg shadow-sm hover:bg-sky-500 transition-colors")
        }
      >
        {SUBMIT_TEXT}
      </motion.button>
    </div>
  );
}

/**
 * Đang làm: nút "Nộp câu trả lời" ↔ dòng ghi nhận theo `confirmed`; chưa viết gì thì nút mờ —
 * báo "đã ghi nhận" cho ô trống là hứa suông. Đã khoá (nộp cả bài, màn xem lại) thì
 * chỉ còn dòng, và chỉ khi có bài làm.
 */
export function RecordedReceipt({
  locked,
  hasAnswer,
  confirmed,
  onSubmit,
}: {
  locked: boolean;
  hasAnswer: boolean;
  confirmed: boolean;
  onSubmit: () => void;
}) {
  if (locked) return hasAnswer ? <RecordedLine /> : null;
  return confirmed ? (
    <RecordedLine />
  ) : (
    <RecordedSubmitButton onClick={onSubmit} disabled={!hasAnswer} />
  );
}

/**
 * Ẩn ResultBanner "Đã ghi nhận câu trả lời." — dòng ghi nhận trong câu đã nói thay.
 * CHỈ banner `incomplete`: câu GV đã chấm (host bơm correct/incorrect) phải giữ banner.
 * Cùng luật chọn verdict với PlayerShell: silent lấy `silentVerdict`, parent lấy `result`.
 */
export function HideResultBanner({
  active = true,
  children,
}: {
  active?: boolean;
  children: React.ReactNode;
}) {
  const ctx = useGradeMode();
  const bannerVerdict = ctx.silent ? ctx.silentVerdict : ctx.result;
  const hide = active && bannerVerdict === "incomplete";
  const value = useMemo(
    () => ({ ...ctx, hideBanner: ctx.hideBanner || hide }),
    [ctx, hide],
  );
  // Luôn cùng một Provider: đổi kiểu phần tử theo `hide` là React gỡ-dựng lại cả
  // player — verdict chấm câm đổi sau nét vẽ đầu tiên là khung vẽ bị xoá trắng.
  return <GradeModeContext.Provider value={value}>{children}</GradeModeContext.Provider>;
}
