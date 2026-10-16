/**
 * Provider switch for reference data (levels/subjects): when API_PROVIDER is
 * "lcms" these must come from the LCMS grade/subject endpoints (mapped to the
 * legacy ReferenceItem shape) — NOT from the legacy /api/v1/catalog/* routes.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchLevels, fetchSubjects } from "./referenceApi";

const lcmsEnvelope = (data: unknown) => ({
  success: true,
  message: null,
  data,
  total: Array.isArray(data) ? data.length : null,
});

// String ids exactly as the live LCMS API serializes them.
const GRADES = [
  { id: "4", code: "lop-4", name: "Lớp 4", level: "4" },
  { id: "1", code: "lop-1", name: "Lớp 1", level: "1" },
];
const SUBJECTS = [
  { id: "10256693714406400", code: "am-nhac", name: "Âm nhạc", coverUrl: null },
  {
    id: "10256683754114048",
    code: "tieng-viet",
    name: "Tiếng Việt",
    coverUrl: null,
  },
];

function stubRuntimeConfig(config: Record<string, string>) {
  vi.stubGlobal("window", { __APP_CONFIG__: config });
}

function stubFetch() {
  const calls: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      calls.push(String(url));
      const body = String(url).includes("/grade/")
        ? lcmsEnvelope(GRADES)
        : String(url).includes("/subject/")
          ? lcmsEnvelope(SUBJECTS)
          : String(url).includes("/api/v1/catalog/levels")
            ? { success: true, data: [{ code: "1", label: "Lớp 1", order: 1 }] }
            : String(url).includes("/api/v1/catalog/subjects")
              ? {
                  success: true,
                  data: [{ code: "toan", label: "Toán", order: 1 }],
                }
              : {
                  success: false,
                  message: "not-found",
                  data: null,
                  total: null,
                };
      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }),
  );
  return calls;
}

afterEach(() => vi.unstubAllGlobals());

describe("reference API provider switch", () => {
  it("fetchLevels uses the LCMS grade endpoint when API_PROVIDER=lcms", async () => {
    stubRuntimeConfig({
      API_PROVIDER: "lcms",
      LCMS_API_BASE_URL: "http://lcms.test",
    });
    const calls = stubFetch();

    const levels = await fetchLevels();

    expect(calls.some((u) => u.includes("/api/v1/catalog/levels"))).toBe(false);
    expect(
      calls.some((u) => u.startsWith("http://lcms.test/api/lcms/grade/")),
    ).toBe(true);
    // code must equal the grade's `level` (string) — catalog filters and the
    // student profile compare it against BookListItem.level via strict equality.
    expect(levels).toEqual([
      { code: "1", label: "Lớp 1", order: 1 },
      { code: "4", label: "Lớp 4", order: 4 },
    ]);
  });

  it("fetchSubjects uses the LCMS subject endpoint when API_PROVIDER=lcms", async () => {
    stubRuntimeConfig({
      API_PROVIDER: "lcms",
      LCMS_API_BASE_URL: "http://lcms.test",
    });
    const calls = stubFetch();

    const subjects = await fetchSubjects();

    expect(calls.some((u) => u.includes("/api/v1/catalog/subjects"))).toBe(
      false,
    );
    // code must equal the LCMS subject code — it is matched against
    // BookListItem.subject_code in catalog filters.
    expect(subjects).toEqual([
      { code: "am-nhac", label: "Âm nhạc", order: 0 },
      { code: "tieng-viet", label: "Tiếng Việt", order: 1 },
    ]);
  });

  it("fetchLevels keeps calling the legacy endpoint when provider is legacy", async () => {
    stubRuntimeConfig({
      API_PROVIDER: "legacy",
      CATALOG_API_BASE_URL: "http://legacy.test",
    });
    const calls = stubFetch();

    const levels = await fetchLevels();

    // Base URL must be read at call time (runtime /config.js loads after the
    // bundle), not captured at module load.
    expect(calls).toEqual(["http://legacy.test/api/v1/catalog/levels"]);
    expect(levels).toEqual([{ code: "1", label: "Lớp 1", order: 1 }]);
  });
});
