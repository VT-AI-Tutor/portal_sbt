/**
 * Mind map player — build-your-own (record-only, manual).
 * type: mind_map
 *
 * Student builds a mind map: add nodes and connect each to a chosen parent.
 * No grading: every change reports "incomplete".
 */
import React, { useState } from "react";
import { motion } from "motion/react";
import { Plus, Trash2 } from "lucide-react";
import { PlayerShell, useGrading, type PlayerProps } from "./shared";
import { useSkin } from "@/core/exercise/skin";
import { RichTextValue } from "@/core/rich-text/RichTextValue";
import { plainTextFromHtml } from "@/core/rich-text/html";

export interface MindMapNode {
  id: string;
  label: string;
}

export interface MindMapEdge {
  from: string;
  to: string;
}

export interface MindMapPlayerProps extends PlayerProps {
  /** Label for the central/root node (default "Chủ đề chính"). */
  rootLabel?: string;
  /** Pre-seeded child nodes (connected to root). */
  seedNodes?: MindMapNode[];
}

/** Emitted answer shape. */
export interface MindMapAnswer {
  nodes: MindMapNode[];
  edges: MindMapEdge[];
}

const ROOT_ID = "__root__";

/**
 * Parse a parent-supplied answer ({nodes, edges} — the emitted shape) into
 * sanitized state, or null when it is not a mind-map answer. Malformed nodes
 * and edges pointing at unknown ids are dropped safely.
 */
function parseMindMapAnswer(value: unknown): MindMapAnswer | null {
  if (!value || typeof value !== "object") return null;
  const { nodes, edges } = value as { nodes?: unknown; edges?: unknown };
  if (!Array.isArray(nodes) || !Array.isArray(edges)) return null;
  const cleanNodes: MindMapNode[] = [];
  for (const node of nodes) {
    if (!node || typeof node !== "object") continue;
    const { id, label } = node as { id?: unknown; label?: unknown };
    if (typeof id === "string" && id !== ROOT_ID && typeof label === "string") {
      cleanNodes.push({ id, label });
    }
  }
  const ids = new Set([ROOT_ID, ...cleanNodes.map((n) => n.id)]);
  const cleanEdges: MindMapEdge[] = [];
  for (const edge of edges) {
    if (!edge || typeof edge !== "object") continue;
    const { from, to } = edge as { from?: unknown; to?: unknown };
    if (typeof from === "string" && typeof to === "string" && ids.has(from) && ids.has(to)) {
      cleanEdges.push({ from, to });
    }
  }
  return { nodes: cleanNodes, edges: cleanEdges };
}

export const MindMapPlayer: React.FC<MindMapPlayerProps> = ({
  rootLabel = "Chủ đề chính",
  seedNodes,
  onAnswerChange,
  onComplete,
  onStatusChange,
  submitted = false,
  answer,
  ...shell
}) => {
  const skin = useSkin();
  const { status, report } = useGrading({ onAnswerChange, onComplete, onStatusChange });

  const rootNode: MindMapNode = { id: ROOT_ID, label: rootLabel };
  // Kênh khôi phục cha cấp (`answer` = {nodes, edges} đúng shape emit) — YesNo
  // selectionKey pattern: chỉ reset khi cha đưa đáp án khác ngữ nghĩa (không
  // reset khi echo). Không remount. Không có answer → seed như cũ.
  const restored = parseMindMapAnswer(answer);
  const initialNodes = restored ? restored.nodes : seedNodes ?? [];
  const initialEdges = restored
    ? restored.edges
    : (seedNodes ?? []).map((n) => ({ from: ROOT_ID, to: n.id }));
  const answerKey = JSON.stringify(restored);
  const [nodes, setNodes] = useState<MindMapNode[]>(initialNodes);
  const [edges, setEdges] = useState<MindMapEdge[]>(initialEdges);
  const [draft, setDraft] = useState("");
  const [parent, setParent] = useState<string>(ROOT_ID);
  const [syncedKey, setSyncedKey] = useState(answerKey);
  if (syncedKey !== answerKey) {
    setSyncedKey(answerKey);
    if (JSON.stringify({ nodes, edges }) !== answerKey) {
      setNodes(initialNodes);
      setEdges(initialEdges);
      if (parent !== ROOT_ID && !initialNodes.some((n) => n.id === parent)) setParent(ROOT_ID);
    }
  }

  const locked = submitted || status === "success";

  const allNodes = [rootNode, ...nodes];

  const emit = (nextNodes: MindMapNode[], nextEdges: MindMapEdge[]) => {
    report({ nodes: nextNodes, edges: nextEdges }, "incomplete");
  };

  const addNode = () => {
    const label = draft.trim();
    if (locked || !label) return;
    const id = `n_${crypto.randomUUID()}`;
    const nextNodes = [...nodes, { id, label }];
    const nextEdges = [...edges, { from: parent, to: id }];
    setNodes(nextNodes);
    setEdges(nextEdges);
    setDraft("");
    emit(nextNodes, nextEdges);
  };

  const removeNode = (id: string) => {
    if (locked) return;
    // Drop the node, its edges, and re-parent nothing (also drop descendant edges).
    const nextNodes = nodes.filter((n) => n.id !== id);
    const nextEdges = edges.filter((e) => e.from !== id && e.to !== id);
    setNodes(nextNodes);
    setEdges(nextEdges);
    if (parent === id) setParent(ROOT_ID);
    emit(nextNodes, nextEdges);
  };

  const childrenOf = (id: string) => edges.filter((e) => e.from === id).map((e) => e.to);

  const renderNode = (node: MindMapNode, depth: number) => {
    const colors = ["bg-emerald-500", "bg-blue-500", "bg-purple-500", "bg-orange-500", "bg-fuchsia-500"];
    const ci = depth % colors.length;
    const kids = childrenOf(node.id);
    return (
      <div key={node.id} className="flex flex-col">
        <div className="flex items-center gap-2">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className={`inline-flex items-center gap-2 text-sm sm:text-base ${
              skin.chip?.("idle", "primary") ??
              `px-4 py-2 rounded-2xl border-4 border-white shadow-md ${colors[ci]} text-white font-black`
            }`}
          >
            <RichTextValue value={node.label} />
            {node.id !== ROOT_ID && !locked && (
              <button
                type="button"
                onClick={() => removeNode(node.id)}
                className={skin.emphasis?.("primary", "soft") ?? "text-white/80 hover:text-white"}
                aria-label="Xóa nhánh"
              >
                <Trash2 size={16} />
              </button>
            )}
          </motion.div>
        </div>
        {kids.length > 0 && (
          <div className="ml-6 sm:ml-10 mt-2 flex flex-col gap-2 border-l-4 border-slate-200 pl-4 sm:pl-6">
            {kids.map((kid) => {
              const kn = nodes.find((n) => n.id === kid);
              return kn ? renderNode(kn, depth + 1) : null;
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <PlayerShell {...shell} submitted={submitted}>
      {/* Builder controls */}
      {!locked && (
        <div className={`p-4 sm:p-5 shadow-lg mb-5 flex flex-col gap-3 ${skin.panel?.("card") ?? "bg-white/60 rounded-3xl border-4 border-white"}`}>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") addNode();
              }}
              placeholder="Nội dung nhánh mới..."
              className={
                skin.input?.("idle")
                  ? `flex-1 ${skin.input("idle")}`
                  : "flex-1 px-4 py-2.5 rounded-2xl border-4 border-slate-200 bg-slate-100 focus:border-emerald-300  focus:bg-white outline-none font-bold text-sm sm:text-base text-slate-800 placeholder:text-slate-500"
              }
            />
            <select
              value={parent}
              onChange={(e) => setParent(e.target.value)}
              className={`px-4 py-2.5 rounded-2xl outline-none text-sm ${skin.input?.("idle") ?? "border-4 border-slate-200 bg-slate-100 focus:border-emerald-300  font-bold text-slate-800"}`}
            >
              {allNodes.map((n) => (
                // <option> chỉ chứa text — render <span>/markup bên trong là
                // invalid HTML (React hydration warning); hạ về plain text.
                <option key={n.id} value={n.id}>
                  Nối vào: {plainTextFromHtml(n.label ?? "")}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={addNode}
              disabled={draft.trim().length === 0}
              className={
                skin.actionButton?.(draft.trim().length > 0, "success")
                  ? `flex items-center justify-center gap-1.5 ${skin.actionButton(draft.trim().length > 0, "success")}`
                  : "flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-2xl border-4 border-emerald-400 bg-emerald-400 text-white font-black text-sm shadow-md hover:bg-emerald-500 transition-all disabled:opacity-40"
              }
            >
              <Plus size={18} /> Thêm nhánh
            </button>
          </div>
        </div>
      )}

      {/* Tree */}
      <div className={`p-4 sm:p-6 shadow-inner ${skin.panel?.("inset") ?? "bg-white/40 rounded-3xl border-4 border-white"}`}>
        {renderNode(rootNode, 0)}
      </div>
    </PlayerShell>
  );
};
