import { useState } from "react";
import { Crown, Check, Sparkles, Gift, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/core/ui/card";
import { Button } from "@/core/ui/button";
import { Skeleton } from "@/core/ui/skeleton";
import { safeHttpUrl } from "@/core/lib/security";
import {
  usePlans,
  useSubscription,
  useStartTrial,
  usePurchasePremium,
} from "@/modules/student/api/hooks";
import type { BillingPlan } from "@/modules/student/api/premiumApi";

const currencyFmt = new Intl.NumberFormat("vi-VN");

function formatDate(iso: string | null): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

const MONTH_OPTIONS = [1, 3, 6, 12];

export function StudentPremiumPage() {
  const { data: sub, isLoading: subLoading } = useSubscription();
  const { data: plansData, isLoading: plansLoading } = usePlans();
  const trial = useStartTrial();
  const purchase = usePurchasePremium();
  const [months, setMonths] = useState(1);

  const premiumPlan = plansData?.plans.find((p) => p.code === "premium");
  const pricePerMonth = premiumPlan?.price_per_month ?? 0;

  const onTrial = () => {
    trial.mutate(undefined, {
      onSuccess: (r) =>
        toast.success(`Đã kích hoạt dùng thử Premium tới ${formatDate(r.expires_at)}.`),
      onError: (e) => toast.error(e.message),
    });
  };

  const onPurchase = () => {
    purchase.mutate(months, {
      onSuccess: (intent) => {
        toast.success("Đã tạo yêu cầu thanh toán.");
        // Cổng thanh toán thật đang tích hợp — mở trang checkout (stub) ở tab mới.
        // Chỉ mở URL http(s) hợp lệ (chặn javascript:/data: từ payload API).
        const checkoutUrl = safeHttpUrl(intent.checkout_url);
        if (checkoutUrl) {
          window.open(checkoutUrl, "_blank", "noopener,noreferrer");
        }
      },
      onError: (e) => toast.error(e.message),
    });
  };

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-8 space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold flex items-center gap-2">
          <Crown className="text-warning" /> Nâng cấp Premium
        </h1>
        <p className="text-muted-foreground">
          Mở khoá phân tích AI và lộ trình học thích ứng nâng cao
        </p>
      </div>

      {/* Trạng thái gói hiện tại */}
      {subLoading ? (
        <Skeleton className="h-20 rounded-xl" />
      ) : sub ? (
        <Card
          className={`p-5 border-2 ${
            sub.is_premium ? "border-warning bg-warning/5" : "border-border"
          }`}
        >
          {sub.is_premium ? (
            <div className="flex items-center gap-2">
              <Sparkles className="text-warning" />
              <span className="font-bold">
                Bạn đang dùng Premium
                {sub.expires_at ? ` — đến ${formatDate(sub.expires_at)}` : ""}
                {sub.source === "trial" ? " (dùng thử)" : ""}
              </span>
            </div>
          ) : (
            <span className="font-bold">Bạn đang dùng gói Free</span>
          )}
        </Card>
      ) : null}

      {/* So sánh gói */}
      {plansLoading ? (
        <div className="grid sm:grid-cols-2 gap-4">
          <Skeleton className="h-64 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {plansData?.plans.map((plan: BillingPlan) => {
            const isPremium = plan.code === "premium";
            return (
              <Card
                key={plan.code}
                className={`p-6 border-2 flex flex-col gap-3 ${
                  isPremium ? "border-warning" : ""
                }`}
              >
                <div className="flex items-center gap-2">
                  {isPremium && <Crown className="size-5 text-warning" />}
                  <span className="font-display font-bold text-xl">
                    {plan.name}
                  </span>
                </div>
                <div className="font-display text-2xl font-bold">
                  {plan.price_per_month === 0
                    ? "Miễn phí"
                    : `${currencyFmt.format(plan.price_per_month)} ${plansData?.currency}/tháng`}
                </div>
                <ul className="space-y-2 flex-1">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm">
                      <Check className="size-4 text-success shrink-0 mt-0.5" />
                      {f}
                    </li>
                  ))}
                </ul>
              </Card>
            );
          })}
        </div>
      )}

      {/* Hành động nâng cấp — chỉ khi chưa Premium */}
      {sub && !sub.is_premium && (
        <Card className="p-6 border-2 space-y-5">
          {sub.trial_eligible && (
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
              <div className="flex items-center gap-2">
                <Gift className="text-fun" />
                <span className="font-semibold">
                  Dùng thử Premium {plansData?.trial_days ?? 7} ngày miễn phí
                </span>
              </div>
              <Button
                variant="outline"
                disabled={trial.isPending}
                onClick={onTrial}
              >
                Dùng thử miễn phí
              </Button>
            </div>
          )}

          <div className="space-y-3">
            <div className="font-semibold">Mua Premium</div>
            <div className="flex flex-wrap items-center gap-2">
              {MONTH_OPTIONS.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMonths(m)}
                  className={`px-3 py-1.5 rounded-xl border-2 text-sm font-bold cursor-pointer ${
                    months === m
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card hover:border-primary"
                  }`}
                >
                  {m} tháng
                </button>
              ))}
            </div>
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <span className="text-lg font-bold">
                Tổng: {currencyFmt.format(pricePerMonth * months)}{" "}
                {plansData?.currency}
              </span>
              <Button disabled={purchase.isPending} onClick={onPurchase}>
                <ExternalLink className="size-4 mr-1.5" /> Nâng cấp Premium
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Cổng thanh toán đang được tích hợp — bạn sẽ được chuyển tới trang
              thanh toán để hoàn tất.
            </p>
          </div>
        </Card>
      )}
    </div>
  );
}
