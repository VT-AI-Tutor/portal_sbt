import { createElement, type ElementType } from "react";
import { resolveAssetUrl } from "@/core/content/assetUrl";
import { MathRenderer } from "@/core/math/MathRenderer";
import { RichTextValue } from "@/core/rich-text/RichTextValue";
import type { RichTextRun } from "@/core/question-schema";

/** Read-only renderer for a `content.blocks` array (learner view). */

interface Block {
  type: string;
  content?: RichTextRun[];
  text?: string;
  latex?: string;
  style?: string;
  level?: number;
  ordered?: boolean;
  items?: string[];
  url?: string;
  alt?: string;
  width?: string;
  align?: string;
  rows?: string[][];
}
export interface RichContent {
  blocks?: Block[];
}

function imageStyle(block: Block): React.CSSProperties {
  const style: React.CSSProperties = {
    maxWidth: block.width ?? "100%",
    maxHeight: "220px",
    width: "auto",
    height: "auto",
  };
  if (block.align === "center") style.margin = "0.5rem auto";
  else if (block.align === "left") style.float = "left";
  else if (block.align === "right") style.float = "right";
  return style;
}

export function ContentBlocksView({
  content,
  className,
}: {
  content: RichContent | undefined;
  className?: string;
}) {
  const blocks = content?.blocks ?? [];
  if (blocks.length === 0) return null;

  return (
    <div className={className}>
      {blocks.map((block, i) => {
        switch (block.type) {
          case "image":
            return (
              <img
                key={i}
                src={resolveAssetUrl(block.url)}
                alt={block.alt ?? ""}
                style={imageStyle(block)}
                className="rounded-lg"
              />
            );
          case "math":
            return (
              <MathRenderer
                key={i}
                latex={block.latex}
                text={block.text}
                className="my-3 overflow-x-auto text-foreground"
              />
            );
          case "heading": {
            const level =
              block.level && block.level >= 1 && block.level <= 6
                ? block.level
                : 2;
            return createElement(
              RichTextValue,
                { key: i, as: `h${level}` as ElementType, className: "my-2 font-bold", value: block.content ?? block.text },
            );
          }
          case "list": {
            const Tag = block.ordered ? "ol" : "ul";
            return (
              <Tag
                key={i}
                className={
                  block.ordered
                    ? "my-1.5 list-decimal pl-5"
                    : "my-1.5 list-disc pl-5"
                }
              >
                  {(block.items ?? []).map((it, j) => (
                    <RichTextValue key={j} as="li" value={it} />
                  ))}
              </Tag>
            );
          }
          case "table":
            return (
              <table key={i} className="my-2 w-full border-collapse">
                <tbody>
                  {(block.rows ?? []).map((row, r) => (
                    <tr key={r}>
                      {row.map((cell, c) => (
                        <RichTextValue key={c} as="td" className="border p-1.5 align-top" value={cell} />
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            );
          case "paragraph":
          default:
            return (
              <RichTextValue
                key={i}
                as="p"
                className={
                  block.style === "context-box"
                    ? "my-2 whitespace-pre-line rounded-lg border bg-muted/40 p-3"
                    : "my-1.5 whitespace-pre-line"
                }
                value={block.content ?? block.text}
              />
            );
        }
      })}
    </div>
  );
}
