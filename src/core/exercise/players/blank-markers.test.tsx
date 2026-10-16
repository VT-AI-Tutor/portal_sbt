import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { QuestionPlayer } from "../QuestionPlayer";
import {
  BLANK_MARKER_GLOBAL_RE,
  BLANK_MARKER_RE,
  blankIdFromMarker,
  splitTextAroundBlankMarkers,
} from "./blank-markers";

/** All markers in `text`, in document order. */
function markersIn(text: string): string[] {
  return text.match(new RegExp(BLANK_MARKER_GLOBAL_RE.source, "g")) ?? [];
}

describe("blank marker grammar", () => {
  it.each([
    ["{blank_1}", "blank_1"],
    ["___[blank_1]___", "blank_1"],
    ["___[b1]___", "b1"],
    // WEB14: two leading underscores instead of three. Authoring slip, not a
    // different marker — it must still yield the same blank id.
    ["__[blank_12]___", "blank_12"],
    ["___[blank_12]__", "blank_12"],
    ["__[blank_12]__", "blank_12"],
    ["_____[blank_12]_____", "blank_12"],
  ])("reads the blank id out of %s", (marker, expectedId) => {
    expect(BLANK_MARKER_RE.test(marker)).toBe(true);
    expect(blankIdFromMarker(marker)).toBe(expectedId);
  });

  it.each([
    // A single underscore each side is markdown-ish emphasis, not a blank.
    "_[blank_1]_",
    "[blank_1]",
    "___blank_1___",
    "{blank}",
  ])("does not treat %s as a marker", (text) => {
    expect(BLANK_MARKER_RE.test(text)).toBe(false);
    expect(blankIdFromMarker(text)).toBeUndefined();
  });

  it("keeps adjacent markers separate when their underscore runs abut", () => {
    // The canonical-first alternation exists for exactly this: a bare `_{2,}`
    // would swallow all six middle underscores into one match and drop b2.
    expect(markersIn("___[b1]______[b2]___")).toEqual(["___[b1]___", "___[b2]___"]);
  });

  it("splits prose around a malformed marker without leaking it as text", () => {
    const parts = splitTextAroundBlankMarkers("53 + 15 = __[blank_12]___ đơn vị");

    expect(parts).toEqual(["53 + 15 = ", "__[blank_12]___", " đơn vị"]);
    expect(parts.filter((p) => blankIdFromMarker(p))).toHaveLength(1);
  });

  it("still matches markers mid-word", () => {
    expect(markersIn("lùm c___[b1]___ và m___[b2]___ bay")).toEqual([
      "___[b1]___",
      "___[b2]___",
    ]);
  });
});

describe("WEB14 — malformed marker renders an input, not raw text", () => {
  // Shape of VBT Toán 1 Tập 2, Bài 10, Câu 2 part d) 53 + 15: three column blanks
  // per part, but the last marker of part d) was authored with two leading
  // underscores. Before the fix the part rendered two inputs plus the literal
  // string "__[blank_12]___".
  const html = renderToString(
    <QuestionPlayer
      question={{
        id: "web14-dat-tinh-roi-tinh",
        question_type: "cloze",
        payload: {
          type: "cloze",
          content: {
            blocks: [
              { type: "paragraph", text: "d) 53 + 15" },
              {
                type: "paragraph",
                text: "___[blank_10]___ ___[blank_11]___ __[blank_12]___",
              },
            ],
          },
          correctAnswer: { blank_10: "6", blank_11: "8", blank_12: "0" },
        },
      }}
      index={0}
    />,
  );

  it("renders all three inputs", () => {
    expect(html.match(/type="text"/g)).toHaveLength(3);
  });

  it("does not leak the raw marker text", () => {
    expect(html).not.toContain("[blank_12]");
    expect(html).not.toContain("__[blank");
  });

  it("keys the malformed blank on its real id so grading still finds the answer", () => {
    // The cloze player carries blank ids in props, not in the DOM, so assert the
    // ids at the layer that feeds it: all three must resolve, in document order.
    const ids = splitTextAroundBlankMarkers(
      "___[blank_10]___ ___[blank_11]___ __[blank_12]___",
    )
      .map(blankIdFromMarker)
      .filter(Boolean);

    expect(ids).toEqual(["blank_10", "blank_11", "blank_12"]);
  });
});
