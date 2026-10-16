/**
 * Thẻ "Gói của tôi" trong trang Hồ sơ — lối vào Premium sau khi mục "Nâng cấp
 * Premium" rời khỏi menu chính (Owner 17/8).
 *
 * Chỉ TÓM TẮT: đang dùng gói nào, hạn tới đâu, và hai lối đi tiếp — dùng thử
 * (kích hoạt ngay tại chỗ vì chỉ một cú bấm) hoặc mở trang Premium để so sánh
 * gói và chọn số tháng. Toàn bộ phễu mua vẫn ở /student/profile/premium, thẻ này không
 * chép lại.
 */
import { Link } from "react-router-dom";
import { Crown, Gift, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/core/ui/card";
import { Button } from "@/core/ui/button";
import { Skeleton } from "@/core/ui/skeleton";
import {
  usePlans,
  useStartTrial,
  useSubscription,
} from "@/modules/student/api/hooks";

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

export function PremiumSummaryCard() {
  const { data: sub, isLoading } = useSubscription();
  const { data: plansData } = usePlans();
  const trial = useStartTrial();

  if (isLoading) return <Skeleton className="h-28 rounded-xl" />;
  // Truy vấn lỗi (mạng, hết phiên) → không đoán bừa là Free rồi mời nâng cấp;
  // giấu thẻ đi, phần còn lại của Hồ sơ vẫn dùng bình thường.
  if (!sub) return null;

  const pricePerMonth =
    plansData?.plans.find((p) => p.code === "premium")?.price_per_month ?? 0;

  const onTrial = () => {
    trial.mutate(undefined, {
      onSuccess: (r) =>
        toast.success(
          `Đã kích hoạt dùng thử Premium tới ${formatDate(r.expires_at)}.`,
        ),
      onError: (e) => toast.error(e.message),
    });
  };

  return (
    <Card
      className={`p-6 border-2 space-y-4 ${sub.is_premium ? "border-warning bg-warning/5" : ""}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {sub.is_premium ? (
            <Sparkles className="size-5 text-warning" />
          ) : (
            <Crown className="size-5 text-warning" />
          )}
          <span className="font-display text-xl font-bold">Gói của tôi</span>
        </div>
        <Button asChild variant={sub.is_premium ? "outline" : "default"}>
          <Link to="/student/profile/premium">
            {sub.is_premium ? "Xem gói" : "Nâng cấp Premium"}
          </Link>
        </Button>
      </div>

      {sub.is_premium ? (
        <p className="text-sm">
          <span className="font-bold">Em đang dùng Premium</span>
          {sub.source === "trial" ? " (bản dùng thử)" : ""}
          {sub.expires_at ? ` — đến ${formatDate(sub.expires_at)}` : ""}.
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">
          Em đang dùng gói Free.{" "}
          {pricePerMonth > 0 &&
            `Premium ${currencyFmt.format(pricePerMonth)} ${plansData?.currency ?? ""}/tháng — `}
          mở khoá phân tích AI và lộ trình học thích ứng nâng cao.
        </p>
      )}

      {!sub.is_premium && sub.trial_eligible && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-fun/10 p-3">
          <span className="flex items-center gap-2 text-sm font-semibold">
            <Gift className="size-4 text-fun" />
            Dùng thử {plansData?.trial_days ?? 7} ngày miễn phí
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={trial.isPending}
            onClick={onTrial}
          >
            Dùng thử miễn phí
          </Button>
        </div>
      )}
    </Card>
  );
}
