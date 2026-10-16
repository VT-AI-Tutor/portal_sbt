import React, { useState, useMemo } from 'react';
import { PlayerHeader } from '../players/shared';
import type { ContentBlock } from '../players/shared';

interface MindMapNode {
  id: string;
  label?: string;
  prefix?: string;
  nodeType: 'static' | 'input' | 'essay';
  rowLines?: number;
  acceptedAnswers?: string[];
}

interface MindMapEdge {
  from: string;
  to: string;
}

interface MindMapTaskProps {
  title: string;
  instruction?: string;
  /**
   * Full authored content (paragraphs + images). When present, PlayerHeader
   * renders every block in order instead of just the plain-text `title` — so a
   * multi-paragraph stem is not truncated to its first line (issue #558).
   */
  richContent?: { blocks?: ContentBlock[] };
  nodes: MindMapNode[];
  edges: MindMapEdge[];
  onComplete: () => void;
  onAnswerChange?: (answer: unknown) => void;
  /**
   * Parent-owned answer (Record<nodeId, string> — the emitted shape). The
   * runner remounts the player on every question switch and again on the
   * review screen, so without this channel every filled box comes back empty.
   */
  answer?: unknown;
  submitted?: boolean;
}

interface TreeNode extends MindMapNode {
  children: TreeNode[];
}

// Builds the render tree defensively: authored payloads occasionally carry
// duplicate node IDs, edges pointing at nodes that don't exist, or cycles
// (e.g. from a copy/paste mistake). None of these should silently drop valid
// nodes from the preview — we skip/warn on the bad parts and, if the graph
// somehow yields no roots at all, fall back to a flat list of every node
// rather than rendering nothing.
function buildTree(nodes: MindMapNode[], edges: MindMapEdge[]): TreeNode[] {
  const nodeMap = new Map<string, MindMapNode>();
  for (const n of nodes) {
    if (nodeMap.has(n.id)) {
      console.warn(`[MindMapTask] Duplicate node id "${n.id}" — ignoring the later occurrence.`);
      continue;
    }
    nodeMap.set(n.id, n);
  }

  const childMap = new Map<string, string[]>();
  const hasParent = new Set<string>();

  for (const e of edges) {
    if (!nodeMap.has(e.from) || !nodeMap.has(e.to)) {
      console.warn(`[MindMapTask] Dropping edge with unknown node reference: "${e.from}" -> "${e.to}".`);
      continue;
    }
    if (e.from === e.to) {
      console.warn(`[MindMapTask] Dropping self-referencing edge on node "${e.from}".`);
      continue;
    }
    const kids = childMap.get(e.from) ?? [];
    kids.push(e.to);
    childMap.set(e.from, kids);
    hasParent.add(e.to);
  }

  function toTree(id: string, ancestors: Set<string>): TreeNode {
    const node = nodeMap.get(id)!;
    const nextAncestors = new Set(ancestors);
    nextAncestors.add(id);
    const childIds = (childMap.get(id) ?? []).filter(cid => {
      if (nextAncestors.has(cid)) {
        console.warn(`[MindMapTask] Cycle detected: "${cid}" is an ancestor of itself via "${id}" — dropping that edge.`);
        return false;
      }
      return true;
    });
    return { ...node, children: childIds.map(cid => toTree(cid, nextAncestors)) };
  }

  // Roots: nodes with no incoming edge, in payload order.
  const rootIds = Array.from(nodeMap.keys()).filter(id => !hasParent.has(id));
  if (rootIds.length > 0) {
    return rootIds.map(id => toTree(id, new Set()));
  }

  // Every node has an incoming edge (fully cyclic graph) — rendering nothing
  // would hide valid content, so fall back to a flat list of all nodes.
  console.warn('[MindMapTask] No root nodes found (cyclic graph) — rendering a flat fallback list of all nodes.');
  return Array.from(nodeMap.values()).map(n => ({ ...n, children: [] }));
}

const NodeView: React.FC<{
  node: TreeNode;
  values: Record<string, string>;
  onChange: (id: string, val: string) => void;
  submitted: boolean;
  depth: number;
}> = ({ node, values, onChange, submitted, depth }) => {
  const colors = ['bg-blue-500', 'bg-emerald-500', 'bg-purple-500', 'bg-orange-500', 'bg-fuchsia-500'];
  const bgColors = ['bg-blue-50 ', 'bg-emerald-50 ', 'bg-purple-50 ', 'bg-orange-50 ', 'bg-fuchsia-50 '];
  const borderColors = ['border-blue-200 ', 'border-emerald-200 ', 'border-purple-200 ', 'border-orange-200 ', 'border-fuchsia-200 '];
  const ci = depth % colors.length;

  return (
    <div className="flex flex-col">
      <div className="flex items-start gap-3">
        {/* Node body */}
        <div className={`rounded-2xl border-4 ${borderColors[ci]} ${node.nodeType === 'static' ? bgColors[ci] : 'bg-white'} p-3 sm:p-4 shadow-md min-w-[140px] max-w-md`}>
          {node.nodeType === 'static' && (
            <div className={`font-black text-sm sm:text-base text-slate-800`}>
              {node.label}
            </div>
          )}
          {node.nodeType === 'input' && (
            <div className="flex items-center gap-2">
              {node.prefix && <span className="font-bold text-sm text-slate-500 shrink-0">{node.prefix}</span>}
              <input
                type="text"
                value={values[node.id] ?? ''}
                onChange={e => onChange(node.id, e.target.value)}
                disabled={submitted}
                placeholder="..."
                className="flex-1 px-3 py-1.5 rounded-xl border-2 border-dashed border-slate-200 focus:border-blue-400 outline-none font-bold text-sm text-slate-800 bg-slate-100 min-w-[80px]"
              />
            </div>
          )}
          {node.nodeType === 'essay' && (
            <div className="flex flex-col gap-1">
              {node.prefix && <span className="font-bold text-xs text-slate-500">{node.prefix}</span>}
              <textarea
                value={values[node.id] ?? ''}
                onChange={e => onChange(node.id, e.target.value)}
                disabled={submitted}
                rows={node.rowLines ?? 3}
                placeholder="Viết câu trả lời..."
                className="w-full px-3 py-2 rounded-xl border-2 border-dashed border-slate-200 focus:border-blue-400 outline-none font-bold text-sm text-slate-800 bg-slate-100 resize-none min-w-[160px]"
              />
            </div>
          )}
        </div>
      </div>

      {/* Children */}
      {node.children.length > 0 && (
        <div className="ml-6 sm:ml-10 mt-2 flex flex-col gap-2 border-l-4 border-slate-200 pl-4 sm:pl-6">
          {node.children.map(child => (
            <NodeView
              key={child.id}
              node={child}
              values={values}
              onChange={onChange}
              submitted={submitted}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
};

/** Parse a parent-supplied answer into Record<nodeId, string>, or null when it is not one. */
function parseAnswerValues(value: unknown): Record<string, string> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const clean: Record<string, string> = {};
  for (const [id, val] of Object.entries(value as Record<string, unknown>)) {
    if (typeof val === 'string') clean[id] = val;
  }
  return clean;
}

export const MindMapTask: React.FC<MindMapTaskProps> = ({
  title, instruction, richContent, nodes, edges,
  onAnswerChange, answer, submitted = false,
}) => {
  // Khoá hydrate tính theo NỘI DUNG (cùng luật với ConnectPointsTask): đáp án
  // cha dội ngược về (echo) không xoá chữ đang gõ, còn đáp án KHÁC ngữ nghĩa
  // (khôi phục bài đã lưu) thì thay hẳn state cục bộ.
  const restored = useMemo(() => parseAnswerValues(answer), [answer]);
  const hydrationKey = useMemo(() => JSON.stringify(restored), [restored]);
  const [draft, setDraft] = useState(() => ({ hydrationKey, values: restored ?? {} }));
  const values = draft.hydrationKey === hydrationKey ? draft.values : restored ?? {};

  const trees = useMemo(() => buildTree(nodes, edges), [nodes, edges]);

  const handleChange = (id: string, val: string) => {
    const next = { ...values, [id]: val };
    setDraft({ hydrationKey, values: next });
    onAnswerChange?.(next);
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 pb-2">
        <div className="max-w-4xl mx-auto">
          <PlayerHeader title={title} richContent={richContent} instruction={instruction} />

          <div className="flex flex-col gap-3">
            {trees.map(tree => (
              <NodeView
                key={tree.id}
                node={tree}
                values={values}
                onChange={handleChange}
                submitted={submitted}
                depth={0}
              />
            ))}
          </div>
        </div>
      </div>

    </div>
  );
};
