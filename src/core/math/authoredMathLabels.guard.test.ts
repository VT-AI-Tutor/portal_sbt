/**
 * Guard: a plain-text `question_text` label must go through
 * `plainTextFromAuthoredMath`.
 *
 * WHY A SOURCE-LEVEL TEST. The bug is invisible to a rendering test: a label
 * that prints "chiều dài \(\frac{51}{4}\) m" renders perfectly well, it is just
 * wrong to read. There is no exception, no failed assertion and no DOM
 * difference to assert on — only a human noticing the delimiters. And the
 * failure mode is *drift*: this sweep fixed ~20 surfaces at once, so the next
 * list, table or tooltip to render `question_text` will be written by someone
 * who never saw them. A source rule is what survives that.
 *
 * Scope is deliberately narrow — a JSX interpolation of `…question_text` inside
 * `src/modules`. It does not try to catch every plain-text path (an object
 * field, a `title=` built elsewhere, a `label:` in a hook); it catches the shape
 * that has actually been written twenty times. A truthiness guard
 * (`{item.question_text && (…)}`) reads the value without displaying it and is
 * allowed.
 *
 * If this fails on a legitimately non-display use, do not widen the exception
 * list first — check whether the value reaches a screen.
 *
 * `<InlineMathText value={…question_text} />` is allowed: that component is the
 * OTHER correct answer to the same problem. `plainTextFromAuthoredMath` lowers
 * TeX to readable text for places that can only hold a string (a `title=`, a
 * one-line list label); `InlineMathText` renders it as real maths. Both leave
 * the reader without raw delimiters, which is the whole point of this guard —
 * so a surface that can afford real rendering should not be pushed into
 * flattening instead.
 */
import { describe, expect, it } from "vitest";
// web-own (test-infra): tsconfig web CÓ Node types nên KHÔNG cần @ts-expect-error
// như bản studio (giữ lại sẽ TS2578) — xem checklist cuối detokenize-players.mjs.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

// This guard scans the consuming app's modules. It runs in TWO layouts:
// the monorepo (core at packages/core, app modules 4 levels up then into
// apps/learner/src/modules) and the flat client delivery (core at src/core,
// app modules 2 levels up at src/modules).
// web-own (delivery): the flat-layout fallback is not upstreamed to studio —
// copy đè từ studio sẽ làm guard này vỡ trong snapshot bàn giao.
const modulesDirCandidate = [
  join(__dirname, "..", "..", "..", "..", "apps", "learner", "src", "modules"),
  join(__dirname, "..", "..", "modules"),
].find((candidate) => existsSync(candidate));

if (!modulesDirCandidate) {
  throw new Error("app modules directory not found in either layout");
}
const MODULES_DIR: string = modulesDirCandidate;

/** `{claim.question_text`, `{q?.item.question_text` — the JSX render shape. */
const JSX_QUESTION_TEXT = /\{\s*[A-Za-z0-9_$?.]*\.question_text\b(.*)$/;

function collectTsxFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...collectTsxFiles(path));
      continue;
    }
    if (entry.name.endsWith(".tsx") && !entry.name.includes(".test.")) out.push(path);
  }
  return out;
}

describe("authored maths in plain-text question labels", () => {
  it("never renders question_text into JSX without lowering its TeX", () => {
    const offenders: string[] = [];

    for (const file of collectTsxFiles(MODULES_DIR)) {
      const source: string = readFileSync(file, "utf8");
      source.split("\n").forEach((line: string, index: number) => {
        const match = JSX_QUESTION_TEXT.exec(line);
        if (!match) return;
        if (line.includes("plainTextFromAuthoredMath")) return;
        // Renders the TeX rather than flattening it — see the header note.
        if (line.includes("InlineMathText")) return;
        // Read-but-do-not-display: `{item.question_text && (…)}`.
        if (match[1].trimStart().startsWith("&&")) return;
        offenders.push(`${file.slice(MODULES_DIR.length + 1)}:${index + 1} — ${line.trim()}`);
      });
    }

    expect(offenders).toEqual([]);
  });
});
