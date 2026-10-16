/**
 * P26 — Drag & drop / "zones".
 * schema: drag_drop · interactionType: "zones"
 *
 * Student drags chips from the tray into labeled zone boxes using native HTML5
 * drag-and-drop. In one_to_one mode each zone holds a single chip (dropping a
 * second chip swaps the previous one back to the tray). In many_to_one mode a
 * zone can collect any number of chips. "Kiểm tra" grades draggableId → zoneId
 * against correctMappings. Answer = Record<draggableId, zoneId>.
 *
 * TOUCH: native HTML5 drag never fires on iOS/iPadOS, so every placement is
 * also reachable by tapping — chạm thẻ trong khay để chọn, chạm vùng để đặt,
 * chạm thẻ đã đặt để trả về khay. Same grammar as Categorize/CardSort.
 */
import React, { useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { PlayerInlineFeedback, PlayerShell, groupedMappingReveal, useGrading, useHydratedRecordAnswer, useInstantGrading, type PlayerProps } from "./shared";
import { DraggableChip } from "./DraggableChip";
import { useSkin } from "@/core/exercise/skin";
import { RichTextValue } from "@/core/rich-text/RichTextValue";
import { joinReveal, revealName } from "./answer-name";

export interface DragToZonesPlayerProps extends PlayerProps {
  draggables: { id: string; text: string; imageUrl?: string }[];
  dropZones: { id: string; label: string }[];
  /** draggableId → zoneId */
  correctMappings: Record<string, string>;
  mode?: "one_to_one" | "many_to_one";
}

export const DragToZonesPlayer: React.FC<DragToZonesPlayerProps> = ({
  draggables,
  dropZones,
  correctMappings,
  mode = "one_to_one",
  answer,
  onAnswerChange,
  onComplete,
  onStatusChange,
  submitted = false,
  selfAssessment,
  instantFeedback = true,
  onElementGraded,
  onProgress,
  ...shell
}) => {
  // mappings: draggableId → zoneId. Hydrated in place from the parent-supplied
  // `answer` (the exact Record shape this player reports) — no key-remount.
  const skin = useSkin();
  const [mappings, setMappings] = useHydratedRecordAnswer(answer);
  const [dragId, setDragId] = useState<string | null>(null);
  // Tap-to-select fallback: the id waiting for a zone tap (touch/keyboard).
  const [selected, setSelected] = useState<string | null>(null);
  const [overZone, setOverZone] = useState<string | null>(null);
  const { status, setStatus, report, mode: gradeMode } = useGrading({ onAnswerChange, onComplete, onStatusChange });
  const recordOnly = selfAssessment === true || Object.keys(correctMappings ?? {}).length === 0;
  const elementIds = useMemo(() => draggables.map((d) => d.id), [draggables]);
  // buildAnswer must see the mappings of the CURRENT interaction, not the
  // render closure — commit() updates the ref before grading.
  const mappingsRef = useRef(mappings);
  mappingsRef.current = mappings;
  const instant = useInstantGrading({
    elementIds,
    instantFeedback,
    recordOnly,
    buildAnswer: () => mappingsRef.current,
    report,
    onElementGraded,
    onProgress,
  });
  const locked = submitted || (!instant.active && status === "success");
  const answerReveal = recordOnly
    ? null
    : // web-own: gộp theo nhóm (groupedMappingReveal) cho CẢ hai mode — one_to_one
      // mỗi vùng đúng một thẻ nên chỉ khác mỗi dấu, không đáng nuôi hai khuôn.
      groupedMappingReveal({ groups: dropZones, items: draggables, correctMappings }) ??
      joinReveal(
        Object.entries(correctMappings).map(([draggableId, zoneId]) => {
          const ii = draggables.findIndex((x) => x.id === draggableId);
          const gi = dropZones.findIndex((g) => g.id === zoneId);
          return [revealName(draggables[ii], ii, "Thẻ"), " → ", revealName(dropZones[gi], gi, "Vùng")];
        }),
      );

  const inZone = (zoneId: string) =>
    Object.entries(mappings).filter(([, z]) => z === zoneId).map(([d]) => d);
  const unplaced = draggables.filter((d) => !mappings[d.id]);

  const commit = (next: Record<string, string>) => {
    setMappings(next);
    mappingsRef.current = next;
    onAnswerChange?.(next);
    // Rearranging after a wrong self-check clears the error so retry is clean.
    if (status === "error") {
      setStatus("idle");
      onStatusChange?.("idle");
    }
  };

  const clearPending = () => {
    setDragId(null);
    setSelected(null);
    setOverZone(null);
  };

  /**
   * Place `id` in a zone. Both interactions land here: the native drag
   * (`dragId` on drop) and the tap fallback (`selected` on a zone tap).
   */
  const moveToZone = (id: string, zoneId: string) => {
    if (locked) return;
    const next = { ...mappings };
    if (mode === "one_to_one") {
      // swap any existing occupant of this zone back to the tray
      for (const occ of inZone(zoneId)) {
        delete next[occ];
        instant.clear(occ);
      }
    }
    next[id] = zoneId;
    commit(next);
    instant.grade(id, next[id] === correctMappings[id] ? "correct" : "incorrect");
    clearPending();
  };

  const moveToTray = (id: string) => {
    if (locked || !mappings[id]) return;
    const next = { ...mappings };
    delete next[id];
    commit(next);
    instant.clear(id);
    clearPending();
  };

  const dropToZone = (zoneId: string) => {
    const id = dragId ?? selected;
    if (!id) return;
    moveToZone(id, zoneId);
  };

  const dropToTray = () => {
    const id = dragId ?? selected;
    if (!id) return;
    moveToTray(id);
  };

  /** Tray tap = pick up / put down; a tap on a placed chip returns it. */
  const tapChip = (id: string, placed: boolean) => {
    if (locked) return;
    if (placed) moveToTray(id);
    else setSelected((cur) => (cur === id ? null : id));
  };

  const check = () => {
    if (locked) return;
    // No answer key (or self-assessment): record only, never fake a verdict.
    if (recordOnly) {
      report(mappings, "incomplete");
      return;
    }
    const keys = Object.keys(correctMappings);
    const ok =
      keys.every((k) => mappings[k] === correctMappings[k]) &&
      Object.keys(mappings).length === keys.length;
    report(mappings, ok ? "correct" : "incorrect");
  };

  // Drag source = shared module-scope `DraggableChip`; see its docblock for why
  // an inline component here would cancel the drag (#533/#563/#569).
  const chip = (id: string, text: string, imageUrl?: string, placed?: boolean) => {
    // Older zone payloads keep the picture inside rich-text `text` instead of
    // `imageUrl`. Treat both shapes as picture cards so natural-size workbook
    // scans cannot make the tray a single tall column.
    const pictureCard = Boolean(imageUrl) || /<img\b|!\[[^\]]*\]\(|data:image\//i.test(text);
    const rv = instant.reveal(id);
    const isSelected = selected === id;
    const chipState =
      rv === "correct"
        ? "correct"
        : rv === "incorrect"
          ? "wrong"
          : isSelected
            ? "selected"
            : placed
              ? "placed"
              : "idle";
    return (
      <DraggableChip
        key={id}
        wrapperClassName={pictureCard ? "w-44 max-w-full" : undefined}
        dragging={dragId === id}
        locked={locked}
        hoverScale={1.05}
        onDragStart={() => setDragId(id)}
        onDragEnd={() => { setDragId(null); setOverZone(null); }}
        onClick={(e) => { e.stopPropagation(); tapChip(id, !!placed); }}
        ariaLabel={text}
        className={`${
          skin.chip?.(chipState, "primary") ??
            `px-4 py-3 rounded-2xl border-4 font-bold text-sm sm:text-base shadow-md transition-colors ${
              rv === "correct"
                ? "border-green-400 bg-green-50  text-green-700 "
                : rv === "incorrect"
                  ? "border-red-400 bg-red-50  text-red-600"
                  : isSelected
                    ? "border-yellow-400 bg-yellow-100  text-yellow-800 "
                    : placed
                      ? "border-indigo-300  bg-indigo-100  text-indigo-800 "
                      : "border-white bg-indigo-50  text-slate-800 hover:border-indigo-300 "
          }`
        }${pictureCard ? " w-full p-2 [&_img]:!max-h-28 [&_img]:!max-w-full [&_img]:mx-auto" : ""}`}
      >
        {imageUrl && (
          <img src={imageUrl} alt={text} className="inline-block w-8 h-8 mr-1.5 rounded-lg object-contain align-middle" />
        )}
        <RichTextValue value={text} />
      </DraggableChip>
    );
  };

  return (
    <PlayerShell {...shell} submitted={submitted} answerReveal={answerReveal}>
      {/* Tray */}
      <div
        onDragOver={(e) => { if (!locked) e.preventDefault(); }}
        onDrop={dropToTray}
        className={`flex flex-wrap gap-2 mb-6 min-h-[64px] p-3 transition-colors ${
          skin.panel?.("tray", dragId || selected ? "active" : "idle") ??
          `rounded-3xl border-4 border-dashed ${dragId || selected ? "border-indigo-300  bg-indigo-50/60" : "border-slate-200 bg-white/40"}`
        }`}
      >
        <AnimatePresence>
          {unplaced.map((d) => (
            chip(d.id, d.text, d.imageUrl)
          ))}
        </AnimatePresence>
        {unplaced.length === 0 && (
          <span className={`italic text-sm self-center px-2 ${skin.emphasis?.("neutral", "soft") ?? "text-slate-500 font-bold"}`}>
            Đã kéo hết các thẻ rồi! 👍
          </span>
        )}
      </div>

      {/* Zones */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {dropZones.map((zone) => {
          const placed = inZone(zone.id);
          const active = overZone === zone.id && !!dragId;
          return (
            <div
              key={zone.id}
              onDragOver={(e) => { if (!locked) { e.preventDefault(); setOverZone(zone.id); } }}
              onDragLeave={() => setOverZone((z) => (z === zone.id ? null : z))}
              onDrop={() => dropToZone(zone.id)}
              onClick={() => { if (selected) moveToZone(selected, zone.id); }}
              className={`${
                skin.dropZone?.(active ? "active" : placed.length > 0 ? "filled" : "idle") ??
                `rounded-3xl border-4 p-4 min-h-[110px] transition-all shadow-lg ${
                  active
                    ? "border-dashed border-indigo-400 bg-indigo-50  scale-[1.02]"
                    : "border-white bg-white/60"
                }`
              } min-h-[110px] ${selected ? "cursor-pointer ring-2 ring-indigo-300" : ""}`}
            >
              <div className={`text-sm uppercase tracking-widest mb-3 ${skin.emphasis?.("primary", "strong") ?? "text-indigo-600 font-black"}`}>
                <RichTextValue value={zone.label} />
              </div>
              <div className="flex flex-wrap gap-2">
                <AnimatePresence>
                  {placed.map((dId) => {
                    const d = draggables.find((x) => x.id === dId);
                    return d ? chip(dId, d.text, d.imageUrl, true) : null;
                  })}
                </AnimatePresence>
                {placed.length === 0 && (
                  <span className={`italic text-sm self-center ${skin.emphasis?.("neutral", "soft") ?? "text-slate-500 font-bold"}`}>
                    Kéo hoặc chạm để đặt thẻ vào đây
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Parent-graded flows own the verdict — never show the self-check button. */}
      {gradeMode !== "parent" && !instant.active && !locked && !recordOnly && (
        <div className="mt-6 flex justify-center">
          <motion.button
            type="button"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.94 }}
            onClick={check}
            className={
              skin.actionButton?.(true, "primary") ??
              "px-8 py-3 rounded-full border-4 border-indigo-500 bg-indigo-400 text-white font-black text-lg shadow-md hover:bg-indigo-500 transition-all"
            }
          >
            Kiểm tra
          </motion.button>
        </div>
      )}

      {status === "success" && (
        <PlayerInlineFeedback kind="success" fallbackClass="mt-4 text-center text-green-600 font-black text-lg md:text-xl">
          Tuyệt vời! Tất cả đều đúng! 🎉
        </PlayerInlineFeedback>
      )}
      {status === "error" && !submitted && (
        <PlayerInlineFeedback kind="error" fallbackClass="mt-4 text-center text-red-500 font-black text-lg md:text-xl">
          Chưa đúng hết, thử sắp lại nhé! 🤔
        </PlayerInlineFeedback>
      )}
    </PlayerShell>
  );
};
