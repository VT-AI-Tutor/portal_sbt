import { describe, expect, it } from "vitest";
import { journeyState } from "./journeyLogic";
import type {
  ArenaOverview,
  ArenaRoundCard,
} from "@/modules/student/api/arenaApi";

const round = (overrides: Partial<ArenaRoundCard>): ArenaRoundCard => ({
  id: "r1",
  tier: "week",
  period_key: "2026-W30",
  starts_at: "2026-07-20T00:00:00Z",
  ends_at: "2026-07-27T00:00:00Z",
  status: "open",
  question_count: 10,
  duration_minutes: 30,
  max_attempts: 3,
  attempts_used: 0,
  my_best: null,
  locked: false,
  lock_reason: null,
  current_attempt_id: null,
  ...overrides,
});

const emptyOverview = (): ArenaOverview => ({
  grade: "10",
  rounds: { week: null, month: null, quarter: null, year: null },
});

describe("journeyState", () => {
  it("overview rỗng: cả 4 tier đều none", () => {
    const result = journeyState(emptyOverview());
    expect(result.week).toEqual({ state: "none", reason: null });
    expect(result.month).toEqual({ state: "none", reason: null });
    expect(result.quarter).toEqual({ state: "none", reason: null });
    expect(result.year).toEqual({ state: "none", reason: null });
  });

  it("week open, không khoá → active", () => {
    const overview = emptyOverview();
    overview.rounds.week = round({
      tier: "week",
      status: "open",
      locked: false,
    });
    const result = journeyState(overview);
    expect(result.week).toEqual({ state: "active", reason: null });
  });

  it("month bị khoá → locked kèm reason", () => {
    const overview = emptyOverview();
    overview.rounds.month = round({
      tier: "month",
      status: "open",
      locked: true,
      lock_reason: "Cần hoàn thành vòng tuần trước",
    });
    const result = journeyState(overview);
    expect(result.month).toEqual({
      state: "locked",
      reason: "Cần hoàn thành vòng tuần trước",
    });
  });

  it("month còn vé (chưa hết lượt) và đang mở → active", () => {
    const overview = emptyOverview();
    overview.rounds.month = round({
      tier: "month",
      status: "open",
      locked: false,
      attempts_used: 1,
      max_attempts: 3,
    });
    const result = journeyState(overview);
    expect(result.month).toEqual({ state: "active", reason: null });
  });

  it("year đã finalized → done", () => {
    const overview = emptyOverview();
    overview.rounds.year = round({
      tier: "year",
      status: "finalized",
      locked: false,
    });
    const result = journeyState(overview);
    expect(result.year).toEqual({ state: "done", reason: null });
  });
});
