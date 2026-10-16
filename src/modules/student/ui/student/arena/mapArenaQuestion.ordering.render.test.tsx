// @vitest-environment jsdom
/**
 * Component-level check (task brief step 2): the real `QuestionPlayer` +
 * `OrderingTask` — not a stub — rendering a `mapArenaQuestion`-mapped
 * ordering question with `payload: null` and bare `options[]`. Repros the
 * live-E2E bug directly: before the fix, `payload.items` was never
 * synthesized, `OrderingTask` received `items=[]`, and the container
 * rendered with zero list items. This asserts the 3 options actually show
 * up as list items.
 */
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { QuestionPlayer } from "@/core/exercise/QuestionPlayer";
import { mapArenaQuestion } from "./mapArenaQuestion";
import type { ArenaQuestion } from "@/modules/student/api/arenaApi";

describe("ordering render (mapArenaQuestion → QuestionPlayer, real player)", () => {
  it("payload null + 3 options → 3 list items render, not an empty container", () => {
    const q: ArenaQuestion = {
      id: "q1",
      type: "ordering",
      content: "Sắp xếp tăng dần",
      // Content values deliberately NOT 1/2/3 — ReorderListPlayer's position
      // badges render "1".."3" too, and it shuffles initial order, so a
      // 1/5/9 vs 1/2/3 badge collision made an earlier version of this test
      // flaky (getByText("1") matched both a badge and an item).
      options: [
        { id: "a", content: "một trăm" },
        { id: "b", content: "năm trăm" },
        { id: "c", content: "chín trăm" },
      ],
      payload: null,
      points: 10,
    };

    const mapped = mapArenaQuestion(q);

    render(
      <QuestionPlayer
        question={mapped}
        index={0}
        answer={undefined}
        onAnswerChange={() => {}}
        submitted={false}
      />,
    );

    expect(screen.getByText("một trăm")).toBeTruthy();
    expect(screen.getByText("năm trăm")).toBeTruthy();
    expect(screen.getByText("chín trăm")).toBeTruthy();
    // 3 draggable rows actually rendered (not 0 — the live-E2E bug was an
    // empty container with zero rows).
    expect(document.querySelectorAll('[draggable="true"]')).toHaveLength(3);
  });
});
