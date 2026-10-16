import { useState } from "react";
import { KeyRound } from "lucide-react";
import { Button } from "@/core/ui/button";
import { Input } from "@/core/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/core/ui/dialog";
import { getDigitizedExercisePassHash } from "@/core/api/config";

/** Hash SHA-256 hex của input — ưu tiên Web Crypto API, fallback thuần JS. */
async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  // Web Crypto chỉ có ở secure context (HTTPS / localhost). Trên HTTP thuần
  // (vd nginx listen 8081 không TLS) `crypto.subtle` là undefined → dùng
  // fallback thuần JS để gate vẫn hoạt động.
  if (typeof crypto !== "undefined" && crypto.subtle) {
    const buf = await crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }
  return sha256Pure(bytes);
}

/** SHA-256 thuần JS — dùng khi `crypto.subtle` không khả dụng (HTTP). */
function sha256Pure(bytes: Uint8Array): string {
  const K = new Uint32Array([
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1,
    0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
    0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786,
    0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147,
    0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
    0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b,
    0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
    0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
    0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ]);
  const H = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ]);
  const rr = (n: number, x: number) => (x >>> n) | (x << (32 - n));
  const bitLen = bytes.length * 8;
  const padded = new Uint8Array(Math.ceil((bytes.length + 9) / 64) * 64);
  padded.set(bytes);
  padded[bytes.length] = 0x80;
  const view = new DataView(padded.buffer);
  // 64-bit big-endian length — input ngắn (< 2^32 bit) nên high word = 0.
  view.setUint32(padded.length - 8, 0, false);
  view.setUint32(padded.length - 4, bitLen >>> 0, false);
  const W = new Uint32Array(64);
  for (let i = 0; i < padded.length; i += 64) {
    for (let t = 0; t < 16; t++) {
      W[t] = view.getUint32(i + t * 4, false);
    }
    for (let t = 16; t < 64; t++) {
      const s0 = rr(7, W[t - 15]) ^ rr(18, W[t - 15]) ^ (W[t - 15] >>> 3);
      const s1 = rr(17, W[t - 2]) ^ rr(19, W[t - 2]) ^ (W[t - 2] >>> 10);
      W[t] = (W[t - 16] + s0 + W[t - 7] + s1) >>> 0;
    }
    let [a, b, c, d, e, f, g, h] = H;
    for (let t = 0; t < 64; t++) {
      const S1 = rr(6, e) ^ rr(11, e) ^ rr(25, e);
      const ch = (e & f) ^ (~e & g);
      const t1 = (h + S1 + ch + K[t] + W[t]) >>> 0;
      const S0 = rr(2, a) ^ rr(13, a) ^ rr(22, a);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + maj) >>> 0;
      h = g;
      g = f;
      f = e;
      e = (d + t1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (t1 + t2) >>> 0;
    }
    H[0] = (H[0] + a) >>> 0;
    H[1] = (H[1] + b) >>> 0;
    H[2] = (H[2] + c) >>> 0;
    H[3] = (H[3] + d) >>> 0;
    H[4] = (H[4] + e) >>> 0;
    H[5] = (H[5] + f) >>> 0;
    H[6] = (H[6] + g) >>> 0;
    H[7] = (H[7] + h) >>> 0;
  }
  return Array.from(H)
    .map((x) => x.toString(16).padStart(8, "0"))
    .join("");
}

interface DigitizedExercisePassDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Gọi khi nhập ĐÚNG mật khẩu — cha đóng modal rồi chạy hành động bị chặn. */
  onVerified: () => void;
}

/**
 * Gate mật khẩu cho nội dung tự số hóa — chặn trước khi mở runner bài tập
 * nâng cao. So sánh SHA-256(input) với hash cấu hình qua env
 * `VITE_DIGITIZED_EXERCISE_PASS_HASH` — mật khẩu plain text KHÔNG xuất hiện
 * trong bundle.
 *
 * KHÔNG nhớ trạng thái đã nhập — mỗi lần mount phải nhập lại.
 *
 * Lưu ý: gate ở frontend vẫn bypass được (DevTools, sửa hàm so sánh, gọi
 * thẳng component runner). Hash chỉ ngăn tìm mật khẩu bằng cách đọc source.
 */
export function DigitizedExercisePassDialog({
  open,
  onOpenChange,
  onVerified,
}: DigitizedExercisePassDialogProps) {
  const [pass, setPass] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const close = (nextOpen: boolean) => {
    if (!nextOpen) {
      setPass("");
      setError(null);
    }
    onOpenChange(nextOpen);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const expected = getDigitizedExercisePassHash();
    if (!expected) {
      // Không cấu hình hash → bỏ qua gate (an toàn hơn là khoá cứng).
      onVerified();
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const actual = await sha256Hex(pass);
      if (actual !== expected) {
        setError("Mật khẩu chưa đúng. Em kiểm tra lại nhé.");
        return;
      }
      setPass("");
      onVerified();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="size-5 text-primary" /> THÔNG BÁO
          </DialogTitle>
          <DialogDescription>
            Bài tập nâng cao yêu cầu mật khẩu. Vui lòng nhập mã để tiếp tục.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <Input
            type="password"
            value={pass}
            onChange={(e) => {
              setPass(e.target.value);
              setError(null);
            }}
            placeholder="Mật khẩu"
            autoFocus
            aria-label="Mật khẩu bài tập nâng cao"
            disabled={busy}
          />
          {error && (
            <p className="text-sm font-medium text-destructive">{error}</p>
          )}
          <Button
            type="submit"
            className="w-full rounded-full font-bold"
            disabled={busy || pass.length === 0}
          >
            {busy ? "Đang kiểm tra…" : "Xác nhận"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
