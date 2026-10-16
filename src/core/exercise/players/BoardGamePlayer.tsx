/**
 * P — Board game wrapper.
 * type: board_game
 *
 * Hosts child question players via a render-prop, drawing a simple horizontal
 * board track with a token. The current child is rendered below the board; a
 * child "success" advances boardPos by one tile. It does NOT grade — it
 * aggregates child answers and reports verdict "incomplete" with presentation
 * meta { boardPos }.
 */
import React, { useCallback, useRef, useState } from "react";
import { PlayerShell, useGrading, type PlayerProps } from "./shared";
import { useSkin } from "@/core/exercise/skin";

interface ChildEntry {
  id: string;
  /** Renders the inner question player. Provided by the caller. */
  render: (ctx: {
    onAnswerChange: (a: unknown) => void;
    submitted?: boolean;
    onStatusChange?: (s: "idle" | "success" | "error") => void;
  }) => React.ReactNode;
}

export interface BoardGamePlayerProps extends PlayerProps {
  children: ChildEntry[];
  /** Number of tiles on the track; defaults to the child count. */
  boardLength?: number;
}

export const BoardGamePlayer: React.FC<BoardGamePlayerProps> = ({
  children,
  boardLength,
  onAnswerChange,
  onComplete,
  onStatusChange,
  submitted = false,
  ...shell
}) => {
  const skin = useSkin();
  const { report } = useGrading({ onAnswerChange, onComplete, onStatusChange });
  const [, setAnswers] = useState<Record<string, unknown>>({});
  const [boardPos, setBoardPos] = useState(0);
  const boardPosRef = useRef(0);
  const answersRef = useRef<Record<string, unknown>>({});

  const length = boardLength ?? children.length;
  const tiles = Array.from({ length: Math.max(1, length) });

  const pushReport = useCallback(() => {
    report(
      { answers: answersRef.current, boardPos: boardPosRef.current },
      "incomplete",
    );
  }, [report]);

  const recordAnswer = useCallback(
    (childId: string, value: unknown) => {
      setAnswers((prev) => {
        const next = { ...prev, [childId]: value };
        answersRef.current = next;
        return next;
      });
      pushReport();
    },
    [pushReport],
  );

  const handleStatus = useCallback(
    (s: "idle" | "success" | "error") => {
      if (s !== "success") return;
      boardPosRef.current = Math.min(length, boardPosRef.current + 1);
      setBoardPos(boardPosRef.current);
      pushReport();
    },
    [pushReport, length],
  );

  const current = children[Math.min(boardPos, children.length - 1)];

  return (
    <PlayerShell {...shell} submitted={submitted}>
      {/* Board track */}
      <div className="mb-6 overflow-x-auto">
        <div className="flex items-center gap-2 min-w-max px-1 py-2">
          {tiles.map((_, i) => {
            const here = i === boardPos;
            const past = i < boardPos;
            return (
              <React.Fragment key={i}>
                <div
                  className={`relative flex items-center justify-center w-12 h-12 text-base shrink-0 ${
                    skin.panel?.("board", here ? "active" : past ? "filled" : "idle") ??
                    `font-black rounded-2xl border-4 ${
                      past
                        ? "bg-emerald-100  border-emerald-300  text-emerald-600"
                        : here
                          ? "bg-emerald-400 border-emerald-500 text-white"
                          : "bg-white border-slate-200 text-slate-500"
                    }`
                  }`}
                >
                  {i + 1}
                  {here && (
                    <span
                      className="absolute -top-4 text-xl leading-none"
                      aria-hidden="true"
                    >
                      🚩
                    </span>
                  )}
                </div>
                {i < tiles.length - 1 && (
                  <div className={`w-4 h-1 rounded-full shrink-0 ${skin.accent?.("neutral", "track") ?? "bg-slate-100"}`} />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Current question */}
      {current && (
        <div
          key={current.id}
          className={`p-4 sm:p-5 shadow-sm ${skin.panel?.("card") ?? "rounded-3xl border-4 border-slate-200 bg-white/80"}`}
        >
          {current.render({
            submitted,
            onAnswerChange: (a) => recordAnswer(current.id, a),
            onStatusChange: handleStatus,
          })}
        </div>
      )}
    </PlayerShell>
  );
};
