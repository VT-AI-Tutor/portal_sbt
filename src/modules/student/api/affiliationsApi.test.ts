import { describe, expect, it, vi, afterEach } from "vitest";
import { affiliationsApi } from "./affiliationsApi";

const mock = (body: unknown, ok = true) =>
  vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({ ok, json: async () => body } as Response);

afterEach(() => vi.restoreAllMocks());

describe("affiliationsApi", () => {
  it("declare posts school_org_unit_id and returns data", async () => {
    const spy = mock({ success: true, data: { membership_id: "m1", affiliation: "guest" } });
    const r = await affiliationsApi.declare("school-1", "tok");
    expect(r.affiliation).toBe("guest");
    const init = spy.mock.calls[0][1] as RequestInit;
    expect(init.body).toBe(JSON.stringify({ school_org_unit_id: "school-1" }));
  });

  it("list unwraps data", async () => {
    mock({ success: true, data: [{ membership_id: "m1", org_unit_id: "o1", org_unit_name: "Truong", org_unit_path: "p", member_type: "learner", affiliation: "guest" }] });
    const items = await affiliationsApi.list("tok");
    expect(items[0].org_unit_name).toBe("Truong");
  });

  it("declare surfaces 409 message", async () => {
    mock({ success: false, message: "đã liên kết", error_code: "ALREADY_AFFILIATED" }, false);
    await expect(affiliationsApi.declare("school-1", "tok")).rejects.toThrow(/liên kết/);
  });
});
