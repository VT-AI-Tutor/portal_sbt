import { describe, expect, it, vi, afterEach } from "vitest";
import {
  getNotifications,
  markNotificationRead,
  updateReminderPreferences,
} from "./notificationsApi";

const mock = (body: unknown, ok = true) =>
  vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValueOnce({ ok, json: async () => body } as Response);

afterEach(() => vi.restoreAllMocks());

describe("notificationsApi", () => {
  it("getNotifications lấy nguyên body (unread_count cạnh data)", async () => {
    // BE trả unread_count + pagination CẠNH data (không lồng) → raw body.
    const spy = mock({
      success: true,
      data: [{ id: "n1", title: "Hi", read: false, type: "general" }],
      unread_count: 1,
      pagination: { total: 1, page: 1, per_page: 20, last_page: 1 },
    });
    const list = await getNotifications();
    expect(list.unread_count).toBe(1);
    expect(list.data[0].id).toBe("n1");
    expect(spy.mock.calls[0][0]).toContain("/api/v1/notifications?page=1");
  });

  it("markNotificationRead PATCHes the id", async () => {
    const spy = mock({ success: true, data: null });
    await markNotificationRead("n1");
    expect(spy.mock.calls[0][0]).toContain("/api/v1/notifications/n1/read");
    expect((spy.mock.calls[0][1] as RequestInit).method).toBe("PATCH");
  });

  it("updateReminderPreferences sends disabled_types", async () => {
    const spy = mock({ success: true, data: { disabled_types: ["comeback"] } });
    const r = await updateReminderPreferences(["comeback"]);
    expect(r.disabled_types).toEqual(["comeback"]);
    const init = spy.mock.calls[0][1] as RequestInit;
    expect(init.method).toBe("PATCH");
    expect(init.body).toBe(JSON.stringify({ disabled_types: ["comeback"] }));
  });
});
