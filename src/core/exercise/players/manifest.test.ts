import { describe, expect, it } from "vitest";
import {
  CANONICAL_INTERACTION_PAIRS,
  PLAYER_MANIFEST,
  QUESTION_LAYOUT_CAPABILITIES,
  extensionCapabilities,
  getQuestionCapability,
  interactionVariantsForType,
  questionCapabilities,
  resolveDisplay,
  resolveInteractionType,
  resolvePlayer,
} from "./manifest";
import { DISPLAY_LAYOUTS } from "../display-layout";

interface ExpectedCapability {
  defaultInteraction: string;
  interactions: Record<string, string>;
}

const EXPECTED_CANONICAL_REGISTRY: Record<string, ExpectedCapability> = {
  single_choice: { defaultInteraction: "radio", interactions: { radio: "P01", button: "P07", image: "P05", dropdown: "P08", circle: "P67", color_fill: "P69" } },
  multiple_choice: { defaultInteraction: "checkbox", interactions: { checkbox: "P02", button: "P71", image: "P06", circle: "P68", color_fill: "P70" } },
  true_false: { defaultInteraction: "boolean", interactions: { boolean: "P03", yes_no: "P04" } },
  multi_true_false: { defaultInteraction: "radio", interactions: { radio: "P63" } },
  multi_true_false_table: { defaultInteraction: "table", interactions: { table: "P46" } },
  fill_blank: { defaultInteraction: "text", interactions: { text: "P12", short_text: "P15" } },
  cloze: { defaultInteraction: "inline", interactions: { inline: "P13", word_bank: "P25", picture: "P25b", select: "P77" } },
  numeric_answer: { defaultInteraction: "numeric", interactions: { numeric: "P14" } },
  essay: { defaultInteraction: "long_text", interactions: { long_text: "P16" } },
  // `scene` keeps its historical `L01` id even though it is no longer legacy-only:
  // the id is the Content Schema catalogue key, not a status flag.
  matching: { defaultInteraction: "columns", interactions: { columns: "P22", lines: "P23", rows: "P64", radial: "P65", chain: "P66", triad: "P76", scene: "L01" } },
  ordering: { defaultInteraction: "list", interactions: { list: "P18", rank: "P19", process: "P20", timeline: "P21" } },
  classification: { defaultInteraction: "buckets", interactions: { buckets: "P24", two_bucket: "P28", image_color: "P62" } },
  hotspot: { defaultInteraction: "single", interactions: { single: "P09", multiple: "P10" } },
  labeling: { defaultInteraction: "image", interactions: { image: "P27" } },
  connect_points: { defaultInteraction: "lines", interactions: { lines: "P72" } },
  mind_map_completion: { defaultInteraction: "fill", interactions: { fill: "P73" } },
  table_completion: { defaultInteraction: "fill", interactions: { fill: "P45" } },
  speaking: { defaultInteraction: "record", interactions: { record: "P40" } },
  dictation: { defaultInteraction: "transcribe", interactions: { transcribe: "P41" } },
  upload_answer: { defaultInteraction: "upload", interactions: { upload: "P74" } },
  math_expression: { defaultInteraction: "formula", interactions: { formula: "P17", text: "P75" } },
  math_cloze: { defaultInteraction: "formula", interactions: { formula: "P82" } },
  point_marking: { defaultInteraction: "pin", interactions: { pin: "P11" } },
  scale: { defaultInteraction: "likert", interactions: { likert: "P30", slider: "P31", stars: "P32", confidence: "P33", differential: "P34" } },
  highlight: { defaultInteraction: "text", interactions: { text: "P35", tokens: "P36" } },
  drawing: { defaultInteraction: "draw", interactions: { draw: "P37" } },
  geometry_grid: { defaultInteraction: "construct", interactions: { construct: "P78" } },
  chart_build: { defaultInteraction: "plot", interactions: { plot: "P79" } },
  drag_drop: { defaultInteraction: "zones", interactions: { zones: "P80", grid: "P81" } },
  media_anchored: { defaultInteraction: "video", interactions: { video: "P38", audio: "P39" } },
  coloring: { defaultInteraction: "regions", interactions: { regions: "P42" } },
  mind_map: { defaultInteraction: "build", interactions: { build: "P43" } },
  checkbox_table: { defaultInteraction: "rows", interactions: { rows: "P44" } },
  diagram_fill: { defaultInteraction: "fill", interactions: { fill: "P47" } },
  path_connect: { defaultInteraction: "path", interactions: { path: "P48" } },
  memory_match: { defaultInteraction: "flip", interactions: { flip: "P49" } },
  pikachu: { defaultInteraction: "onet", interactions: { onet: "P50" } },
  card_sort: { defaultInteraction: "sort", interactions: { sort: "P51" } },
  jigsaw: { defaultInteraction: "pieces", interactions: { pieces: "P52" } },
  word_search: { defaultInteraction: "grid", interactions: { grid: "P53" } },
  crossword: { defaultInteraction: "grid", interactions: { grid: "P54" } },
  hangman: { defaultInteraction: "guess", interactions: { guess: "P55" } },
  spot_difference: { defaultInteraction: "spots", interactions: { spots: "P56" } },
  question_group: { defaultInteraction: "group", interactions: { group: "P57" } },
  timed_quiz: { defaultInteraction: "timed", interactions: { timed: "P58" } },
  lives_streak: { defaultInteraction: "lives", interactions: { lives: "P59" } },
  board_game: { defaultInteraction: "board", interactions: { board: "P60" } },
  path_trail: { defaultInteraction: "trail", interactions: { trail: "P61" } },
};

function canonicalRegistrySnapshot(): Record<string, ExpectedCapability> {
  return Object.fromEntries(
    Object.entries(questionCapabilities).map(([type, capability]) => [
      type,
      {
        defaultInteraction: capability.defaultInteraction,
        interactions: Object.fromEntries(
          Object.entries(capability.interactions)
            .filter(([, interaction]) => !interaction.legacyOnly)
            .map(([interactionType, interaction]) => [interactionType, interaction.id]),
        ),
      },
    ]),
  );
}

describe("question capability registry", () => {
  it("matches the exact 44-type, 75-pair Content Schema contract", () => {
    expect(canonicalRegistrySnapshot()).toEqual(EXPECTED_CANONICAL_REGISTRY);

    const expectedPairs = Object.entries(EXPECTED_CANONICAL_REGISTRY).flatMap(
      ([type, capability]) => Object.keys(capability.interactions).map((interactionType) => `${type}/${interactionType}`),
    );
    const actualPairs = CANONICAL_INTERACTION_PAIRS.map(({ type, interactionType }) => `${type}/${interactionType}`);

    expect(Object.keys(questionCapabilities)).toHaveLength(48);
    expect(actualPairs).toHaveLength(82);
    expect(new Set(actualPairs)).toEqual(new Set(expectedPairs));
    expect(new Set(PLAYER_MANIFEST.map((entry) => entry.id)).size).toBe(PLAYER_MANIFEST.length);
  });

  it("keeps legacy interaction aliases outside the canonical contract", () => {
    // Alias cũ vẫn phải ở ngoài hợp đồng chuẩn — luật này không đổi.
    expect(questionCapabilities.single_choice.interactions).not.toHaveProperty("tile");
    expect(questionCapabilities.multi_true_false.interactions).not.toHaveProperty("list");
  });

  it("promotes drag_drop into the canonical contract (§5.11, ULNL II.16)", () => {
    // Trước 2026-08-06 loại này là mở rộng chỉ-đọc với mã X01/X02, và hệ quả đo
    // được là studio-be TỪ CHỐI nó lúc nhập — tác giả không tạo được câu nào.
    expect(CANONICAL_INTERACTION_PAIRS.some(({ type }) => type === "drag_drop")).toBe(true);
    expect(resolvePlayer("drag_drop", "zones")?.id).toBe("P80");
    expect(resolvePlayer("drag_drop", "grid")?.id).toBe("P81");
    expect(Object.keys(extensionCapabilities)).toHaveLength(0);
  });

  it("advertises canonical layouts for supported option, item, and group regions", () => {
    const layoutCapableTypes = Object.entries(questionCapabilities)
      .filter(([, capability]) => Object.values(capability.interactions)
        .some((interaction) => interaction.supportedLayouts.length > 0))
      .map(([type]) => type);

    expect(new Set(layoutCapableTypes)).toEqual(new Set([
      "single_choice",
      "multiple_choice",
      "true_false",
      "ordering",
      "classification",
      "question_group",
      // Layout giới hạn theo type (§10.1, GAP-251) — vùng `points`, chỉ `list` + `dots`.
      "connect_points",
    ]));
    expect(resolveDisplay("multi_true_false", {
      display: { interactionType: "radio", layout: "grid_9" },
    })).toMatchObject({ ok: false, code: "UNSUPPORTED_LAYOUT" });
  });

  it("keeps `dots` scoped to connect_points", () => {
    // Được cấp đúng một type. Nếu `dots` lọt vào ALL (tập mặc định), 47 type đều
    // chào nó trong ô chọn bố cục của editor — đúng lớp lỗi "danh mục chép tay".
    const typesOfferingDots = Object.entries(questionCapabilities)
      .filter(([, capability]) => Object.values(capability.interactions)
        .some((interaction) => interaction.supportedLayouts.includes("dots")))
      .map(([type]) => type);
    expect(typesOfferingDots).toEqual(["connect_points"]);

    // Mặc định vẫn là `list`: câu cũ không khai display.layout giữ nguyên hình.
    expect(resolveDisplay("connect_points", {})).toMatchObject({
      ok: true,
      layout: { key: "list", authored: false },
    });
    expect(resolveDisplay("connect_points", { display: { layout: "dots" } })).toMatchObject({
      ok: true,
      player: "ConnectPointsPlayer",
      interactionType: "lines",
      layout: { key: "dots", authored: true },
    });
  });

  it("resolves question_group grid_2 without changing its group interaction", () => {
    expect(resolveDisplay("question_group", {
      display: { interactionType: "group", layout: "grid_2" },
    })).toMatchObject({
      ok: true,
      interactionType: "group",
      player: "QuestionGroupPlayer",
      layout: { key: "grid_2", mode: "grid", columns: 2, flow: "row" },
    });
  });

  it("uses the schema layout map for every layout-capable interaction", () => {
    for (const [type, layouts] of Object.entries(QUESTION_LAYOUT_CAPABILITIES)) {
      const interactions = questionCapabilities[type].interactions;
      for (const [interactionType, capability] of Object.entries(interactions)) {
        if (type === "single_choice" && interactionType === "dropdown") continue;
        if (type === "classification" && interactionType === "image_color") continue;
        expect(capability.supportedLayouts.every((layout) => layouts.includes(layout))).toBe(true);
      }
    }
  });

  it("preserves interaction-specific default layouts while adding the shared schema map", () => {
    expect(resolveDisplay("single_choice", { display: { interactionType: "button" } })).toMatchObject({
      ok: true,
      layout: { key: "inline" },
    });
    expect(resolveDisplay("single_choice", { display: { interactionType: "image" } })).toMatchObject({
      ok: true,
      layout: { key: "inline" },
    });
    expect(resolveDisplay("question_group", { display: { interactionType: "group" } })).toMatchObject({
      ok: true,
      layout: { key: "list" },
    });
  });

  it.each([
    ["single_choice", "button", "inline"],
    ["multiple_choice", "image", "grid_4"],
    ["true_false", "yes_no", "inline"],
    ["ordering", "timeline", "grid_2"],
    ["classification", "buckets", "grid_4"],
    ["question_group", "group", "grid_2"],
    ["question_group", "group", "grid_4"],
    // Any canonical layout is valid on any type (Content Schema §10), incl. group/inline
    // and text-answer children — the cases that previously errored.
    ["question_group", "group", "inline"],
    ["single_choice", "dropdown", "grid_2"],
    ["classification", "image_color", "grid_2"],
    ["fill_blank", "short_text", "grid_2"],
    ["multi_true_false", "radio", "list"],
  ] as const)("accepts schema layout %s/%s/%s", (type, interactionType, layout) => {
    expect(resolveDisplay(type, { display: { interactionType, layout } })).toMatchObject({
      ok: true,
      interactionType,
    });
  });

  it.each([
    ["question_group", "group", "grid_9"],
    ["single_choice", "dropdown", "sideways"],
    ["fill_blank", "short_text", "mosaic"],
  ] as const)("rejects non-canonical layout %s/%s/%s", (type, interactionType, layout) => {
    expect(resolveDisplay(type, { display: { interactionType, layout } })).toMatchObject({
      ok: false,
      code: "UNSUPPORTED_LAYOUT",
      type,
      interactionType,
      layout,
    });
  });

  it("exhaustively accepts every canonical layout and rejects non-canonical ones", () => {
    for (const [type, capability] of Object.entries(questionCapabilities)) {
      for (const [interactionType, interaction] of Object.entries(capability.interactions)) {
        if (interaction.legacyOnly) continue;

        expect(resolveDisplay(type, { display: { interactionType } })).toMatchObject({
          ok: true,
          interactionType,
        });
        for (const layout of DISPLAY_LAYOUTS) {
          expect(resolveDisplay(type, { display: { interactionType, layout } })).toMatchObject({
            ok: true,
            interactionType,
            layout: { key: layout },
          });
        }
        expect(resolveDisplay(type, { display: { interactionType, layout: "not_a_layout" } })).toMatchObject({
          ok: false,
          code: "UNSUPPORTED_LAYOUT",
          type,
          interactionType,
        });
      }
    }
  });

  it("keeps interaction selection independent from presentation layout", () => {
    const radio = resolveDisplay("single_choice", { display: { interactionType: "radio", layout: "grid_2" } });
    expect(radio).toMatchObject({ ok: true, interactionType: "radio", player: "SingleChoicePlayer" });
    expect(radio.ok && radio.layout).toMatchObject({ mode: "grid", columns: 2, flow: "row" });

    expect(resolveDisplay("single_choice", {
      layout: "image-grid",
      display: { interactionType: "radio" },
    })).toMatchObject({ ok: true, interactionType: "radio", player: "SingleChoicePlayer", source: "explicit" });

    expect(resolveDisplay("single_choice", {
      display: { interactionType: "radio", layout: "image-grid" },
    })).toEqual({
      ok: false,
      code: "UNSUPPORTED_LAYOUT",
      type: "single_choice",
      interactionType: "radio",
      layout: "image-grid",
    });
  });

  it("flags authored layouts vs manifest fallbacks", () => {
    // Tác giả khai display.layout → authored:true; player phải tôn trọng.
    const authored = resolveDisplay("single_choice", { display: { interactionType: "image", layout: "list" } });
    expect(authored.ok && authored.layout).toMatchObject({ key: "list", authored: true });

    // Không khai → layout chỉ là fallback mặc định (authored:false), player
    // được phép dùng chrome mặc định riêng (lưới thẻ vuông count-aware).
    const fallback = resolveDisplay("single_choice", { display: { interactionType: "image" } });
    expect(fallback.ok && fallback.layout).toMatchObject({ authored: false });
  });

  it("trims inputs and returns explicit diagnostics without falling back", () => {
    expect(resolveDisplay(" unknown_type ")).toEqual({ ok: false, code: "UNKNOWN_TYPE", type: "unknown_type" });
    expect(resolveDisplay(" single_choice ", { display: { interactionType: " bogus " } })).toEqual({
      ok: false,
      code: "UNKNOWN_INTERACTION",
      type: "single_choice",
      interactionType: "bogus",
    });
    expect(resolveDisplay("single_choice", {
      display: { interactionType: 42, layout: "bogus" },
    })).toEqual({
      ok: false,
      code: "UNKNOWN_INTERACTION",
      type: "single_choice",
      interactionType: "42",
    });
    expect(resolveDisplay(" single_choice ", { display: { interactionType: " dropdown ", layout: " oops " } })).toEqual({
      ok: false,
      code: "UNSUPPORTED_LAYOUT",
      type: "single_choice",
      interactionType: "dropdown",
      layout: "oops",
    });
    expect(resolvePlayer(" single_choice ", " ")?.id).toBe("P01");
  });

  it("normalizes read-only aliases to canonical interactions", () => {
    expect(resolveDisplay("single_choice", { display: { interactionType: " tile " } })).toMatchObject({ ok: true, interactionType: "button", source: "legacy" });
    expect(resolveDisplay("multi_true_false", { display: { interactionType: " list " } })).toMatchObject({ ok: true, interactionType: "radio", source: "legacy" });
    expect(resolveDisplay("ordering", { display: { interactionType: " arrange " } })).toMatchObject({ ok: true, interactionType: "list", source: "legacy" });
  });
});

describe("matching renderer selection", () => {
  it("reads nxbgd matching interaction aliases from display.layout", () => {
    expect(resolveDisplay("matching", { layout: " columns " })).toMatchObject({
      ok: true,
      interactionType: "columns",
      player: "TwoColumnMatchPlayer",
      source: "legacy",
    });
    expect(resolveDisplay("matching", {
      display: { layout: " columns " },
    })).toMatchObject({
      ok: true,
      interactionType: "columns",
      player: "TwoColumnMatchPlayer",
      source: "legacy",
    });
    expect(resolveDisplay("matching", {
      display: { layout: " lines " },
    })).toMatchObject({
      ok: true,
      interactionType: "lines",
      player: "ConnectLinesPlayer",
      source: "legacy",
    });
  });

  it("maps trimmed legacy matching layouts to their dedicated players", () => {
    expect(resolveInteractionType(" matching ", { layout: " radial " })).toBe("radial");
    expect(resolvePlayer("matching", "radial")?.id).toBe("P65");
    expect(resolveInteractionType("matching", { layout: " row " })).toBe("rows");
    expect(resolvePlayer("matching", "rows")?.id).toBe("P64");
    expect(resolveDisplay("matching", { layout: " scene " })).toMatchObject({
      ok: true,
      interactionType: "scene",
      player: "MatchingScenePlayer",
      source: "legacy",
    });
  });

  // `scene` is the only matching interaction honouring authored x/y, so it must be
  // offered in the authoring picker (no longer legacyOnly) and must resolve to the
  // modern drag-capable player, not the legacy `MatchScenePlayer`.
  it("offers scene as an authorable interaction backed by the drag-capable player", () => {
    expect(CANONICAL_INTERACTION_PAIRS).toContainEqual({ type: "matching", interactionType: "scene" });
    expect(interactionVariantsForType("matching").map((entry) => entry.interactionType)).toContain("scene");
    expect(resolvePlayer("matching", "scene")).toMatchObject({
      id: "L01",
      component: "MatchingScenePlayer",
      legacyOnly: undefined,
    });
    expect(resolveDisplay("matching", { display: { interactionType: "scene" } })).toMatchObject({
      ok: true,
      interactionType: "scene",
      player: "MatchingScenePlayer",
      source: "explicit",
    });
  });

  it("keeps the explicit canonical interaction authoritative", () => {
    expect(resolveInteractionType("matching", {
      layout: "row",
      display: { interactionType: "radial" },
    })).toBe("radial");
    expect(resolveDisplay("matching", {
      display: { interactionType: "radial", layout: "columns" },
    })).toMatchObject({
      ok: true,
      interactionType: "radial",
      player: "MatchRadialPlayer",
      source: "explicit",
    });
  });

  it("retains the trimmed image-grid compatibility alias", () => {
    expect(resolveDisplay("single_choice", { layout: " image-grid " })).toMatchObject({
      ok: true,
      interactionType: "image",
      player: "ImageChoiceSinglePlayer",
      source: "legacy",
      layout: { mode: "grid", columns: 2 },
    });
    expect(resolveInteractionType("single_choice", { display: { layout: " image-grid " } })).toBe("image");
  });

  it("lets an authored display.layout beat the legacy image-grid default", () => {
    // Câu import đời cũ giữ `layout: "image-grid"` ở gốc payload; tác giả sửa
    // display.layout sang grid_4 trong editor → phải ra 4 cột, không bị ghim grid_2.
    expect(resolveDisplay("single_choice", {
      layout: "image-grid",
      display: { layout: "grid_4" },
    })).toMatchObject({
      ok: true,
      interactionType: "image",
      player: "ImageChoiceSinglePlayer",
      layout: { key: "grid_4", columns: 4, authored: true },
    });
  });
});

// A typeless / empty payload (the "(trống)" question the QA still opens to fix)
// arrives with `type === undefined` at runtime even though NxbgdQuestion.type is
// declared `string`. These lookups must degrade to "not found" instead of
// throwing on `.trim()` — a throw white-screens the whole question editor when
// the fixer clicks "Chỉnh sửa".
describe("typeless payload tolerance", () => {
  it("treats a nullish type as an unknown type without throwing", () => {
    for (const type of [undefined, "", "   "] as (string | undefined)[]) {
      expect(() => interactionVariantsForType(type)).not.toThrow();
      expect(interactionVariantsForType(type)).toEqual([]);
      expect(getQuestionCapability(type)).toBeUndefined();
      expect(resolvePlayer(type, "text")).toBeUndefined();
      expect(resolveInteractionType(type, {})).toBeUndefined();
      expect(resolveDisplay(type, {})).toMatchObject({ ok: false, code: "UNKNOWN_TYPE" });
    }
  });
});
