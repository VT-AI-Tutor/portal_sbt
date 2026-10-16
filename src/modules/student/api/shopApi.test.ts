import { describe, expect, it, vi, afterEach } from "vitest";
import { getShopItems, redeemItem, getDailyQuests } from "./shopApi";

const mock = (body: unknown, ok = true) =>
  vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValueOnce({ ok, json: async () => body } as Response);

afterEach(() => vi.restoreAllMocks());

describe("shopApi", () => {
  it("getShopItems unwraps {coins, items}", async () => {
    const spy = mock({
      success: true,
      data: { coins: 120, items: [{ code: "cozzy-hat", coin_price: 80 }] },
    });
    const cat = await getShopItems();
    expect(cat.coins).toBe(120);
    expect(cat.items[0].code).toBe("cozzy-hat");
    expect(spy.mock.calls[0][0]).toContain("/api/v1/student/shop/items");
  });

  it("redeemItem POSTs item_code and unwraps result", async () => {
    const spy = mock({
      success: true,
      data: { item_code: "cozzy-hat", coins_spent: 80, coins_balance: 40 },
    });
    const r = await redeemItem("cozzy-hat");
    expect(r.coins_balance).toBe(40);
    const init = spy.mock.calls[0][1] as RequestInit;
    expect(init.method).toBe("POST");
    expect(init.body).toBe(JSON.stringify({ item_code: "cozzy-hat" }));
  });

  it("redeemItem surfaces BE conflict message (không đủ xu)", async () => {
    mock(
      { success: false, message: "Không đủ xu để đổi vật phẩm này.", error_code: "CONFLICT" },
      false,
    );
    await expect(redeemItem("frame-gold")).rejects.toThrow(/Không đủ xu/);
  });

  it("getDailyQuests unwraps quests", async () => {
    mock({
      success: true,
      data: { date: "2026-07-23", quests: [{ key: "keep_streak", title: "Giữ chuỗi", target: 1, progress: 0, completed: false }], bonus_rewarded: false, coins_per_quest: 5, coins_full_set: 10 },
    });
    const q = await getDailyQuests();
    expect(q.quests[0].key).toBe("keep_streak");
    expect(q.coins_full_set).toBe(10);
  });
});
