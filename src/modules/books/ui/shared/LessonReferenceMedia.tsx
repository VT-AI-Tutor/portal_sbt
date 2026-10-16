import { FileImage, Music, Video } from "lucide-react";
import type { LessonExtraMedia } from "@/modules/catalog/api/types";
import { resolveAssetUrl } from "@/core/content/assetUrl";

const TYPE_META: Record<
  LessonExtraMedia["type"],
  { icon: typeof Music; label: string }
> = {
  image: { icon: FileImage, label: "Hình ảnh" },
  audio: { icon: Music, label: "Âm thanh" },
  video: { icon: Video, label: "Video" },
};

function MediaBody({ item }: { item: LessonExtraMedia }) {
  const src = resolveAssetUrl(item.url);
  if (item.type === "image") {
    return (
      <img
        src={src}
        alt={item.title || "Tài liệu tham khảo"}
        loading="lazy"
        className="w-full max-h-[60vh] rounded-2xl object-contain bg-black/5"
      />
    );
  }
  if (item.type === "video") {
    return (
      <video
        src={src}
        controls
        playsInline
        className="w-full max-h-[60vh] rounded-2xl bg-black"
      />
    );
  }
  return <audio src={src} controls className="w-full" />;
}

/**
 * Tab "Tham Khảo": danh sách tài liệu kèm bài học (ảnh/audio/video) lấy từ
 * field extra_media của API chi tiết bài tập.
 */
export function LessonReferenceMedia({
  items,
  hideItemTitle = false,
}: {
  items: LessonExtraMedia[];
  /** Giấu tên file của từng mục, chỉ còn nhãn loại — dùng cho môn Tập viết. */
  hideItemTitle?: boolean;
}) {
  if (items.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center p-6 text-sm text-muted-foreground">
        Chưa có tài liệu tham khảo cho bài này.
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 overflow-y-auto p-4">
      <ul className="mx-auto flex w-full max-w-3xl flex-col gap-4">
        {items.map((item, i) => {
          const meta = TYPE_META[item.type];
          const Icon = meta.icon;
          return (
            <li
              key={item.code || `${item.type}-${i}`}
              className="rounded-3xl border border-border/60 bg-card p-4 shadow-soft"
            >
              <div className="mb-3 flex items-center gap-2">
                <span className="inline-flex size-8 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Icon className="size-4" />
                </span>
                <div className="min-w-0">
                  {hideItemTitle ? (
                    <p className="font-bold text-foreground">{meta.label}</p>
                  ) : (
                    <>
                      <p className="truncate font-bold text-foreground">
                        {item.title || meta.label}
                      </p>
                      <p className="text-xs font-medium text-muted-foreground">
                        {meta.label}
                      </p>
                    </>
                  )}
                </div>
              </div>
              <MediaBody item={item} />
            </li>
          );
        })}
      </ul>
    </div>
  );
}
