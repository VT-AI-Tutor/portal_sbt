/**
 * Shared book domain types that both the learner catalog and the admin app
 * reference. Lives in core so neither app depends on the other's module.
 */
export interface BookPreface {
  greeting: string;
  paragraphs: string[];
  signature: string;
}
