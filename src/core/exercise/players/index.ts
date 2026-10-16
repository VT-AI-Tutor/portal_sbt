/**
 * Barrel for the 39 question players.
 *
 * Players are grouped by renderer family. Each is a standalone component that
 * follows the shared contract in ./shared.tsx and is selected by
 * (schema `type` + `display.interactionType`, with legacy matching `layout`
 * fallback) — see ./manifest.ts.
 */

// Kit
export * from "./shared";

// Selection (choice-grid)
export { SingleChoicePlayer } from "./SingleChoicePlayer";
export { MultiChoicePlayer } from "./MultiChoicePlayer";
export { TrueFalsePlayer } from "./TrueFalsePlayer";
export { YesNoPlayer } from "./YesNoPlayer";
export { ImageChoiceSinglePlayer } from "./ImageChoiceSinglePlayer";
export { ImageChoiceMultiPlayer } from "./ImageChoiceMultiPlayer";
export { TileSelectPlayer } from "./TileSelectPlayer";
export { DropdownSelectPlayer } from "./DropdownSelectPlayer";

// Hotspot (image-hotspot)
export { HotspotSinglePlayer } from "./HotspotSinglePlayer";
export { HotspotMultiPlayer } from "./HotspotMultiPlayer";
export { PlacePinPlayer } from "./PlacePinPlayer";
export { ImageColorClassifyPlayer } from "./ImageColorClassifyPlayer";

// Text entry (text-input)
export { FillBlankPlayer } from "./FillBlankPlayer";
export { ClozePlayer } from "./ClozePlayer";
export { NumericEntryPlayer } from "./NumericEntryPlayer";
export { ShortAnswerPlayer } from "./ShortAnswerPlayer";
export { EssayPlayer } from "./EssayPlayer";
export { FormulaEntryPlayer } from "./FormulaEntryPlayer";
export { MathClozePlayer } from "./MathClozePlayer";

// Ordering (sortable-list)
export { ReorderListPlayer } from "./ReorderListPlayer";
export { RankPlayer } from "./RankPlayer";
export { ProcessSequencePlayer } from "./ProcessSequencePlayer";
export { TimelinePlayer } from "./TimelinePlayer";

// Matching (match)
export { TwoColumnMatchPlayer } from "./TwoColumnMatchPlayer";
export { ConnectLinesPlayer } from "./ConnectLinesPlayer";
export { MatchRowsPlayer } from "./MatchRowsPlayer";
export { MatchRadialPlayer } from "./MatchRadialPlayer";
export { ChainMatchPlayer } from "./ChainMatchPlayer";
export { MatchScenePlayer } from "./MatchScenePlayer";
export { CategorizePlayer } from "./CategorizePlayer";
export { WordBankPlayer } from "./WordBankPlayer";

// Drag-and-drop (dnd-canvas)
export { DragToZonesPlayer } from "./DragToZonesPlayer";
export { LabelDiagramPlayer } from "./LabelDiagramPlayer";
export { TwoBucketSortPlayer } from "./TwoBucketSortPlayer";
export { DragToGridPlayer } from "./DragToGridPlayer";

// Scale / rating (scale)
export { LikertPlayer } from "./LikertPlayer";
export { NumericSliderPlayer } from "./NumericSliderPlayer";
export { StarRatingPlayer } from "./StarRatingPlayer";
export { ConfidenceSliderPlayer } from "./ConfidenceSliderPlayer";
export { SemanticDifferentialPlayer } from "./SemanticDifferentialPlayer";

// Region / mark (highlight)
export { HighlightTextPlayer } from "./HighlightTextPlayer";
export { SelectWordsPlayer } from "./SelectWordsPlayer";
export { FreeDrawPlayer } from "./FreeDrawPlayer";

// Media-anchored (media-wrapper)
export { VideoAnchoredPlayer } from "./VideoAnchoredPlayer";
export { AudioAnchoredPlayer } from "./AudioAnchoredPlayer";

// Skill (skill)
export { SpeakingPlayer } from "./SpeakingPlayer";
export { DictationPlayer } from "./DictationPlayer";
export { ColoringPlayer } from "./ColoringPlayer";
export { MindMapPlayer } from "./MindMapPlayer";

// Table (table)
export { CheckboxTablePlayer } from "./CheckboxTablePlayer";
export { TableFillPlayer } from "./TableFillPlayer";
export { TrueFalseTablePlayer } from "./TrueFalseTablePlayer";

// Diagram (diagram)
export { DiagramFillPlayer } from "./DiagramFillPlayer";
export { PathConnectPlayer } from "./PathConnectPlayer";

// Game (game)
export { MemoryMatchPlayer } from "./MemoryMatchPlayer";
export { PikachuPlayer } from "./PikachuPlayer";
export { CardSortPlayer } from "./CardSortPlayer";
export { JigsawPlayer } from "./JigsawPlayer";
export { WordSearchPlayer } from "./WordSearchPlayer";
export { CrosswordPlayer } from "./CrosswordPlayer";
export { HangmanPlayer } from "./HangmanPlayer";
export { SpotDifferencePlayer } from "./SpotDifferencePlayer";

// Wrapper (wrapper)
export { QuestionGroupPlayer } from "./QuestionGroupPlayer";
export { TimedQuizPlayer } from "./TimedQuizPlayer";
export { LivesStreakPlayer } from "./LivesStreakPlayer";
export { BoardGamePlayer } from "./BoardGamePlayer";
export { PathTrailPlayer } from "./PathTrailPlayer";
