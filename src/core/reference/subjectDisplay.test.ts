import { describe, expect, it } from "vitest";
import { getSubjectDisplay } from "./subjectDisplay";

describe("getSubjectDisplay", () => {
  it("trả metadata cho code đã biết", () => {
    const d = getSubjectDisplay("toan");
    expect(d.label).toBe("Toán");
    expect(d.emoji).toBe("➗");
  });

  it("label từ API thắng label tĩnh", () => {
    expect(getSubjectDisplay("toan", "Toán học").label).toBe("Toán học");
  });

  it("code lạ fallback title-case + 📚, không throw", () => {
    const d = getSubjectDisplay("mon-la-nao-do");
    expect(d.label).toBe("Mon La Nao Do");
    expect(d.emoji).toBe("📚");
  });
});
