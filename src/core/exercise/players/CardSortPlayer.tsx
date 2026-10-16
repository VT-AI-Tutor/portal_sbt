/**
 * Card sort — deal cards from a tray into the right category pile.
 * schema: card_sort
 *
 * A deck of cards sits in a tray. Drag (native HTML5 DnD) or click-select then
 * tap a category pile to bucket a card. "Kiểm tra" grades every card against
 * correctMappings (cardId → categoryId). Answer = Record<cardId, categoryId>.
 */
import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import { PlayerInlineFeedback, PlayerShell, ContentImage, groupedMappingReveal, useGrading, useHydratedRecordAnswer, useInstantGrading, type PlayerProps } from "./shared";
import { DraggableChip } from "./DraggableChip";
import { useSkin } from "@/core/exercise/skin";
import { RichTextValue } from "@/core/rich-text/RichTextValue";
import { joinReveal, revealName } from "./answer-name";

export interface CardSortPlayerProps extends PlayerProps {
  categories: { id: string; label: string; imageUrl?: string; imageWidth?: string }[];
  cards: { id: string; text?: string; imageUrl?: string }[];
  /** cardId → categoryId */
  correctMappings: Record<string, string>;
}

const PILE_ACCENTS = [
  "border-fuchsia-300  bg-fuchsia-50 ",
  "border-amber-300  bg-amber-50 ",
  "border-emerald-300  bg-emerald-50 ",
  "border-sky-300  bg-sky-50 ",
  "border-violet-300  bg-violet-50 ",
  "border-orange-300  bg-orange-50 ",
];

export const CardSortPlayer: React.FC<CardSortPlayerProps> = ({
  categories,
  cards,
  correctMappings,
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
  const skin = useSkin();
  // cardId → categoryId (absent = still in tray). Hydrated in place from the
  // parent-supplied `answer` (the exact Record shape this player reports).
  const [placement, setPlacement] = useHydratedRecordAnswer(answer);
  const [selectedCard, setSelectedCard] = useState<string | null>(null);
  const [dragCard, setDragCard] = useState<string | null>(null);
  const { status, setStatus, report, mode } = useGrading({ onAnswerChange, onComplete, onStatusChange });
  const recordOnly = selfAssessment === true || Object.keys(correctMappings ?? {}).length === 0;
  const elementIds = useMemo(() => cards.map((c) => c.id), [cards]);
  // buildAnswer must see the placement of the CURRENT interaction, not the
  // render closure — place() updates the ref before grading.
  const placementRef = useRef(placement);
  placementRef.current = placement;
  const instant = useInstantGrading({
    elementIds,
    instantFeedback,
    recordOnly,
    buildAnswer: () => placementRef.current,
    report,
    onElementGraded,
    onProgress,
  });
  const locked = submitted || (!instant.active && status === "success");
  const answerReveal = recordOnly
    ? null
    : // web-own: gộp theo nhóm (groupedMappingReveal). Thẻ chỉ có ảnh thì helper
      // trả null và bảng lùi về khuôn mũi tên bên dưới (gộp URL không đọc nổi).
      groupedMappingReveal({ groups: categories, items: cards, correctMappings }) ??
      joinReveal(
        Object.entries(correctMappings).map(([cardId, categoryId]) => {
          const ii = cards.findIndex((x) => x.id === cardId);
          const gi = categories.findIndex((g) => g.id === categoryId);
          return [revealName(cards[ii], ii, "Thẻ"), " → ", revealName(categories[gi], gi, "Nhóm")];
        }),
      );

  const place = (cardId: string, categoryId: string | null) => {
    if (locked) return;
    const next = { ...placement };
    if (categoryId) next[cardId] = categoryId;
    else delete next[cardId];
    setPlacement(next);
    setSelectedCard(null);
    onAnswerChange?.(next);
    placementRef.current = next;
    // Rearranging after a wrong self-check clears the error so retry is clean.
    if (status === "error") {
      setStatus("idle");
      onStatusChange?.("idle");
    }
    if (!categoryId) {
      instant.clear(cardId);
    } else {
      instant.grade(cardId, next[cardId] === correctMappings[cardId] ? "correct" : "incorrect");
    }
  };

  const clickCard = (id: string) => {
    if (locked) return;
    setSelectedCard((cur) => (cur === id ? null : id));
  };

  const dropInPile = (categoryId: string) => {
    if (locked) return;
    const id = dragCard ?? selectedCard;
    if (!id) return;
    place(id, categoryId);
    setDragCard(null);
  };

  const returnToTray = (cardId: string) => place(cardId, null);

  const grade = () => {
    if (locked) return;
    // No answer key (or self-assessment): record only, never fake a verdict.
    if (recordOnly) {
      report(placement, "incomplete");
      return;
    }
    const allPlaced = cards.every((c) => placement[c.id]);
    if (!allPlaced) {
      report(placement, "incomplete");
      return;
    }
    const correct = cards.every((c) => placement[c.id] === correctMappings[c.id]);
    report(placement, correct ? "correct" : "incorrect");
  };

  useEffect(() => {
    if (submitted && status === "idle") grade();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submitted]);

  const trayCards = cards.filter((c) => !placement[c.id]);

  const card = (
    c: { id: string; text?: string; imageUrl?: string; imageWidth?: string },
    opts?: { inPile?: boolean },
  ) => {
    const selected = selectedCard === c.id;
    const rv = instant.reveal(c.id);
    const ok = rv
      ? rv === "correct"
      : submitted && !!opts?.inPile && placement[c.id] === correctMappings[c.id];
    const wrong = rv
      ? rv === "incorrect"
      : submitted && !!opts?.inPile && placement[c.id] !== correctMappings[c.id];
    const cardState = wrong
      ? "wrong"
      : ok
        ? "correct"
        : selected
          ? "selected"
          : opts?.inPile
            ? "placed"
            : "idle";
    return (
      // Drag source = shared module-scope `DraggableChip` — see its docblock:
      // every Framer transform stays off the draggable node so Chrome does not
      // cancel the drag (#533/#563/#569). `onClick` keeps click-to-select.
      <DraggableChip
        key={c.id}
        dragging={dragCard === c.id}
        locked={locked}
        onDragStart={() => setDragCard(c.id)}
        onDragEnd={() => setDragCard(null)}
        onClick={() => (opts?.inPile ? returnToTray(c.id) : clickCard(c.id))}
        className={
          skin.chip?.(cardState, "secondary")
            ? `min-w-[84px] flex items-center justify-center text-center ${skin.chip(cardState, "secondary")}`
            : `min-w-[84px] px-4 py-3 rounded-2xl border-4 font-bold text-sm sm:text-base shadow-md transition-all flex items-center justify-center text-center
          ${
            wrong
              ? "bg-red-50  border-red-400 text-red-600"
              : ok
                ? "bg-green-50  border-green-400 text-green-700 "
                : selected
                  ? "bg-yellow-100  border-yellow-400 text-yellow-800  scale-105 -rotate-2"
                  : "bg-white border-slate-200 text-slate-800 hover:border-indigo-400 hover:bg-indigo-50 "
          }`
        }
      >
        {c.imageUrl ? (
          <ContentImage src={c.imageUrl} alt={c.text || "thẻ"} width={c.imageWidth} draggable={false} />
        ) : (
          c.text
        )}
      </DraggableChip>
    );
  };

  return (
    <PlayerShell {...shell} submitted={submitted} answerReveal={answerReveal}>
      {/* Deck / tray */}
      <div
        onDragOver={(e) => {
          if (!locked) e.preventDefault();
        }}
        onDrop={() => dragCard && returnToTray(dragCard)}
        className={`p-3 sm:p-4 mb-5 min-h-[88px] ${skin.panel?.("tray") ?? "bg-white/60 rounded-3xl border-4 border-white"}`}
      >
        <h3 className={`text-sm mb-2 uppercase tracking-wide ${skin.emphasis?.("neutral", "strong") ?? "font-black text-slate-500"}`}>
          Bộ bài
        </h3>
        <div className="flex flex-wrap gap-2 sm:gap-3">
          {trayCards.length === 0 ? (
            <span className={`italic px-2 py-1 ${skin.emphasis?.("neutral", "soft") ?? "text-slate-500 font-bold"}`}>
              Đã chia hết bài
            </span>
          ) : (
            trayCards.map((c) => card(c))
          )}
        </div>
      </div>

      {/* Category piles */}
      <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {categories.map((cat, ci) => {
          const inHere = cards.filter((c) => placement[c.id] === cat.id);
          return (
            <div
              key={cat.id}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => dropInPile(cat.id)}
              onClick={() => selectedCard && dropInPile(cat.id)}
              className={
                skin.dropZone?.(
                  selectedCard || dragCard
                    ? "active"
                    : inHere.length > 0
                      ? "filled"
                      : "idle",
                )
                  ? `${skin.dropZone(
                      selectedCard || dragCard
                        ? "active"
                        : inHere.length > 0
                          ? "filled"
                          : "idle",
                    )} min-h-[130px] ${selectedCard || dragCard ? "cursor-pointer" : ""}`
                  : `rounded-3xl border-4 border-dashed p-3 sm:p-4 min-h-[130px] transition-all
                ${PILE_ACCENTS[ci % PILE_ACCENTS.length]}
                ${selectedCard || dragCard ? "ring-2 ring-indigo-300 cursor-pointer" : ""}`
              }
            >
              <h3 className={`mb-2 text-base sm:text-lg ${skin.emphasis?.("neutral", "strong") ?? "font-black text-slate-800"}`}>
                {cat.imageUrl ? (
                  <ContentImage src={cat.imageUrl} alt={cat.label} width={cat.imageWidth} draggable={false} />
                ) : (
                  <RichTextValue value={cat.label} />
                )}
              </h3>
              <div className="flex flex-wrap gap-2">
                {inHere.map((c) => card(c, { inPile: true }))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Parent-graded flows own the verdict — never show the self-check button. */}
      {mode !== "parent" && !instant.active && !locked && !recordOnly && (
        <div className="flex justify-center mt-6">
          <motion.button
            type="button"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.94 }}
            onClick={grade}
            className={
              skin.actionButton?.(true, "primary") ??
              "px-8 py-3 rounded-full border-4 border-indigo-500 bg-indigo-400 text-white font-black text-lg shadow-md hover:bg-indigo-500 transition-colors"
            }
          >
            Kiểm tra
          </motion.button>
        </div>
      )}

      {status === "success" && (
        <PlayerInlineFeedback kind="success" fallbackClass="mt-4 text-center text-green-600 font-black text-lg md:text-xl">
          Chia bài chuẩn không cần chỉnh! 🃏
        </PlayerInlineFeedback>
      )}
      {status === "error" && !submitted && (
        <PlayerInlineFeedback kind="error" fallbackClass="mt-4 text-center text-red-500 font-black text-lg md:text-xl">
          Có thẻ chưa đúng nhóm, thử lại nhé! 🤔
        </PlayerInlineFeedback>
      )}
    </PlayerShell>
  );
};
