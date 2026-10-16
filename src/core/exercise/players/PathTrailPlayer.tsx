/**
 * P — Path trail wrapper.
 * type: path_trail
 *
 * A presentation layer hosting ONE child (a PathConnectPlayer) via a render-prop.
 * It does NOT grade — it forwards the child's answer and overlays a "trail"
 * progress UI. stepIndex is derived from the child's emitted answer length when
 * the answer is an array (the path). Reports verdict "incomplete" with
 * presentation meta { progress, stepIndex }.
 */
import React, { useCallback, useState } from "react";
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

export interface PathTrailPlayerProps extends PlayerProps {
  child: ChildEntry;
  /** Total steps in the trail; enables a 0–100% progress readout. */
  totalSteps?: number;
}

export const PathTrailPlayer: React.FC<PathTrailPlayerProps> = ({
  child,
  totalSteps,
  onAnswerChange,
  onComplete,
  onStatusChange,
  submitted = false,
  answer,
  ...shell
}) => {
  const skin = useSkin();
  const { report } = useGrading({ onAnswerChange, onComplete, onStatusChange });
  // Kênh khôi phục: emit là envelope { answer, progress, stepIndex } — thanh
  // tiến độ hydrate lại từ độ dài mảng answer bên trong. Bản thân CHILD được
  // khôi phục qua dispatch (adaptChild bóc envelope và đưa mảng xuống prop
  // `answer` của child), không cần gì thêm ở đây. Sync-in-render kiểu
  // YesNoPlayer để echo từ chính report của mình không reset gì.
  const restoredStep = (() => {
    if (!answer || typeof answer !== "object" || Array.isArray(answer)) return null;
    const inner = (answer as Record<string, unknown>).answer;
    return Array.isArray(inner) ? inner.length : null;
  })();
  const restoredKey = JSON.stringify(restoredStep);
  const [stepIndex, setStepIndex] = useState(restoredStep ?? 0);
  const [syncedKey, setSyncedKey] = useState(restoredKey);
  if (syncedKey !== restoredKey) {
    setSyncedKey(restoredKey);
    if (restoredStep !== null && stepIndex !== restoredStep) setStepIndex(restoredStep);
  }

  const recordAnswer = useCallback(
    (a: unknown) => {
      let nextStep = 0;
      if (Array.isArray(a)) nextStep = a.length;
      setStepIndex(nextStep);
      const progress =
        totalSteps != null && totalSteps > 0 ? nextStep / totalSteps : undefined;
      report({ answer: a, progress, stepIndex: nextStep }, "incomplete");
    },
    [report, totalSteps],
  );

  const progressPct =
    totalSteps != null && totalSteps > 0
      ? Math.min(100, Math.round((stepIndex / totalSteps) * 100))
      : null;

  const dots = totalSteps != null && totalSteps > 0 ? totalSteps : null;

  return (
    <PlayerShell {...shell} submitted={submitted}>
      {/* Trail / stepper */}
      <div className="mb-6">
        <div className={`flex items-center justify-between mb-2 text-sm ${skin.emphasis?.("primary", "strong") ?? "font-black text-violet-600"}`}>
          <span>
            Bước {stepIndex}
            {totalSteps != null ? ` / ${totalSteps}` : ""}
          </span>
          {progressPct != null && <span>{progressPct}%</span>}
        </div>

        {dots != null ? (
          <div className="flex items-center gap-1.5 flex-wrap">
            {Array.from({ length: dots }).map((_, i) => {
              const filled = i < stepIndex;
              return (
                <React.Fragment key={i}>
                  <span
                    className={`w-3.5 h-3.5 ${
                      skin.dropZone?.(filled ? "filled" : "idle") ??
                      `rounded-full border-2 ${
                        filled
                          ? "bg-violet-400 border-violet-500"
                          : "bg-white border-violet-200 "
                      }`
                    }`}
                    aria-hidden="true"
                  />
                  {i < dots - 1 && (
                    <span
                      className={`w-4 border-t-2 border-dotted ${
                        skin.accent
                          ? `border-current ${filled ? skin.accent("primary", "text") : (skin.emphasis?.("neutral", "soft") ?? "")}`
                          : filled
                            ? "border-violet-400"
                            : "border-violet-200 "
                      }`}
                      aria-hidden="true"
                    />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        ) : (
          <div className={`h-3 rounded-full border-2 overflow-hidden ${skin.panel?.("inset") ?? "bg-violet-100  border-violet-200 "}`}>
            <div
              className={`h-full transition-all ${skin.accent?.("primary", "fill") ?? "bg-violet-400"}`}
              style={{ width: progressPct != null ? `${progressPct}%` : "0%" }}
            />
          </div>
        )}
      </div>

      {/* The hosted child */}
      <div
        key={child.id}
        className={`p-4 sm:p-5 shadow-sm ${
          skin.panel?.("card") ??
          "rounded-3xl border-4 border-slate-200 bg-white/80"
        }`}
      >
        {child.render({
          submitted,
          onAnswerChange: recordAnswer,
          onStatusChange: () => {},
        })}
      </div>
    </PlayerShell>
  );
};
