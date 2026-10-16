/**
 * ShareCompletionDialog — hộp thoại "Chia sẻ hoàn thành bài tập".
 * Trái: ảnh xem trước (CompletionShareCard). Phải: tùy chọn hiển thị (ẩn/hiện
 * tên HS, điểm số) + thao tác (Chia sẻ / Tải ảnh / Sao chép liên kết).
 */
import { useEffect, useRef, useState } from "react";
import { toBlob, toPng } from "html-to-image";
import { toast } from "sonner";
import { Copy, Download, Facebook, Info, Share2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/core/ui/dialog";
import { Button } from "@/core/ui/button";
import { Switch } from "@/core/ui/switch";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/core/ui/dropdown-menu";
import { CompletionShareCard } from "@/modules/books/ui/shared/CompletionShareCard";

interface ShareCompletionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Tên bài tập / bài học. */
  title: string;
  /** Tên đầy đủ của HS (từ auth). Dùng để tạo chữ viết tắt. */
  studentName?: string | null;
  /** Thời điểm nộp (ISO). */
  submittedAt: string;
  /** Điểm; null khi bài chưa/không có điểm. */
  score?: number | null;
  /** Điểm tối đa. */
  maxScore?: number | null;
  /** Bài đang CHỜ CHẤM: không hiển thị điểm dù có score tạm (QA SBT_2 C32). */
  pending?: boolean;
  /** Link công khai tới bài học để người nhận mở được. */
  shareUrl: string;
}

/** "Hoàng Nguyên" → "H.N." · "hoanguyen" → "H." */
function toInitials(name: string | null | undefined): string {
  if (!name) return "";
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "";
  return words
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .filter(Boolean)
    .map((c) => `${c}.`)
    .join("");
}

/**
 * Sao chép văn bản, có đường lùi cho HTTP thuần. `navigator.clipboard` chỉ tồn
 * tại ở secure context (https/localhost); môi trường test (http://10.60.…) không
 * có → phải dùng textarea + execCommand để "Sao chép liên kết" vẫn chạy được.
 */
async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // rơi xuống đường lùi execCommand
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

function formatSubmittedAt(iso: string): string {
  try {
    const d = new Date(iso);
    const time = new Intl.DateTimeFormat("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
    }).format(d);
    const date = new Intl.DateTimeFormat("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(d);
    return `${time} - ${date}`;
  } catch {
    return iso;
  }
}

export function ShareCompletionDialog({
  open,
  onOpenChange,
  title,
  studentName,
  submittedAt,
  score,
  maxScore,
  pending = false,
  shareUrl,
}: ShareCompletionDialogProps) {
  // Bài chờ chấm KHÔNG được khoe điểm (kể cả khi server trả score tạm).
  const hasScore = score !== null && score !== undefined && !pending;
  const [showName, setShowName] = useState(true);
  const [showScore, setShowScore] = useState(hasScore);
  const [downloading, setDownloading] = useState(false);
  // Môi trường QA hay chạy HTTP không bảo mật / trong iframe → cả
  // navigator.clipboard lẫn execCommand("copy") bị chặn, copy âm thầm no-op
  // (đích paste rỗng = "null"). Khi đó lộ liên kết ra input read-only để chép
  // tay, thay vì chỉ báo lỗi rồi không có đường dẫn nào (SBT_4 #32).
  const [copyFailed, setCopyFailed] = useState(false);

  // Điểm được nạp bất đồng bộ (submissionDetail) nên có thể tới sau lần mount
  // đầu; đồng bộ mặc định công tắc mỗi khi mở lại hộp thoại. Reset cả copyFailed
  // (dialog không unmount giữa các lần mở).
  useEffect(() => {
    if (open) {
      setShowScore(hasScore);
      setCopyFailed(false);
    }
  }, [open, hasScore]);

  const cardRef = useRef<HTMLDivElement>(null);
  // Ảnh thẻ được tạo SẴN khi mở hộp thoại: Web Share (đính kèm tệp) cần
  // user-activation, nếu tạo ảnh bất đồng bộ SAU cú bấm sẽ mất activation trên
  // một số trình duyệt → chuẩn bị trước để lúc bấm chia sẻ được ngay.
  const imageFileRef = useRef<File | null>(null);

  const initials = toInitials(studentName);
  const submittedAtLabel = formatSubmittedAt(submittedAt);
  const scoreLabel =
    showScore && hasScore ? `${score} / ${maxScore ?? "?"}` : null;

  // Chỉ chuẩn bị ảnh khi thiết bị hỗ trợ chia sẻ kèm tệp (chủ yếu là mobile) —
  // tạo lại mỗi khi nội dung thẻ đổi (đổi công tắc tên/điểm).
  useEffect(() => {
    if (!open || typeof navigator === "undefined" || !navigator.canShare)
      return;
    let cancelled = false;
    imageFileRef.current = null;
    // Chờ thẻ render xong theo trạng thái công tắc rồi mới chụp.
    const id = window.setTimeout(async () => {
      if (!cardRef.current) return;
      try {
        const blob = await toBlob(cardRef.current, {
          pixelRatio: 2,
          cacheBust: true,
        });
        if (!cancelled && blob) {
          imageFileRef.current = new File([blob], "hoan-thanh-bai-tap.png", {
            type: "image/png",
          });
        }
      } catch {
        imageFileRef.current = null;
      }
    }, 200);
    return () => {
      cancelled = true;
      window.clearTimeout(id);
    };
    // showName phải có mặt: bật/tắt tên đổi nội dung thẻ nhưng initials không đổi
    // theo nó — thiếu thì ảnh "Chia sẻ kèm ảnh" giữ tên đã tắt (lộ tên đã ẩn).
  }, [open, title, initials, submittedAtLabel, scoreLabel, showName]);

  async function handleShare() {
    const text = `Em đã hoàn thành bài tập "${title}" 🎉`;
    // Nhúng link vào nội dung để bài đăng LUÔN có liên kết công khai — nhiều app
    // bỏ qua trường `url` khi chia sẻ kèm tệp, nên đưa link vào `text` mới chắc.
    const textWithLink = `${text}\n${shareUrl}`;
    const file = imageFileRef.current;

    // Ưu tiên chia sẻ KÈM ẢNH qua share sheet của thiết bị (đính kèm được ảnh
    // sang Facebook/Zalo/Messenger trên mobile).
    if (
      file &&
      typeof navigator !== "undefined" &&
      navigator.canShare?.({ files: [file] })
    ) {
      try {
        await navigator.share({ files: [file], text: textWithLink });
      } catch (err) {
        if ((err as Error)?.name !== "AbortError") await handleCopyLink();
      }
      return;
    }

    // Không đính kèm được ảnh (desktop…) → chia sẻ link, hoặc sao chép.
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: "Chia sẻ hoàn thành bài tập",
          text,
          url: shareUrl,
        });
      } catch (err) {
        // AbortError = người dùng chủ động hủy → im lặng.
        if ((err as Error)?.name !== "AbortError") await handleCopyLink();
      }
      return;
    }
    await handleCopyLink();
  }

  function handleFacebookShare() {
    const url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(
      shareUrl,
    )}`;
    window.open(url, "_blank", "noopener,noreferrer,width=600,height=500");
  }

  async function handleCopyLink() {
    if (await copyText(shareUrl)) {
      setCopyFailed(false);
      toast.success("Đã sao chép liên kết");
    } else {
      setCopyFailed(true);
      toast.error("Không sao chép được — hãy chép liên kết bên dưới");
    }
  }

  async function handleDownload() {
    if (!cardRef.current) return;
    setDownloading(true);
    try {
      const dataUrl = await toPng(cardRef.current, {
        pixelRatio: 2,
        cacheBust: true,
      });
      const link = document.createElement("a");
      link.download = `hoan-thanh-bai-tap-${Date.now()}.png`;
      link.href = dataUrl;
      link.click();
      toast.success("Đã tải ảnh");
    } catch {
      toast.error("Không tạo được ảnh");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Share2 className="size-5 text-primary" />
            Chia sẻ hoàn thành bài tập
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-6 sm:grid-cols-2">
          {/* Ảnh xem trước */}
          <div className="space-y-2">
            <p className="text-sm font-semibold text-muted-foreground">
              Ảnh xem trước
            </p>
            <CompletionShareCard
              ref={cardRef}
              title={title}
              initials={showName ? initials : null}
              name={showName ? (studentName ?? null) : null}
              submittedAtLabel={submittedAtLabel}
              scoreLabel={scoreLabel}
            />
          </div>

          {/* Tùy chọn + thao tác */}
          <div className="flex flex-col gap-5">
            <div className="space-y-3">
              <p className="text-sm font-semibold text-muted-foreground">
                Tùy chọn hiển thị
              </p>

              <label className="flex items-start justify-between gap-3 rounded-xl border border-border p-3">
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-foreground">
                    Hiển thị tên học sinh
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {studentName
                      ? `Hiển thị họ tên: ${studentName}`
                      : "Chưa có tên học sinh"}
                  </span>
                </span>
                <Switch
                  checked={showName}
                  onCheckedChange={setShowName}
                  disabled={!studentName}
                />
              </label>

              <label className="flex items-start justify-between gap-3 rounded-xl border border-border p-3">
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-foreground">
                    Hiển thị điểm số
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {pending
                      ? "Bài đang chờ chấm — chưa hiển thị điểm"
                      : hasScore
                        ? `Điểm của bài: ${score} / ${maxScore ?? "?"}`
                        : "Bài này không có điểm hiển thị"}
                  </span>
                </span>
                <Switch
                  checked={showScore}
                  onCheckedChange={setShowScore}
                  disabled={!hasScore}
                />
              </label>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-semibold text-muted-foreground">
                Thao tác
              </p>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button type="button" className="w-full gap-2 rounded-xl">
                    <Share2 className="size-4" />
                    Chia sẻ
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-56">
                  <DropdownMenuItem onSelect={handleFacebookShare}>
                    <Facebook className="size-4 text-[#1877F2]" />
                    Facebook
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={handleShare}>
                    <Share2 className="size-4" />
                    Chia sẻ kèm ảnh (Zalo, Messenger…)
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button
                type="button"
                variant="outline"
                className="w-full gap-2 rounded-xl"
                onClick={handleDownload}
                disabled={downloading}
              >
                <Download className="size-4" />
                {downloading ? "Đang tạo ảnh…" : "Tải ảnh"}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full gap-2 rounded-xl"
                onClick={handleCopyLink}
              >
                <Copy className="size-4" />
                Sao chép liên kết
              </Button>
            </div>

            {copyFailed && (
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">
                  Sao chép liên kết thủ công:
                </p>
                <input
                  type="text"
                  readOnly
                  aria-label="Liên kết chia sẻ"
                  value={shareUrl}
                  onFocus={(e) => e.currentTarget.select()}
                  className="w-full rounded-xl border border-border/60 bg-muted/40 px-3 py-2 text-xs"
                />
              </div>
            )}

            <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
              <Info className="mt-0.5 size-3.5 shrink-0" />
              <span>
                Facebook chỉ chia sẻ liên kết. Để đăng kèm ảnh thành tích, dùng
                “Chia sẻ kèm ảnh” trên điện thoại, hoặc “Tải ảnh” rồi đăng lên
                Facebook thủ công.
              </span>
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
