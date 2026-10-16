import { useMemo } from "react";
import {
  BookOpen,
  Calculator,
  ChevronRight,
  Compass,
  Hash,
  Ruler,
  Sparkles,
  Star,
} from "lucide-react";
import { Card } from "@/core/ui/card";
import type { DigitizedManifest } from "../api/types";

// ---------------------------------------------------------------------------
// Style tokens — copy từ AdvancedBookSection cũ để danh sách bài trông giống
// phần mục lục cơ bản (gradient card + danh sách bài).
// ---------------------------------------------------------------------------
const TOPIC_COLORS = [
  "from-sky-500 to-blue-600",
  "from-emerald-500 to-teal-600",
  "from-purple-500 to-indigo-600",
  "from-amber-500 to-orange-600",
  "from-pink-500 to-rose-600",
  "from-cyan-500 via-teal-500 to-emerald-600",
  "from-indigo-500 to-violet-600",
];

const TOPIC_ICONS = [Hash, Ruler, Calculator, Compass, Star];

const TOPIC_INDEX_THEMES = [
  {
    bg: "bg-sky-50 text-sky-600",
    hover: "group-hover/item:bg-sky-100 group-hover/item:text-sky-700",
  },
  {
    bg: "bg-emerald-50 text-emerald-600",
    hover: "group-hover/item:bg-emerald-100 group-hover/item:text-emerald-700",
  },
  {
    bg: "bg-purple-50 text-purple-600",
    hover: "group-hover/item:bg-purple-100 group-hover/item:text-purple-700",
  },
  {
    bg: "bg-amber-50 text-amber-600",
    hover: "group-hover/item:bg-amber-100 group-hover/item:text-amber-700",
  },
  {
    bg: "bg-pink-50 text-pink-600",
    hover: "group-hover/item:bg-pink-100 group-hover/item:text-pink-700",
  },
  {
    bg: "bg-cyan-50 text-cyan-600",
    hover: "group-hover/item:bg-cyan-100 group-hover/item:text-cyan-700",
  },
  {
    bg: "bg-indigo-50 text-indigo-600",
    hover: "group-hover/item:bg-indigo-100 group-hover/item:text-indigo-700",
  },
];

/**
 * Danh sách bài tập nâng cao — render INLINE trên trang sách (thay cho CTA
 * "Bắt đầu với các bài tập nâng cao") SAU khi user nhập đúng mật khẩu.
 *
 * Click vào bài → callback `onSelectLesson` để cha mở dialog runner.
 */
export function AdvancedLessonList({
  manifest,
  displayTitle,
  onSelectLesson,
}: {
  manifest: DigitizedManifest;
  displayTitle: string;
  onSelectLesson: (lessonCode: string) => void;
}) {
  // `lesson.bai` trong manifest.json có thể tiếp tục từ sách cơ bản (vd: cơ bản
  // 1–21, nâng cao 21–41). Tính offset = min(bai) - 1 để bài đầu tiên của sách
  // nâng cao luôn hiển thị là "Bài 1", các bài sau tăng dần theo `bai` gốc.
  const baiOffset = useMemo(() => {
    let min = Infinity;
    for (const ch of manifest.chapters) {
      for (const lesson of ch.lessons) {
        if (typeof lesson.bai === "number" && lesson.bai < min) min = lesson.bai;
      }
    }
    return min === Infinity ? 0 : min - 1;
  }, [manifest]);

  return (
    <section className="max-w-7xl mx-auto px-6 w-full">
      <div className="text-xs font-bold uppercase tracking-widest text-sky-500">
        Nội dung học liệu nâng cao
      </div>
      <h2 className="font-display text-3xl sm:text-4xl font-black mt-1 mb-1 text-slate-800 tracking-tight">
        Mục lục bài tập nâng cao
      </h2>
      <p className="text-slate-400 font-medium mb-8 text-sm sm:text-base">
        Bám sát cấu trúc phân phối chương trình nâng cao —{" "}
        {manifest.chapters.length} chủ đề · {totalLessons(manifest)} bài học
      </p>

      <div className="grid gap-6 md:grid-cols-2">
        {manifest.chapters.map((chapter, chapterIdx) => {
          const colorClass = TOPIC_COLORS[chapterIdx % TOPIC_COLORS.length];
          const IconComponent =
            TOPIC_ICONS[chapterIdx % TOPIC_ICONS.length] || BookOpen;
          const indexTheme =
            TOPIC_INDEX_THEMES[chapterIdx % TOPIC_INDEX_THEMES.length];

          return (
            <Card
              key={chapter.chapter_id}
              className="p-0 border border-slate-100 overflow-hidden hover:border-slate-200 hover:shadow-soft transition-all duration-300 flex flex-col h-full rounded-2xl group/card"
            >
              <div
                className={`bg-gradient-to-r ${colorClass} p-5 text-white flex items-center gap-4 shrink-0`}
              >
                <div className="size-11 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center shrink-0">
                  <IconComponent className="size-5.5 text-white" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-display text-base sm:text-[17px] font-black leading-snug truncate">
                    {chapter.title}
                  </div>
                </div>
                <div className="shrink-0 text-xs font-bold bg-white/20 backdrop-blur px-3 py-1 rounded-full whitespace-nowrap">
                  {chapter.lessons.length} bài
                </div>
              </div>

              <ol className="divide-y divide-slate-100 flex-1 bg-white">
                {chapter.lessons.map((lesson) => (
                  <li key={lesson.lesson_id}>
                    <button
                      type="button"
                      onClick={() => onSelectLesson(lesson.id)}
                      className="w-full text-left flex items-center gap-3.5 px-5 py-4 hover:bg-slate-50/50 transition-colors cursor-pointer group/item"
                    >
                      <div
                        className={`rounded-full ${indexTheme.bg} ${indexTheme.hover} flex items-center justify-center px-2.5 py-1 text-[11px] font-extrabold shrink-0 transition-all`}
                      >
                        Bài {lesson.bai - baiOffset}
                      </div>
                      <div className="text-sm font-semibold flex-1 text-slate-700 group-hover/item:text-slate-900 transition-colors line-clamp-1">
                        {lesson.title}
                      </div>
                      <ChevronRight className="size-4 text-slate-400 shrink-0 group-hover/item:translate-x-0.5 transition-transform" />
                    </button>
                  </li>
                ))}
              </ol>
            </Card>
          );
        })}
      </div>

      <div className="mt-10 text-center">
        <div className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500">
          <Sparkles className="size-4 text-sky-500" />
          Bạn đã thành thạo chương trình cơ bản của {displayTitle}? Hãy thử sức
          với các bài tập nâng cao ở trên.
        </div>
      </div>
    </section>
  );
}

function totalLessons(manifest: DigitizedManifest): number {
  return manifest.chapters.reduce((sum, ch) => sum + ch.lessons.length, 0);
}
