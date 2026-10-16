/**
 * Bước A đồng bộ studio↔web — kênh khôi phục qua prop `answer` cho nhóm
 * interactive.
 *
 * Pattern: "sync-in-render" của YesNoPlayer/SingleChoicePlayer — KHÔNG
 * key-remount (remount sẽ replay animation mỗi lần cha echo lại chính đáp án
 * player vừa emit). State chỉ bị thay khi cha đưa xuống một đáp án KHÁC về mặt
 * ngữ nghĩa so với đáp án đang có.
 *
 * `stableAnswerKey` là bản chép của `stableAnswerValue` (shared.tsx) — hợp
 * đồng lõi đang đóng băng cho đợt sửa này nên không export thêm từ shared.
 */
import { useState } from "react";
import type React from "react";

/** Structural key — object keys sorted so key order never causes a fake diff. */
export function stableAnswerKey(value: unknown): string {
  if (value === undefined) return "undefined";
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableAnswerKey).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableAnswerKey(record[key])}`)
    .join(",")}}`;
}

/**
 * Local interaction state hydrated from the parent-supplied `answer` (already
 * coerced to the player's own emit shape by the caller). Resets ONLY when the
 * parent supplies a semantically different answer than the current local one —
 * an echo of our own report never resets, and local edits win between echoes.
 */
export function useRestoredAnswerState<T>(
  restored: T,
): [T, React.Dispatch<React.SetStateAction<T>>] {
  const key = stableAnswerKey(restored);
  const [value, setValue] = useState<T>(restored);
  const [syncedKey, setSyncedKey] = useState(key);
  if (syncedKey !== key) {
    setSyncedKey(key);
    if (stableAnswerKey(value) !== key) setValue(restored);
  }
  return [value, setValue];
}

/** Coerce an unknown parent answer to the string[] emit shape (else empty). */
export function restoredStringArray(answer: unknown): string[] {
  return Array.isArray(answer)
    ? answer.filter((x): x is string => typeof x === "string")
    : [];
}

/** Coerce an unknown parent answer to the number[] emit shape (else empty). */
export function restoredNumberArray(answer: unknown): number[] {
  return Array.isArray(answer)
    ? answer.filter((x): x is number => typeof x === "number" && Number.isFinite(x))
    : [];
}

/** Coerce to the Record<string, string[]> emit shape (checkbox_table). */
export function restoredStringArrayRecord(answer: unknown): Record<string, string[]> {
  if (!answer || typeof answer !== "object" || Array.isArray(answer)) return {};
  const out: Record<string, string[]> = {};
  for (const [key, value] of Object.entries(answer as Record<string, unknown>)) {
    if (Array.isArray(value)) {
      out[key] = value.filter((x): x is string => typeof x === "string");
    }
  }
  return out;
}

/** Coerce to the Record<string, boolean> emit shape (multi_true_false_table). */
export function restoredBooleanRecord(answer: unknown): Record<string, boolean> {
  if (!answer || typeof answer !== "object" || Array.isArray(answer)) return {};
  const out: Record<string, boolean> = {};
  for (const [key, value] of Object.entries(answer as Record<string, unknown>)) {
    if (typeof value === "boolean") out[key] = value;
  }
  return out;
}
