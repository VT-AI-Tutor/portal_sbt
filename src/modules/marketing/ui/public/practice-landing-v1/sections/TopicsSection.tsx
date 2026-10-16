import { getTopics } from "../topicsConfig";

interface TopicsSectionProps {
  level: string;
  subjectCode: string;
  subjectLabel: string;
  onTopicClick: () => void;
}

/**
 * Chủ đề nổi bật cho cặp Khối/Môn đang chọn (config tĩnh — spec §7). Chưa soạn cho cặp
 * này thì `getTopics` trả [] và section tự ẩn. v1 chưa có luồng khách nên mọi "Luyện ▶"
 * đều mở RegisterDialog (spec §6 Pha 1) — hành vi đó do PracticeLandingPage truyền qua
 * `onTopicClick`.
 */
export function TopicsSection(p: TopicsSectionProps) {
  const topics = getTopics(p.level, p.subjectCode);
  if (topics.length === 0) return null;

  return (
    <section className="max-w-7xl mx-auto px-4 py-16 w-full space-y-5">
      <h2 className="font-display text-xl md:text-2xl font-bold text-foreground">
        {p.subjectLabel} · Lớp {p.level} — chủ đề nổi bật
      </h2>
      <div className="rounded-3xl border-2 border-border/80 bg-card shadow-soft divide-y divide-border/60 overflow-hidden">
        {topics.map((t) => (
          <div
            key={t.title}
            className="flex items-center justify-between gap-3 px-5 py-4"
          >
            <span className="text-sm md:text-base font-medium text-foreground/80">
              {t.icon} {t.title}
              {t.questionCount !== undefined && (
                <em className="not-italic text-muted-foreground">
                  {" "}
                  · {t.questionCount} câu
                </em>
              )}
            </span>
            <button
              type="button"
              className={
                t.mixed
                  ? "inline-flex items-center justify-center rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground shadow-soft transition hover:opacity-90 cursor-pointer flex-shrink-0"
                  : "inline-flex items-center justify-center rounded-xl border-2 border-border bg-card px-4 py-2 text-sm font-bold text-foreground transition hover:border-primary hover:text-primary cursor-pointer flex-shrink-0"
              }
              onClick={p.onTopicClick}
            >
              Luyện ▶
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
