import { Link } from "react-router-dom";

import { Card } from "@/core/ui/card";
import { COPY } from "../copy";
import { getSubjectIcon } from "../subjectIcons";
import type { BrowseTopic } from "../browse/browseTopics";
import { practiceTopicPath } from "../topicRoute";
import { PatternSvg } from "../../shared/PatternSvg";

interface TopicCardProps {
  topic: BrowseTopic;
  /** Nhãn khối lấy từ danh mục ("Lớp 1"), không ghép từ mã — tránh "Lớp Lớp 1". */
  levelLabel: string;
}

export function TopicCard({ topic, levelLabel }: TopicCardProps) {
  const Icon = getSubjectIcon(topic.subjectCode);

  return (
    <Link
      to={practiceTopicPath(topic.subjectCode, topic.level, topic.contentCode)}
      className="block no-underline h-full"
    >
      <Card className="group p-0 border-2 hover:border-primary transition-all hover:-translate-y-1 hover:shadow-card overflow-hidden relative flex flex-col h-full">
        <div
          className={`relative aspect-[5/7] bg-gradient-to-br ${topic.gradient} overflow-hidden`}
        >
          <PatternSvg pattern={topic.pattern} />
          <Icon
            aria-hidden
            strokeWidth={1.25}
            className="absolute -right-5 -bottom-6 size-32 md:size-36 text-white/15 rotate-[-10deg] pointer-events-none"
          />
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-white/30" />
          <div className="absolute top-0 left-2 bottom-0 w-0.5 bg-white/20" />
          <div className="absolute top-2.5 left-2.5 right-2.5 flex items-start justify-between gap-2">
            <span className="inline-block bg-white/95 backdrop-blur px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider text-foreground shadow-soft">
              {topic.subjectLabel}
            </span>
            <span className="inline-block bg-black/30 backdrop-blur px-1.5 py-0.5 rounded text-[9px] font-bold text-white">
              {levelLabel}
            </span>
          </div>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="relative size-20 md:size-24 rounded-2xl bg-white/95 backdrop-blur shadow-card ring-4 ring-white/40 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
              <Icon
                aria-hidden
                strokeWidth={1.75}
                className="size-9 md:size-11 text-foreground/80"
              />
            </div>
          </div>
          <div className="absolute inset-x-0 bottom-0 px-2.5 py-2 bg-gradient-to-t from-black/70 via-black/30 to-transparent">
            <div className="text-white text-[10px] font-bold uppercase tracking-wider">
              {levelLabel}
            </div>
            <div className="text-white/80 text-[9px] font-medium">
              {topic.questionAvailable} {COPY.questionSuffix}
            </div>
          </div>
        </div>

        <div className="p-3 flex flex-col flex-1">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">
            {topic.subjectLabel}
          </div>
          <div className="font-bold text-sm leading-tight mt-0.5 line-clamp-2 min-h-[2.5rem] text-foreground">
            {topic.label}
          </div>
          <div className="mt-2 flex items-center justify-end gap-2">
            {/* <span> chứ không <button>: cả thẻ đã là <a>, lồng button vào
                trong là HTML sai và nuốt mất click điều hướng. */}
            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-primary group-hover:underline">
              {COPY.cardCta}
            </span>
          </div>
        </div>
      </Card>
    </Link>
  );
}
