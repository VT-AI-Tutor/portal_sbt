/**
 * resolveQuestionType: the legacy catalog lesson endpoint can omit the
 * top-level question `type` while the v2 schema in `payload.type` still
 * carries it — without the fallback, guest (not-logged-in) rendering showed
 * "Loại câu hỏi chưa được hỗ trợ" for questions that work when logged in
 * (the student-exercises endpoint does include `type`).
 */
import { describe, expect, it } from "vitest";
import { resolveQuestionType } from "./questionType";

describe("resolveQuestionType", () => {
  it("prefers the explicit top-level type", () => {
    expect(resolveQuestionType("single_choice", { type: "matching" })).toBe(
      "single_choice",
    );
  });

  it("falls back to payload.type when the wire omits the top-level type", () => {
    expect(resolveQuestionType(undefined, { type: "matching" })).toBe(
      "matching",
    );
    expect(resolveQuestionType("", { type: "matching" })).toBe("matching");
    expect(resolveQuestionType(null, { type: "matching" })).toBe("matching");
  });

  it("returns an empty string when neither carries a usable type", () => {
    expect(resolveQuestionType(undefined, {})).toBe("");
    expect(resolveQuestionType(undefined, undefined)).toBe("");
    expect(resolveQuestionType(undefined, null)).toBe("");
    expect(resolveQuestionType(undefined, { type: 42 })).toBe("");
  });
});
