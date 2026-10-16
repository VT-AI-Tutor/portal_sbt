/**
 * Arena journey state — maps the 4-tier overview (week/month/quarter/year)
 * returned by `GET /api/v1/student/arena/overview` to a per-tier UI state
 * used to render the journey map (active/locked/upcoming/done/none).
 */
import type {
  ArenaOverview,
  ArenaRoundCard,
  ArenaTier,
} from "@/modules/student/api/arenaApi";

export type ArenaJourneyStateValue =
  | "active"
  | "locked"
  | "upcoming"
  | "done"
  | "none";

export interface ArenaJourneyTierState {
  state: ArenaJourneyStateValue;
  reason: string | null;
}

const TIERS: ArenaTier[] = ["week", "month", "quarter", "year"];

function tierState(round: ArenaRoundCard | null): ArenaJourneyTierState {
  if (!round) return { state: "none", reason: null };
  if (round.locked) return { state: "locked", reason: round.lock_reason };
  if (round.status === "open") return { state: "active", reason: null };
  if (round.status === "published") return { state: "upcoming", reason: null };
  // closed | finalized
  return { state: "done", reason: null };
}

export function journeyState(
  overview: ArenaOverview,
): Record<ArenaTier, ArenaJourneyTierState> {
  return TIERS.reduce(
    (acc, tier) => {
      acc[tier] = tierState(overview.rounds[tier]);
      return acc;
    },
    {} as Record<ArenaTier, ArenaJourneyTierState>,
  );
}
