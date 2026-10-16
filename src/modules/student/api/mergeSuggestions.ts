import type { PracticeSuggestion } from "./practiceApi";

const SUGGESTIONS_CAP = 9;

/**
 * Merges practice-suggestion lists fetched per subject (used when the
 * student has "Tất cả" selected on /student/practice and we fan out one
 * request per subject code, since the BE requires `subject_code`) into a
 * single list — weakest mastery first, capped for the grid.
 */
export function mergeSuggestions(
  lists: PracticeSuggestion[][],
  cap = SUGGESTIONS_CAP,
): PracticeSuggestion[] {
  return lists
    .flat()
    .sort((a, b) => a.mastery_percent - b.mastery_percent)
    .slice(0, cap);
}
