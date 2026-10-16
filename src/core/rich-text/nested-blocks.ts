import type { RichContent, RichContentBlock, RichTextRun } from '@/core/question-schema';

/**
 * Gỡ các khối bị lồng nhầm bên trong `content` của một khối văn bản.
 *
 * Đường GHI hỏng (AI edit / merge run) đôi khi nhét cả một mảng `blocks` con và
 * các run bị đánh số vào chỗ đáng lẽ là MẢNG run của đoạn văn:
 *
 * ```jsonc
 * { "type": "paragraph",
 *   "content": { "0": { "text": "b) …" }, "blocks": [ { "type": "image", "url": "…" } ] } }
 * ```
 *
 * Mọi đường đọc đều kiểm `Array.isArray(block.content)`, nên shape này làm MẤT
 * cả chữ (rơi về `block.text` rỗng) lẫn ẢNH (khối ảnh không nằm ở tầng
 * `content.blocks` mà bộ tìm ảnh quét) — ví dụ ô "b)" của bảng tích trong câu
 * `6a6042bbe35c670a1ada0063` hiện ra trống trơn.
 *
 * Bộ gỡ này chỉ chuẩn hoá HÌNH DẠNG khi đọc, không ghi gì: run được xếp lại
 * đúng thứ tự khoá số, còn khối con được nâng lên làm anh em NGAY SAU khối chủ —
 * nên ảnh vẫn nằm trong đúng ô/khối văn cảnh tác giả soạn, dù vị trí trong ô có
 * thể lệch so với bản in.
 *
 * Trả về đúng mảng gốc khi không có gì để gỡ (giữ tham chiếu cho React) và
 * idempotent: chạy lại trên kết quả cho ra chính nó.
 */
export function flattenNestedContentBlocks(blocks: unknown): RichContentBlock[] {
  if (!Array.isArray(blocks)) return [];
  let changed = false;
  const flattened = blocks.flatMap((raw) => {
    const block = raw as RichContentBlock;
    if (!block || typeof block !== 'object') {
      changed = true;
      return [];
    }

    if (Array.isArray(block.columns)) {
      const columns = block.columns.map((column) => flattenNestedContentBlocks(column));
      if (columns.some((column, i) => column !== block.columns?.[i])) {
        changed = true;
        return [{ ...block, columns } as RichContentBlock];
      }
      return [raw as RichContentBlock];
    }

    const misnested = misnestedContent(block.content);
    if (!misnested) return [raw as RichContentBlock];

    changed = true;
    const host: RichContentBlock = { ...block, content: misnested.runs };
    const keepHost = misnested.runs.length > 0 || String(block.text ?? '').trim() !== '';
    return [...(keepHost ? [host] : []), ...misnested.blocks];
  });
  return changed ? flattened : (blocks as RichContentBlock[]);
}

/** `content` của một khối văn bản, dạng object lồng nhầm — `null` nếu bình thường. */
function misnestedContent(
  content: RichContentBlock['content'],
): { runs: RichTextRun[]; blocks: RichContentBlock[] } | null {
  if (!content || typeof content !== 'object' || Array.isArray(content)) return null;
  const record = content as Record<string, unknown>;
  const runs = Object.keys(record)
    // Chỉ khoá số mới là run bị "object hoá"; mọi khoá khác (`blocks`, …) bỏ qua.
    .filter((key) => /^\d+$/.test(key))
    .sort((a, b) => Number(a) - Number(b))
    .map((key) => record[key])
    .filter((run): run is RichTextRun => Boolean(run) && typeof (run as RichTextRun).text === 'string');
  return { runs, blocks: flattenNestedContentBlocks(record.blocks) };
}

/** `content` với `blocks` đã gỡ lồng — giữ nguyên tham chiếu khi không đổi. */
export function flattenNestedRichContent<T extends RichContent | undefined | null>(content: T): T {
  if (!content || !Array.isArray(content.blocks)) return content;
  const blocks = flattenNestedContentBlocks(content.blocks);
  return blocks === content.blocks ? content : ({ ...content, blocks } as T);
}
