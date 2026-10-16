/**
 * Path connect — build an ordered route through nodes.
 * schema: path_connect
 *
 * Student clicks nodes to build a path IN ORDER. A node may only be added if it
 * is the next correct node in `correctPath`; clicking a wrong node is BLOCKED
 * (flash red, not added). The path is drawn as connected SVG line segments
 * through the chosen nodes. The path is complete when it equals correctPath →
 * report(path, "correct"). "Làm lại" resets. Emit = path:string[].
 *
 * (This player is later hosted by PathTrailPlayer.)
 */
import React, { useRef, useState } from "react";
import { motion } from "motion/react";
import { MoveArea } from "@/core/exercise/field-resize-context";
import { PlayerShell, playError, useGrading, type PlayerProps } from "./shared";
import { restoredStringArray, useRestoredAnswerState } from "./answer-restore";
import { useSkin } from "@/core/exercise/skin";
import { RichTextValue } from "@/core/rich-text/RichTextValue";
import { nameOrOrdinal } from "./answer-name";

export interface PathConnectNode {
  id: string;
  label: string;
  x: number; // normalized 0..1
  y: number; // normalized 0..1
}

export interface PathConnectPlayerProps extends PlayerProps {
  nodes: PathConnectNode[];
  /** ordered node ids forming the correct route */
  correctPath: string[];
}

export const PathConnectPlayer: React.FC<PathConnectPlayerProps> = ({
  nodes,
  correctPath,
  onAnswerChange,
  onComplete,
  onStatusChange,
  submitted = false,
  selfAssessment,
  answer,
  ...shell
}) => {
  const skin = useSkin();
  // Kênh khôi phục: đáp án đã lưu là chính mảng node id theo thứ tự (emit shape).
  // Khi được host bởi PathTrailPlayer, dispatch đã bóc envelope {answer,...}
  // nên prop `answer` ở đây vẫn là mảng.
  const [path, setPath] = useRestoredAnswerState<string[]>(restoredStringArray(answer));
  const [flashId, setFlashId] = useState<string | null>(null);
  // Edit-preview geometry: the aspect-ratio board normalizes node x/y, and
  // each node wrapper gets a stable RefObject for the MoveArea drag origin.
  const boardRef = useRef<HTMLDivElement>(null);
  const nodeRefObjects = useRef<Record<string, React.MutableRefObject<HTMLSpanElement | null>>>({});
  const nodeRefObject = (id: string) => (nodeRefObjects.current[id] ??= { current: null });
  const { status, report } = useGrading({ onAnswerChange, onComplete, onStatusChange });

  const hasKey = correctPath.length > 0;
  const recordOnly = selfAssessment === true || !hasKey;
  const locked = submitted || status === "success";

  const nodeById = (id: string) => nodes.find((n) => n.id === id);
  const reveal = !recordOnly
    ? correctPath.map((id) => nameOrOrdinal(nodeById(id), nodes.findIndex((n) => n.id === id), "Điểm")).join(" → ")
    : null;

  const clickNode = (id: string) => {
    if (locked) return;
    if (path.includes(id)) return;

    // Record-only mode: append freely, never grade.
    if (recordOnly) {
      const next = [...path, id];
      setPath(next);
      report(next, "incomplete");
      return;
    }

    const expected = correctPath[path.length];
    if (id !== expected) {
      // Wrong node — block, flash red + error sound, do not add.
      playError();
      setFlashId(id);
      setTimeout(() => setFlashId((cur) => (cur === id ? null : cur)), 450);
      return;
    }

    const next = [...path, id];
    setPath(next);

    if (next.length === correctPath.length) {
      report(next, "correct");
    } else {
      onAnswerChange?.(next);
    }
  };

  const reset = () => {
    if (status === "success") return;
    setPath([]);
    setFlashId(null);
    onAnswerChange?.([]);
  };

  return (
    <PlayerShell {...shell} submitted={submitted} answerReveal={reveal}>
      <div className={`overflow-hidden ${skin.panel?.("board") ?? "bg-white/60 rounded-3xl border-4 border-white shadow-lg"}`}>
        <div
          ref={boardRef}
          className="relative w-full select-none"
          style={{ paddingBottom: "60%" /* 5:3 aspect ratio */ }}
        >
          {/* SVG path through chosen nodes */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none z-10 overflow-visible">
            {path.slice(1).map((id, i) => {
              const from = nodeById(path[i]);
              const to = nodeById(id);
              if (!from || !to) return null;
              return (
                <motion.line
                  key={`${path[i]}-${id}`}
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 0.3 }}
                  x1={`${from.x * 100}%`}
                  y1={`${from.y * 100}%`}
                  x2={`${to.x * 100}%`}
                  y2={`${to.y * 100}%`}
                  stroke="#6366f1"
                  strokeWidth={5}
                  strokeLinecap="round"
                  className="opacity-80"
                />
              );
            })}
          </svg>

          {/* Nodes */}
          {nodes.map((n) => {
            const order = path.indexOf(n.id);
            const inPath = order !== -1;
            const isFlashing = flashId === n.id;
            return (
              // The wrapper (not the button) carries the positioning so the
              // edit-preview MoveArea keeps receiving pointer events when the
              // button is disabled. Visual layout is unchanged.
              <span
                key={n.id}
                ref={nodeRefObject(n.id)}
                className="group absolute -translate-x-1/2 -translate-y-1/2 z-20"
                style={{ left: `${n.x * 100}%`, top: `${n.y * 100}%` }}
              >
                <button
                  type="button"
                  onClick={() => clickNode(n.id)}
                  disabled={locked}
                  className="relative flex flex-col items-center gap-1"
                >
                  <div
                    className={`relative w-12 h-12 flex items-center justify-center text-sm transition-all shadow-md ${skin.emphasis?.("neutral", "strong") ?? "font-black"} ${
                      skin.dropZone?.(isFlashing ? "wrong" : inPath ? "filled" : "idle") ??
                      `rounded-full border-4 ${
                        isFlashing
                          ? "border-red-400 bg-red-100  text-red-600 scale-110"
                          : inPath
                            ? "border-indigo-500 bg-indigo-100  text-indigo-700  scale-110"
                            : "border-indigo-300  bg-white text-slate-800 hover:border-indigo-400 hover:scale-110"
                      }`
                    }`}
                  >
                    <RichTextValue value={n.label} />
                    {inPath && (
                      <span className={`absolute -top-2 -right-2 w-5 h-5 rounded-full text-[0.65rem] flex items-center justify-center border-2 border-white ${skin.badge?.("primary") ?? "bg-indigo-500 text-white font-black"}`}>
                        {order + 1}
                      </span>
                    )}
                  </div>
                </button>
                {/* Edit-preview only: renders null without a FieldResizeController. */}
                <MoveArea
                  fieldId={n.id}
                  unit="fraction"
                  anchor="center"
                  targetRef={nodeRefObject(n.id)}
                  containerRef={boardRef}
                />
              </span>
            );
          })}
        </div>
      </div>

      {!locked && (
        <div className="flex justify-center mt-6">
          <motion.button
            type="button"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.94 }}
            onClick={reset}
            className={
              skin.actionButton?.(true, "primary") ??
              "px-8 py-3 rounded-full border-4 border-indigo-500 bg-white text-indigo-600 font-black text-lg shadow-md hover:bg-indigo-50  transition-colors"
            }
          >
            Làm lại
          </motion.button>
        </div>
      )}
    </PlayerShell>
  );
};
