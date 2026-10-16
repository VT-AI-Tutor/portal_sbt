/**
 * Guard against the two Chrome-cancels-the-drag shapes that have regressed this
 * codebase repeatedly (#533 → #544 → #563 → #569 → #588 → this one).
 *
 * WHY A SOURCE-LEVEL TEST. jsdom has no native drag-and-drop: no drag session,
 * no drag image, and no "cancel the drag when the source's transform changes"
 * heuristic — that behaviour is Chrome-internal. Framer's `layout` also needs
 * real `getBoundingClientRect()` measurements, and in jsdom every rect is zero,
 * so no layout transform is ever written. A rendering test therefore passes
 * whether or not the bug is present — which is exactly what happened: the whole
 * player suite was green through every one of the regressions above.
 *
 * So this test reads the SOURCE instead. It is environment-independent and it
 * fails on the shapes themselves, before a human ever has to open Chrome.
 *
 * The two banned shapes:
 *   1. A drag source that is (or is wrapped by) a Framer element carrying a
 *      transform prop — `layout`, `whileHover`, `whileTap`, `initial`,
 *      `animate`. Chrome cancels the drag when the source's transform changes
 *      right after `dragstart`.
 *   2. A component defined INSIDE a player body and rendered as JSX. It gets a
 *      new function identity on every state update, so the `setDragId` in
 *      `onDragStart` remounts the chip mid-drag, tearing the drag source out of
 *      the DOM. This is the root cause #569 proved and #588 failed to propagate.
 *
 * The fix for both is `DraggableChip` — use it instead of hand-rolling a source.
 *
 * THIRD RULE, different failure. Native HTML5 drag does not fire AT ALL on
 * iOS/iPadOS Safari or Chrome — no `dragstart`, no `drop`, nothing. So a drag
 * source with no tap path is not "degraded" on a tablet, it is DEAD: the pupil
 * cannot answer the question by any means. Every `DraggableChip` must therefore
 * carry `onClick` (which is also what makes it render as a real `<button>`, so
 * keyboard users get the same path). jsdom cannot prove the touch behaviour
 * either, so this too is checked at the source.
 */
import { describe, it, expect } from "vitest";
// web-own: tsconfig của evo-books-web CÓ Node types nên các @ts-expect-error của
// bản studio trở thành "unused directive" (TS2578) — import thẳng, không directive.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const PLAYERS_DIR = join(__dirname);
/** The one place a raw `draggable` drag source is allowed to be declared. */
const PRIMITIVE = "DraggableChip.tsx";

const TRANSFORM_PROPS = ["layout", "whileHover", "whileTap", "initial", "animate"];

const playerSources = readdirSync(PLAYERS_DIR)
  .filter((f: string) => f.endsWith(".tsx") && !f.includes(".test.") && f !== PRIMITIVE)
  .map((f: string) => ({ file: f, src: readFileSync(join(PLAYERS_DIR, f), "utf8") as string }));

/**
 * `draggable={draggable}` forwards a caller-supplied prop (ExerciseImage does
 * this to suppress the browser ghost image); it does not declare a drag source.
 */
const isPropForward = (tag: string) => /\bdraggable=\{draggable\}/.test(tag);

/** A tag that actually enables dragging (so `draggable={false}` is exempt). */
const isDragSource = (tag: string) =>
  /\bdraggable=\{(?!false\})/.test(tag) && !isPropForward(tag);

/**
 * Extract each JSX opening tag as a raw string. Walks brace depth so that
 * expression containers (`className={`...${x}`}`) don't terminate the tag early.
 */
function jsxOpeningTags(src: string): string[] {
  const tags: string[] = [];
  for (let i = 0; i < src.length; i++) {
    if (src[i] !== "<") continue;
    if (!/[A-Za-z]/.test(src[i + 1] ?? "")) continue;
    let depth = 0;
    for (let j = i + 1; j < src.length; j++) {
      const ch = src[j];
      if (ch === "{") depth++;
      else if (ch === "}") depth--;
      else if (ch === "<" && depth === 0) break; // unterminated — not a tag
      else if (ch === ">" && depth === 0) {
        tags.push(src.slice(i, j + 1));
        i = j;
        break;
      }
    }
  }
  return tags;
}

describe("drag-source shape (regression guard for #533/#563/#569)", () => {
  it("no drag source carries a Framer transform prop", () => {
    const offenders: string[] = [];
    for (const { file, src } of playerSources) {
      for (const tag of jsxOpeningTags(src)) {
        if (!isDragSource(tag)) continue;
        const bad = TRANSFORM_PROPS.filter((p) => new RegExp(`\\b${p}=`).test(tag));
        if (bad.length) {
          offenders.push(`${file}: <${tag.slice(1).split(/[\s>]/)[0]}> has ${bad.join(", ")}`);
        }
      }
    }
    expect(
      offenders,
      `Drag sources must be transform-free — Chrome cancels the drag when the source's ` +
        `transform changes after dragstart (#533). Use <DraggableChip>, which keeps every ` +
        `Framer transform on a non-draggable wrapper.\n` + offenders.join("\n"),
    ).toEqual([]);
  });

  it("no player renders a component defined inside its own body", () => {
    const offenders: string[] = [];
    for (const { file, src } of playerSources) {
      // Module-scope declarations start at column 0; anything indented is nested
      // inside a component body and therefore gets a new identity per render.
      // Only drag sources are at risk — a nested presentational component is
      // merely a perf smell, not a broken drag.
      for (const m of src.matchAll(/^[ \t]+const ([A-Z]\w*)\s*[:=]/gm)) {
        const name = m[1];
        if (!new RegExp(`<${name}[\\s/>]`).test(src)) continue;
        // Body = from the declaration to the next sibling declaration/return.
        const from = m.index ?? 0;
        const rest = src.slice(from + m[0].length);
        const end = rest.search(/\n {2}(const|return|useEffect|\/\/)/);
        const body = end === -1 ? rest : rest.slice(0, end);
        if (!/\bdraggable=|\bonDragStart/.test(body)) continue;
        offenders.push(`${file}: <${name}> is a drag source declared inside a component body`);
      }
    }
    expect(
      offenders,
      `A component declared inside a player body gets a new function identity on every ` +
        `render, so the setDragId in onDragStart REMOUNTS it and Chrome cancels the drag ` +
        `(#563, root-caused in #569). Hoist it to module scope, or use <DraggableChip>.\n` +
        offenders.join("\n"),
    ).toEqual([]);
  });

  it("every native drag source in the players tree goes through DraggableChip", () => {
    const offenders: string[] = [];
    for (const { file, src } of playerSources) {
      for (const tag of jsxOpeningTags(src)) {
        if (!isDragSource(tag)) continue;
        offenders.push(`${file}: <${tag.slice(1).split(/[\s>]/)[0]} draggable={…}>`);
      }
    }
    expect(
      offenders,
      `Hand-rolled drag sources drift apart and only some of them get each fix — that is ` +
        `why this bug came back four times. Route the drag source through <DraggableChip>.\n` +
        offenders.join("\n"),
    ).toEqual([]);
  });
});

describe("tap fallback (iOS/iPadOS fire no drag events at all)", () => {
  it("every <DraggableChip> passes onClick", () => {
    const offenders: string[] = [];
    let checked = 0;
    for (const { file, src } of playerSources) {
      for (const tag of jsxOpeningTags(src)) {
        if (!/^<DraggableChip[\s/>]/.test(tag)) continue;
        checked++;
        if (!/\bonClick=/.test(tag)) offenders.push(`${file}: <DraggableChip> without onClick`);
      }
    }
    // Guard the guard: if the tag ever stops matching, this silently passes.
    expect(checked).toBeGreaterThan(10);
    expect(
      offenders,
      `Without onClick the chip renders as a <div> and the ONLY way to answer is a native ` +
        `HTML5 drag — which iOS/iPadOS Safari and Chrome never fire. That makes the question ` +
        `unanswerable on a tablet, and unreachable by keyboard everywhere. Pass onClick and ` +
        `give the drop target a matching onClick.\n` + offenders.join("\n"),
    ).toEqual([]);
  });
});
