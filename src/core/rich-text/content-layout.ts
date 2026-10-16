import type { LucideIcon } from 'lucide-react';
import {
  AlignVerticalSpaceAround,
  Columns2,
  GalleryHorizontal,
  ImageDown,
  PanelLeft,
  PanelRight,
  PanelTop,
  Rows3,
} from 'lucide-react';
import type { ContentLayout, RichContent, RichContentBlock } from '@/core/question-schema';

export type { ContentLayout } from '@/core/question-schema';

export const DEFAULT_CONTENT_LAYOUT: ContentLayout = 'stack';

export interface ContentLayoutOption {
  id: ContentLayout;
  label: string;
  shortLabel: string;
  description: string;
  icon: LucideIcon;
}

export const CONTENT_LAYOUT_OPTIONS: ContentLayoutOption[] = [
  {
    id: 'stack',
    label: 'Dọc (mặc định)',
    shortLabel: 'Dọc',
    description: 'Các khối xếp dọc theo thứ tự — không nhóm cột',
    icon: Rows3,
  },
  {
    id: 'image-left',
    label: 'Ảnh trái · Chữ phải',
    shortLabel: 'Ảnh trái',
    description: 'Tạo khối layout 2 cột: media trái, chữ phải',
    icon: PanelLeft,
  },
  {
    id: 'image-right',
    label: 'Chữ trái · Ảnh phải',
    shortLabel: 'Ảnh phải',
    description: 'Tạo khối layout 2 cột: chữ trái, media phải',
    icon: PanelRight,
  },
  {
    id: 'image-top',
    label: 'Ảnh trên · Chữ dưới',
    shortLabel: 'Ảnh trên',
    description: 'Sắp xếp khối: toàn bộ media trước, rồi chữ',
    icon: PanelTop,
  },
  {
    id: 'image-bottom',
    label: 'Chữ trên · Ảnh dưới',
    shortLabel: 'Ảnh dưới',
    description: 'Sắp xếp khối: chữ trước, rồi toàn bộ media',
    icon: ImageDown,
  },
  {
    id: 'two-column',
    label: 'Hai cột văn bản',
    shortLabel: '2 cột',
    description: 'Khối layout 2 cột chữ (media full width phía trên nếu có)',
    icon: Columns2,
  },
  {
    id: 'media-grid',
    label: 'Lưới ảnh 2 cột',
    shortLabel: 'Lưới ảnh',
    description: 'Khối layout lưới media, chữ phía dưới',
    icon: GalleryHorizontal,
  },
];

const LAYOUT_IDS = new Set(CONTENT_LAYOUT_OPTIONS.map((o) => o.id));

export function normalizeContentLayout(value: unknown): ContentLayout {
  const raw = String(value ?? '').trim();
  if (LAYOUT_IDS.has(raw as ContentLayout)) {
    return raw as ContentLayout;
  }
  return DEFAULT_CONTENT_LAYOUT;
}

export function isLayoutBlock(block: RichContentBlock): boolean {
  return String(block.type ?? '') === 'layout';
}

export function getLayoutBlockColumns(block: RichContentBlock): RichContentBlock[][] {
  if (!isLayoutBlock(block) || !Array.isArray(block.columns)) {
    return [];
  }
  return block.columns;
}

export function getLayoutBlockVariant(block: RichContentBlock): ContentLayout {
  return normalizeContentLayout(block.layout);
}

const MEDIA_BLOCK_TYPES = new Set(['image', 'audio', 'video', 'diagram']);

export function isMediaBlock(block: RichContentBlock): boolean {
  return MEDIA_BLOCK_TYPES.has(String(block.type ?? ''));
}

export function partitionContentBlocks(blocks: RichContentBlock[]): {
  media: RichContentBlock[];
  text: RichContentBlock[];
} {
  const media: RichContentBlock[] = [];
  const text: RichContentBlock[] = [];
  for (const block of blocks) {
    if (isMediaBlock(block)) {
      media.push(block);
    } else if (!isLayoutBlock(block)) {
      text.push(block);
    }
  }
  return { media, text };
}

/** Flatten layout blocks into a linear list (column order). */
export function flattenLayoutBlocks(blocks: RichContentBlock[]): RichContentBlock[] {
  const result: RichContentBlock[] = [];
  for (const block of blocks) {
    if (isLayoutBlock(block)) {
      for (const column of getLayoutBlockColumns(block)) {
        result.push(...column);
      }
    } else {
      result.push(block);
    }
  }
  return result;
}

export function inferLayoutFromBlocks(blocks: RichContentBlock[]): ContentLayout {
  for (const block of blocks) {
    if (isLayoutBlock(block)) {
      return getLayoutBlockVariant(block);
    }
  }
  return DEFAULT_CONTENT_LAYOUT;
}

export function resolveContentLayoutFromPayload(
  payload?: Record<string, unknown> | null,
): ContentLayout {
  if (!payload) return DEFAULT_CONTENT_LAYOUT;
  const content = payload.content;
  if (content && typeof content === 'object' && Array.isArray((content as RichContent).blocks)) {
    const fromBlocks = inferLayoutFromBlocks((content as RichContent).blocks);
    if (fromBlocks !== DEFAULT_CONTENT_LAYOUT) {
      return fromBlocks;
    }
    if ('layout' in content) {
      return normalizeContentLayout((content as RichContent).layout);
    }
  }
  return normalizeContentLayout(payload.contentLayout);
}

function createLayoutBlock(layout: ContentLayout, columns: RichContentBlock[][]): RichContentBlock {
  return {
    type: 'layout',
    layout,
    columns: columns.map((col) => [...col]),
  };
}

/** Restructure blocks when the user picks a layout — writes into content blocks directly. */
export function applyLayoutToContentBlocks(
  blocks: RichContentBlock[],
  layout: ContentLayout,
): RichContentBlock[] {
  const flat = flattenLayoutBlocks(blocks);
  const { media, text } = partitionContentBlocks(flat);

  if (layout === DEFAULT_CONTENT_LAYOUT) {
    return flat;
  }

  if (layout === 'image-top') {
    return [...media, ...text];
  }

  if (layout === 'image-bottom') {
    return [...text, ...media];
  }

  if (layout === 'two-column') {
    const result: RichContentBlock[] = [...media];
    if (text.length > 0) {
      const mid = Math.ceil(text.length / 2);
      result.push(createLayoutBlock('two-column', [text.slice(0, mid), text.slice(mid)]));
    }
    return result.length ? result : flat;
  }

  if (layout === 'media-grid') {
    const result: RichContentBlock[] = [];
    if (media.length > 0) {
      result.push(createLayoutBlock('media-grid', [media, []]));
    }
    result.push(...text);
    return result.length ? result : flat;
  }

  if (layout === 'image-left') {
    if (media.length === 0 && text.length === 0) return flat;
    if (media.length === 0) return text;
    if (text.length === 0) return media;
    return [createLayoutBlock('image-left', [media, text])];
  }

  if (layout === 'image-right') {
    if (media.length === 0 && text.length === 0) return flat;
    if (media.length === 0) return text;
    if (text.length === 0) return media;
    return [createLayoutBlock('image-right', [text, media])];
  }

  return flat;
}

export function applyLayoutToRichContent(
  content: RichContent,
  layout: ContentLayout,
): RichContent {
  const blocks = applyLayoutToContentBlocks(content.blocks ?? [], layout);
  return { blocks };
}

export function mergeContentWithLayout(
  blocks: RichContentBlock[],
  _layout?: ContentLayout,
): RichContent {
  return { blocks };
}

export const CONTENT_LAYOUT_FALLBACK_ICON = AlignVerticalSpaceAround;
