import { useState } from "react";
import { Card } from "@/core/ui/card";
import { Button } from "@/core/ui/button";
import { Skeleton } from "@/core/ui/skeleton";
import { useAuth } from "@/core/auth/AuthContext";
import { ProfileEditForm } from "@/app/layout/ProfileEditForm";
import { buildStudentSubtitle } from "@/app/layout/buildStudentSubtitle";
import {
  useGamificationSummary,
  useShopItems,
} from "@/modules/student/api/hooks";
import { PremiumSummaryCard } from "@/modules/student/ui/student/PremiumSummaryCard";
import { MySchoolSection } from "@/modules/student/ui/student/MySchoolSection";
import { ReminderSettingsCard } from "@/modules/student/ui/student/ReminderSettingsCard";

const numberFormatter = new Intl.NumberFormat("vi-VN");

export function StudentProfilePage() {
  const { user } = useAuth();
  // Owner 17/8: bấm "Chỉnh sửa" mở khu sửa NGAY trong thẻ, không bật dialog —
  // trên màn hình nhỏ hộp thoại che mất phần còn lại của hồ sơ.
  const [editing, setEditing] = useState(false);
  const { data: summary, isLoading: summaryLoading, isError: summaryIsError } =
    useGamificationSummary();
  const { data: shop } = useShopItems();

  const resolveItemName = (code?: string) =>
    code ? shop?.items.find((i) => i.code === code)?.name ?? code : undefined;

  const equipped = summary?.equipped;
  const frameCode = equipped?.frame;
  const frameRingMap: Record<string, string> = {
    "frame-gold": "ring-4 ring-yellow-400",
    "frame-leaf": "ring-4 ring-green-500",
  };
  const frameRing = frameCode
    ? `${frameRingMap[frameCode] ?? "ring-4 ring-primary"} ring-offset-2 ring-offset-background`
    : "";
  const equippedNames = equipped
    ? [
        resolveItemName(equipped.cosmetic),
        resolveItemName(equipped.accessory),
        resolveItemName(equipped.frame),
      ].filter(Boolean)
    : [];

  const displayName = user?.full_name ?? user?.name ?? user?.email ?? "Học sinh";
  const subtitle = buildStudentSubtitle({
    class_name: user?.class_name,
    level: user?.level as string | undefined,
    school_name: user?.school_name as string | undefined,
    email: user?.email,
  });
  const province = user?.province as string | undefined;

  return (
    <div className="max-w-3xl mx-auto p-4 md:p-8 space-y-5">
      <h1 className="font-display text-3xl font-bold">👤 Hồ sơ</h1>
      <Card className="p-6 border-2 flex flex-col sm:flex-row items-center gap-5">
        <div
          className={`size-24 rounded-full bg-gradient-to-br from-primary to-fun flex items-center justify-center text-primary-foreground text-4xl font-display font-bold ${frameRing}`}
        >
          {displayName.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 text-center sm:text-left">
          <div className="font-display text-2xl font-bold">{displayName}</div>
          <div className="text-muted-foreground">
            {[subtitle, province].filter(Boolean).join(" · ")}
          </div>
          {equippedNames.length > 0 && (
            <div className="mt-1 text-sm text-muted-foreground">
              Đang mặc: {equippedNames.join(" · ")}
            </div>
          )}
          <div className="mt-2 flex flex-wrap justify-center sm:justify-start gap-2">
            {summaryLoading && (
              <>
                <Skeleton className="h-6 w-20 rounded-full" />
                <Skeleton className="h-6 w-20 rounded-full" />
                <Skeleton className="h-6 w-20 rounded-full" />
              </>
            )}
            {!summaryLoading && !summaryIsError && summary && (
              <>
                <Badge label={`🔥 Streak ${numberFormatter.format(summary.streak_current)}`} />
                <Badge label={`⭐ ${numberFormatter.format(summary.xp)} XP`} />
                <Badge label={`🪙 ${numberFormatter.format(summary.coins)} xu`} />
              </>
            )}
          </div>
        </div>
        {!editing && (
          <Button
            variant="outline"
            className="rounded-full"
            onClick={() => setEditing(true)}
          >
            Chỉnh sửa
          </Button>
        )}
      </Card>

      {editing && (
        <Card className="p-6 border-2 space-y-4">
          <div className="font-display text-xl font-bold">Chỉnh sửa hồ sơ</div>
          <ProfileEditForm
            // Mỗi lần mở lại khu sửa thì nạp lại giá trị đang lưu, không giữ thứ
            // đã gõ dở rồi bấm Huỷ lần trước.
            resetKey={editing}
            onSaved={() => setEditing(false)}
            onCancel={() => setEditing(false)}
          />
        </Card>
      )}

      <PremiumSummaryCard />

      <MySchoolSection />

      <ReminderSettingsCard />

    </div>
  );
}

function Badge({ label }: { label: string }) {
  return (
    <span className="text-xs px-3 py-1 rounded-full bg-secondary font-bold">
      {label}
    </span>
  );
}
