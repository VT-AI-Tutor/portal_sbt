import { ShoppingBag, Coins, Check } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/core/ui/card";
import { Button } from "@/core/ui/button";
import { Skeleton } from "@/core/ui/skeleton";
import {
  useShopItems,
  useRedeemItem,
  useEquipItem,
  useUnequipItem,
} from "@/modules/student/api/hooks";
import {
  STREAK_FREEZE_HOLD_MAX,
  type ShopItem,
  type ShopItemType,
} from "@/modules/student/api/shopApi";

const numberFormatter = new Intl.NumberFormat("vi-VN");

/** NhÃ£n nhÃ³m tiáº¿ng Viá»‡t theo item_type; thá»© tá»± hiá»ƒn thá»‹. */
const GROUP_ORDER: { type: ShopItemType; label: string }[] = [
  { type: "streak_freeze", label: "ÄÃ³ng bÄƒng chuá»—i" },
  { type: "cosmetic", label: "Trang phá»¥c" },
  { type: "accessory", label: "Phá»¥ kiá»‡n" },
  { type: "frame", label: "Khung há»“ sÆ¡" },
];

export function StudentShopPage() {
  const { data, isLoading, isError } = useShopItems();
  const redeem = useRedeemItem();
  const equip = useEquipItem();
  const unequip = useUnequipItem();

  const coins = data?.coins ?? 0;

  const onRedeem = (item: ShopItem) => {
    redeem.mutate(item.code, {
      onSuccess: (r) =>
        toast.success(`ÄÃ£ Ä‘á»•i "${item.name}" â€” trá»« ${r.coins_spent} xu.`),
      onError: (err) => toast.error(err.message),
    });
  };

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-8 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-3xl font-bold flex items-center gap-2">
            <ShoppingBag className="text-primary" /> Cá»­a hÃ ng
          </h1>
          <p className="text-muted-foreground">
            DÃ¹ng xu Ä‘á»•i váº­t pháº©m trang trÃ­ vÃ  Ä‘Ã³ng bÄƒng chuá»—i
          </p>
        </div>
        <div className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-warning/20 text-warning font-bold">
          <Coins className="size-5" /> {numberFormatter.format(coins)} xu
        </div>
      </div>

      {isLoading && (
        <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-36 rounded-xl" />
          ))}
        </div>
      )}

      {isError && (
        <Card className="p-5 border-2 text-center text-muted-foreground">
          KhÃ´ng táº£i Ä‘Æ°á»£c cá»­a hÃ ng. Vui lÃ²ng thá»­ láº¡i sau.
        </Card>
      )}

      {!isLoading && !isError && data && (
        <div className="space-y-8">
          {GROUP_ORDER.map(({ type, label }) => {
            const items = data.items.filter((i) => i.item_type === type);
            if (items.length === 0) return null;
            return (
              <section key={type} className="space-y-3">
                <h2 className="font-display font-bold text-lg">{label}</h2>
                <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {items.map((item) => {
                    const owned = item.owned_quantity;
                    const notEnough = coins < item.coin_price;
                    const freezeCapped =
                      item.item_type === "streak_freeze" &&
                      owned >= STREAK_FREEZE_HOLD_MAX;
                    const disabled =
                      redeem.isPending || notEnough || freezeCapped;
                    return (
                      <Card
                        key={item.code}
                        className="p-4 border-2 flex flex-col gap-2"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="font-bold">{item.name}</div>
                          {owned > 0 && (
                            <span className="inline-flex items-center gap-0.5 text-xs font-bold text-success shrink-0">
                              <Check className="size-3.5" /> ÄÃ£ cÃ³ Ã—{owned}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground flex-1">
                          {item.description}
                        </p>
                        <div className="flex items-center justify-between gap-2">
                          <span className="inline-flex items-center gap-1 font-bold text-warning">
                            <Coins className="size-4" /> {item.coin_price}
                          </span>
                          <div className="flex items-center gap-2">
                            {item.item_type !== "streak_freeze" &&
                              owned > 0 &&
                              (item.equipped ? (
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  disabled={unequip.isPending}
                                  onClick={() =>
                                    unequip.mutate(item.item_type, {
                                      onSuccess: () =>
                                        toast.success("ÄÃ£ bá» trang bá»‹."),
                                      onError: (e) => toast.error(e.message),
                                    })
                                  }
                                >
                                  Äang máº·c âœ“
                                </Button>
                              ) : (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  disabled={equip.isPending}
                                  onClick={() =>
                                    equip.mutate(item.code, {
                                      onSuccess: () =>
                                        toast.success(
                                          `ÄÃ£ trang bá»‹ "${item.name}".`,
                                        ),
                                      onError: (e) => toast.error(e.message),
                                    })
                                  }
                                >
                                  Trang bá»‹
                                </Button>
                              ))}
                            <Button
                              size="sm"
                              disabled={disabled}
                              onClick={() => onRedeem(item)}
                            >
                              {freezeCapped
                                ? "ÄÃ£ Ä‘á»§ 2 lÆ°á»£t"
                                : notEnough
                                  ? "Thiáº¿u xu"
                                  : "Äá»•i"}
                            </Button>
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
