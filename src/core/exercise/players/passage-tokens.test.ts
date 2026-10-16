import { expect, it } from "vitest";
import type { RichContent, RichTextRun } from "@/core/question-schema";
import {
  passageBlocksFrom,
  passagePlainText,
  sliceRuns,
  tokenizePassage,
  unrenderablePassageBlocks,
} from "./passage-tokens";

const BODY = "Dưới mái trường mới, sao tiếng trống rung động kéo dài!";
const SOURCE = "(Theo Ngô Quân Miện)";

function run(text: string, annotations: RichTextRun["annotations"] = {}): RichTextRun {
  return { text, annotations };
}

function words(tokens: { text: string; wordIndex: number | null }[]): string[] {
  return tokens.filter((t) => t.wordIndex !== null).map((t) => t.text);
}

it("tokenizePassage keeps the legacy word/gap contract", () => {
  const tokens = tokenizePassage("con mèo!");
  expect(tokens.map((t) => [t.text, t.wordIndex])).toEqual([
    ["con", 0],
    [" ", null],
    ["mèo", 1],
    ["!", null],
  ]);
});

it("lifts a legacy plain passage into one block", () => {
  const blocks = passageBlocksFrom(undefined, BODY);
  expect(blocks).toHaveLength(1);
  expect(blocks[0].align).toBeUndefined();
  expect(blocks[0].text).toBe(BODY);
  expect(words(blocks[0].tokens)).toEqual(words(tokenizePassage(BODY)));
});

// Câu cũ dựng dòng nguồn trích bằng "\n" giữa passage. Runs vẽ ra HTML, nơi
// "\n" không phải ngắt dòng — gộp cả chuỗi vào một block là hàn dòng nguồn
// trích vào đuôi bài đọc, ngay trên màn hình học sinh và không báo gì.
it("splits a legacy passage on its line breaks, keeping the word indices", () => {
  const blocks = passageBlocksFrom(undefined, `${BODY}\n${SOURCE}`);

  expect(blocks.map((b) => b.text)).toEqual([BODY, SOURCE]);
  expect(blocks.every((b) => b.align === undefined)).toBe(true);
  expect(words(blocks.flatMap((b) => b.tokens))).toEqual(
    words(tokenizePassage(`${BODY}\n${SOURCE}`)),
  );
});

it("counts word indices straight through a block boundary", () => {
  const content: RichContent = {
    blocks: [
      { type: "paragraph", content: [run(BODY)] },
      { type: "paragraph", align: "right", content: [run(SOURCE)] },
    ],
  };
  const blocks = passageBlocksFrom(content, undefined);
  const bodyWords = words(blocks[0].tokens).length;

  const sourceWords = blocks[1].tokens.filter((t) => t.wordIndex !== null);
  expect(sourceWords.map((t) => t.text)).toEqual(["Theo", "Ngô", "Quân", "Miện"]);
  expect(sourceWords[0].wordIndex).toBe(bodyWords);
});

it("keeps per-block alignment so the source line can sit on the right", () => {
  const content: RichContent = {
    blocks: [
      { type: "paragraph", content: [run(BODY)] },
      { type: "paragraph", align: "right", content: [run(SOURCE)] },
    ],
  };
  const blocks = passageBlocksFrom(content, undefined);
  expect(blocks[0].align).toBeUndefined();
  expect(blocks[1].align).toBe("right");
});

it("never lets inline formatting shift a word index", () => {
  const plain: RichContent = { blocks: [{ type: "paragraph", content: [run("rung động kéo dài")] }] };
  const marked: RichContent = {
    blocks: [
      {
        type: "paragraph",
        content: [run("rung "), run("động", { bold: true }), run(" kéo dài")],
      },
    ],
  };
  expect(words(passageBlocksFrom(marked, undefined)[0].tokens)).toEqual(
    words(passageBlocksFrom(plain, undefined)[0].tokens),
  );
});

it("does not tokenize markup from a legacy inline-HTML block", () => {
  const content: RichContent = {
    blocks: [{ type: "paragraph", text: "rung <strong>động</strong> kéo dài" }],
  };
  expect(words(passageBlocksFrom(content, undefined)[0].tokens)).toEqual([
    "rung",
    "động",
    "kéo",
    "dài",
  ]);
});

it("projects blocks to a plain passage the grader can index", () => {
  const content: RichContent = {
    blocks: [
      { type: "paragraph", content: [run("Dưới mái "), run("trường", { bold: true })] },
      { type: "paragraph", align: "right", content: [run(SOURCE)] },
    ],
  };
  const plain = passagePlainText(content);
  expect(plain).toBe(`Dưới mái trường\n${SOURCE}`);
  expect(plain).not.toContain("<");
  expect(plain).not.toContain("right");
});

it("tokenizes the projected plain text exactly like the blocks it came from", () => {
  const content: RichContent = {
    blocks: [
      { type: "paragraph", content: [run(BODY)] },
      { type: "paragraph", align: "right", content: [run("(", {}), run("Theo", { italic: true }), run(" Ngô Quân Miện)")] },
    ],
  };
  const fromBlocks = passageBlocksFrom(content, undefined).flatMap((b) => words(b.tokens));
  const fromPlain = words(tokenizePassage(passagePlainText(content)));
  expect(fromBlocks).toEqual(fromPlain);
});

it("slices a word that straddles two runs into its own formatted pieces", () => {
  const runs = [run("đâ", { bold: true }), run("m chồi")];
  expect(sliceRuns(runs, 0, 3)).toEqual([
    { text: "đâ", annotations: { bold: true } },
    { text: "m", annotations: {} },
  ]);
});

it("slices a run range that sits inside a single run", () => {
  const runs = [run("rung động", { italic: true })];
  expect(sliceRuns(runs, 5, 9)).toEqual([{ text: "động", annotations: { italic: true } }]);
});

it("keeps a pasted list's words in the graded passage", () => {
  // Lists are not offered by the passage toolbar, but a paste can still carry
  // one — dropping the block would delete the words from grading silently.
  const content: RichContent = {
    blocks: [
      { type: "paragraph", content: [run("Đọc đoạn sau:")] },
      {
        type: "list",
        ordered: true,
        items: ["con mèo", "con chó"],
        itemsRuns: [[run("con "), run("mèo", { bold: true })], [run("con chó")]],
      },
    ],
  };
  const blocks = passageBlocksFrom(content, undefined);

  expect(blocks.map((b) => b.text)).toEqual(["Đọc đoạn sau:", "con mèo", "con chó"]);
  expect(passagePlainText(content)).toBe("Đọc đoạn sau:\ncon mèo\ncon chó");
  expect(blocks.flatMap((b) => words(b.tokens))).toEqual(["Đọc", "đoạn", "sau", "con", "mèo", "con", "chó"]);
  // The bold run survives on its own item, so the picker can still show it.
  expect(blocks[1].runs).toEqual([
    { text: "con ", annotations: {} },
    { text: "mèo", annotations: { bold: true } },
  ]);
});

it("falls back to a list item's plain text when it carries no runs", () => {
  const content: RichContent = {
    blocks: [{ type: "list", items: ["con <strong>mèo</strong>"] }],
  };
  const blocks = passageBlocksFrom(content, undefined);
  expect(blocks[0].text).toBe("con mèo");
  expect(words(blocks[0].tokens)).toEqual(["con", "mèo"]);
});

it("names the blocks a passage cannot turn into words", () => {
  const content: RichContent = {
    blocks: [
      { type: "paragraph", content: [run("Đọc đoạn sau:")] },
      { type: "image", url: "/uploads/a.png" },
      { type: "list", items: ["con mèo"] },
      { type: "table", headers: ["a"], rows: [["b"]] },
    ],
  };
  // Paragraph and list carry words; image and table do not, and the player has
  // no place to draw them — so the editor must be able to say so out loud.
  expect(unrenderablePassageBlocks(content)).toEqual(["image", "table"]);
});

it("reports nothing unrenderable for a passage of plain paragraphs", () => {
  const content: RichContent = { blocks: [{ type: "paragraph", content: [run(BODY)] }] };
  expect(unrenderablePassageBlocks(content)).toEqual([]);
});
