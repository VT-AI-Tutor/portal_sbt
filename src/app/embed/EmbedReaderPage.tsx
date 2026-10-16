import { BookLessonPage } from "@/modules/books/ui/public/BookLessonPage";
import { EmbedGate } from "./EmbedGate";

/**
 * `/embed/reader/:bookCode/:lessonCode` — the lesson reader (PDF + interactive
 * exercises) with no app chrome, for hosting inside the native WebView. The
 * `:lessonCode` segment accepts a lesson code or a numeric lesson id, exactly
 * like the public `/sach-bai-tap/:bookCode/:lessonCode` route it reuses.
 */
export function EmbedReaderPage() {
  return (
    <EmbedGate>
      <BookLessonPage embed />
    </EmbedGate>
  );
}
