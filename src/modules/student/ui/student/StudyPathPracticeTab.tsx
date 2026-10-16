/**
 * Tab "Lộ trình" của màn Luyện tập (Lát L3 — SPEC knowledge-unit §8.1/§8.5).
 *
 * Đường vào CHÍNH của học sinh: điều hướng cây chương trình học ("Con đang học
 * Bài 23") → bấm Luyện ở một bài (scope = unit của bài) hoặc cả chương (hợp
 * unit các bài — §8.6). Cổng phạm vi v1 là LỰA CHỌN của người dùng, không tốn
 * thao tác nhập liệu nào (§8.1.1).
 */
import { useEffect, useState } from "react";
import { BookOpen, ChevronDown, ChevronRight, Route } from "lucide-react";
import { Card } from "@/core/ui/card";
import { Button } from "@/core/ui/button";
import { Badge } from "@/core/ui/badge";
import { Skeleton } from "@/core/ui/skeleton";
import { cn } from "@/core/lib/utils";
import { useStudyPaths, useStudyPathTree } from "@/modules/student/api/hooks";
import type {
  CreateSessionInput,
  StudyTopicNode,
} from "@/modules/student/api/practiceApi";

const TOPIC_TYPE_LABELS: Record<string, string> = {
  new_content: "Bài học",
  mixed_practice: "Luyện tập",
  review: "Ôn tập",
  intro: "Mở đầu",
  hands_on: "Thực hành",
  cross_cutting: "Chuyên đề",
};

export function StudyPathPracticeTab({
  subject,
  level,
  mode,
  onStart,
  pendingKey,
  isPending,
}: {
  subject: string | null;
  level: string | null;
  mode: CreateSessionInput["mode"];
  onStart: (key: string, input: CreateSessionInput) => void;
  pendingKey: string | null;
  isPending: boolean;
}) {
  const { data: paths, isLoading: pathsLoading } = useStudyPaths(subject, level);
  const [pathId, setPathId] = useState<string | null>(null);
  const items = paths?.items ?? [];
  // Tự chọn lộ trình đầu tiên của môn — thường mỗi (môn, khối) một bản active.
  useEffect(() => {
    if (items.length > 0 && !items.some((p) => p.id === pathId)) {
      setPathId(items[0].id);
    }
  }, [items, pathId]);
  const { data: tree, isLoading: treeLoading } = useStudyPathTree(pathId);
  const [openSections, setOpenSections] = useState<Set<string>>(new Set());

  if (!subject) {
    return (
      <Card className="p-6 border-2 text-sm text-muted-foreground">
        Chọn một môn ở trên để xem lộ trình học.
      </Card>
    );
  }
  if (pathsLoading || (pathId && treeLoading)) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }
  if (items.length === 0) {
    return (
      <Card className="p-6 border-2 text-sm text-muted-foreground">
        Môn này chưa có lộ trình học — thử tab Tự luyện hoặc quay lại sau nhé.
      </Card>
    );
  }

  const sections = tree?.sections ?? [];
  const crossCutting = tree?.cross_cutting_topics ?? [];
  const toggle = (id: string) =>
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const base = { mode, subject_code: subject, level: level ?? "" };

  function TopicRow({ topic }: { topic: StudyTopicNode }) {
    const key = `path-topic-${topic.id}`;
    const hasUnits = topic.units.length > 0;
    return (
      <div className="flex items-center gap-3 rounded-lg border px-3 py-2">
        <BookOpen className="size-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-medium">{topic.title}</span>
            <Badge variant="secondary" className="shrink-0 text-[10px]">
              {TOPIC_TYPE_LABELS[topic.topic_type] ?? topic.topic_type}
            </Badge>
          </div>
          {hasUnits && (
            <div
              className="truncate text-xs text-muted-foreground"
              title={topic.units.map((u) => u.name ?? u.unit_code).join(" · ")}
            >
              {topic.units.map((u) => u.name ?? u.unit_code).join(" · ")}
            </div>
          )}
        </div>
        <Button
          size="sm"
          disabled={!hasUnits || isPending}
          title={hasUnits ? undefined : "Bài này chưa gắn đơn vị kiến thức"}
          onClick={() =>
            onStart(key, {
              ...base,
              source: "study_topic",
              ref: { study_topic_id: topic.id },
            })
          }
        >
          {pendingKey === key && isPending ? "Đang tạo…" : "Luyện"}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {items.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {items.map((p) => (
            <Button
              key={p.id}
              size="sm"
              variant={p.id === pathId ? "default" : "outline"}
              onClick={() => setPathId(p.id)}
            >
              <Route className="size-4" /> {p.name}
            </Button>
          ))}
        </div>
      )}

      {sections.map((section) => {
        const open = openSections.has(section.id);
        const unitCount = new Set(
          section.topics.flatMap((t) => t.units.map((u) => u.unit_code)),
        ).size;
        const sectionKey = `path-section-${section.id}`;
        return (
          <Card key={section.id} className="border-2">
            {/* div thay button: bên trong có Button "Luyện cả chương" — button
                lồng button là HTML sai và Radix/trình duyệt xử lý khó lường. */}
            <div
              role="button"
              tabIndex={0}
              className="flex w-full cursor-pointer items-center gap-2 px-4 py-3 text-left"
              onClick={() => toggle(section.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") toggle(section.id);
              }}
            >
              {open ? (
                <ChevronDown className="size-4 shrink-0" />
              ) : (
                <ChevronRight className="size-4 shrink-0" />
              )}
              <span className="flex-1 truncate font-semibold">
                {section.title}
              </span>
              <span className="text-xs text-muted-foreground">
                {section.topics.length.toLocaleString("vi-VN")} bài
              </span>
              <Button
                size="sm"
                variant="outline"
                disabled={unitCount === 0 || isPending}
                onClick={(e) => {
                  e.stopPropagation();
                  onStart(sectionKey, {
                    ...base,
                    source: "study_section",
                    ref: { study_section_id: section.id },
                  });
                }}
              >
                {pendingKey === sectionKey && isPending
                  ? "Đang tạo…"
                  : "Luyện cả chương"}
              </Button>
            </div>
            <div className={cn("space-y-2 px-4 pb-4", !open && "hidden")}>
              {section.topics.map((t) => (
                <TopicRow key={t.id} topic={t} />
              ))}
            </div>
          </Card>
        );
      })}

      {crossCutting.length > 0 && (
        <Card className="border-2 p-4 space-y-2">
          <div className="text-xs font-bold uppercase text-muted-foreground">
            Chuyên đề cắt ngang
          </div>
          {crossCutting.map((t) => (
            <TopicRow key={t.id} topic={t} />
          ))}
        </Card>
      )}
    </div>
  );
}
