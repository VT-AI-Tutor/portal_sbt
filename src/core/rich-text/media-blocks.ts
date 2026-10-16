import type { RichContentBlock } from '@/core/question-schema';
import { resolveUploadMediaSrc } from '@/core/utils';

export function getBlockMediaUrl(block: RichContentBlock): string | null {
  const record = block as RichContentBlock & Record<string, unknown>;
  const url =
    (typeof block.url === 'string' && block.url.trim()) ||
    (typeof record.src === 'string' && record.src.trim()) ||
    '';
  return url || null;
}

/**
 * Web không có khái niệm "API origin fallback" kiểu studio — mọi URL đi qua
 * resolveAssetUrl (provider-aware). Giữ nguyên chữ ký [primary, fallback] để
 * code port từ studio dùng được không sửa.
 */
export function getUploadMediaSrcCandidates(storedUrl: string): [string, string] {
  const resolved = resolveUploadMediaSrc(storedUrl);
  return [resolved, resolved];
}
