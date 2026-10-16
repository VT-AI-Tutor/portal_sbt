/**
 * Cửa hàng vật phẩm + nhiệm vụ ngày phía học sinh (GAME-R15..R18/R14). Dùng lại
 * `apiFetch` (tự gắn token, bóc `{success,data}`) từ practiceApi.
 */
import { apiFetch } from "./practiceApi";

export type ShopItemType = "cosmetic" | "accessory" | "frame" | "streak_freeze";

export interface ShopItem {
  id: string;
  code: string;
  name: string;
  description: string;
  item_type: ShopItemType;
  coin_price: number;
  sort_order: number;
  owned_quantity: number;
  /** Đang trang bị (cosmetic/accessory/frame). streak_freeze luôn false. */
  equipped?: boolean;
}

/** Map slot→item_code đang mặc: { cosmetic?, accessory?, frame? }. */
export type EquippedMap = Partial<Record<"cosmetic" | "accessory" | "frame", string>>;

export interface ShopCatalog {
  coins: number;
  equipped?: EquippedMap;
  items: ShopItem[];
}

export interface OwnedItem {
  item_code: string;
  quantity: number;
  acquired_at: string | null;
}

export interface RedeemResult {
  item_code: string;
  coins_spent: number;
  coins_balance: number;
}

export interface DailyQuest {
  key: string;
  title: string;
  target: number;
  progress: number;
  completed: boolean;
}

export interface DailyQuests {
  date: string;
  quests: DailyQuest[];
  bonus_rewarded: boolean;
  coins_per_quest: number;
  coins_full_set: number;
}

/** Vật phẩm đóng băng chuỗi — tự tiêu khi lỡ ngày, giữ tối đa 2 lượt (GAME-R14). */
export const STREAK_FREEZE_CODE = "streak-freeze";
export const STREAK_FREEZE_HOLD_MAX = 2;

export function getShopItems(): Promise<ShopCatalog> {
  return apiFetch<ShopCatalog>("/api/v1/student/shop/items");
}

export function getShopInventory(): Promise<OwnedItem[]> {
  return apiFetch<OwnedItem[]>("/api/v1/student/shop/inventory");
}

export function redeemItem(itemCode: string): Promise<RedeemResult> {
  return apiFetch<RedeemResult>("/api/v1/student/shop/redeem", {
    method: "POST",
    body: JSON.stringify({ item_code: itemCode }),
  });
}

export function equipItem(itemCode: string): Promise<{ equipped: EquippedMap }> {
  return apiFetch<{ equipped: EquippedMap }>("/api/v1/student/shop/equip", {
    method: "POST",
    body: JSON.stringify({ item_code: itemCode }),
  });
}

export function unequipItem(
  itemType: "cosmetic" | "accessory" | "frame",
): Promise<{ equipped: EquippedMap }> {
  return apiFetch<{ equipped: EquippedMap }>("/api/v1/student/shop/unequip", {
    method: "POST",
    body: JSON.stringify({ item_type: itemType }),
  });
}

export function getDailyQuests(): Promise<DailyQuests> {
  return apiFetch<DailyQuests>("/api/v1/student/quests/today");
}
