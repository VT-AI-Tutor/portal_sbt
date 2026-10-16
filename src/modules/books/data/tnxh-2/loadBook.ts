import type { RenderableQuestion } from "@/core/question-schema/types";
import bookManifest from "./book.json";

export type Tnxh2Lesson = (typeof bookManifest.lessons)[number];

export type Tnxh2BookManifest = typeof bookManifest;

export function getBookManifest(): Tnxh2BookManifest {
  return bookManifest;
}

export function pageImageUrl(page: number): string {
  return `/books/tnxh-2/pages/page-${String(page).padStart(2, "0")}.png`;
}

const questionModules = import.meta.glob<{ questions: RenderableQuestion[] }>(
  "./questions/bai-*/questions.json",
  { eager: true },
);

const questionsByLesson = new Map<string, RenderableQuestion[]>();
for (const [path, mod] of Object.entries(questionModules)) {
  const m = path.match(/bai-(\d+)/);
  if (m) questionsByLesson.set(`bai-${m[1]}`, mod.questions);
}

export function getLessonQuestions(lessonId: string): RenderableQuestion[] {
  return questionsByLesson.get(lessonId) ?? [];
}

export function findLessonByPage(page: number): Tnxh2Lesson | undefined {
  return bookManifest.lessons.find(
    (l) =>
      l.startPage != null &&
      l.endPage != null &&
      page >= l.startPage &&
      page <= l.endPage,
  );
}
