import { StudentPracticeSessionPage } from "@/modules/student/ui/student/practice/StudentPracticeSessionPage";
import { EmbedGate } from "./EmbedGate";

/**
 * `/embed/practice/:sessionId` — the practice-session runner with no app
 * chrome, for hosting inside the native WebView. Autosave, submit, progress
 * and auth-expiry events are relayed to the host via the embed bridge (see
 * `@/core/embed/bridge`).
 */
export function EmbedPracticePage() {
  return (
    <EmbedGate>
      <StudentPracticeSessionPage />
    </EmbedGate>
  );
}
