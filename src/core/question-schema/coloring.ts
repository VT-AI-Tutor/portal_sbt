/**
 * Canonical reader for `coloring` payloads (CONTENT_SCHEMA §5.26).
 *
 * One copy of the gates, two consumers: the adapter (`fromPayload`, building
 * `RenderableQuestion`) and the player dispatcher (`dispatch.tsx`, feeding
 * `ColoringPlayer` straight from the raw payload). Before this existed the two
 * paths disagreed — the adapter dropped malformed region entries and coerced
 * colors, while dispatch handed the payload to the player untouched, so a
 * `regions: [null, …]` payload crashed on `region.id` in the player while the
 * adapter reported it as clean. A resolver that only one of the two paths uses
 * is dead normalization; keep both callers on this function.
 *
 * Deliberately NOT normalized here: `correctAnswer`. `coloring` is manual-graded
 * (§5.26 — "`correctAnswer` không có"), so no answer key is promoted anywhere.
 *
 * Region geometry (mask/SVG) is out of scope while PROP-072 / GAP-191 are open:
 * unknown region keys are preserved verbatim so a future geometry contract can
 * read them without a data migration.
 */

/** A region the player can fill. Extra keys are preserved for forward compat. */
export interface ColoringRegionInput extends Record<string, unknown> {
  id: string;
  label?: string;
}

export interface ColoringConfig {
  /** Canonical `image.url`, falling back to the flat `imageUrl` (§5.26 uses the flat form). */
  imageUrl?: string;
  /** Fillable regions, malformed entries dropped. */
  regions: ColoringRegionInput[];
  /** Palette as CSS color strings; `undefined` when the payload carries none, so the player keeps its default palette. */
  colors?: string[];
}

function readImageUrl(payload: Record<string, unknown>): string | undefined {
  const image = payload.image;
  if (image && typeof image === 'object' && !Array.isArray(image)) {
    const url = (image as Record<string, unknown>).url;
    if (typeof url === 'string' && url.length > 0) return url;
  }
  return typeof payload.imageUrl === 'string' && payload.imageUrl.length > 0
    ? payload.imageUrl
    : undefined;
}

/**
 * A region is fillable only when it is an object carrying a non-empty string
 * `id` — the player keys its fill map by that id, and an id-less region would
 * be unclickable (or crash) rather than silently "empty".
 */
function readRegions(value: unknown): ColoringRegionInput[] {
  if (!Array.isArray(value)) return [];
  const regions: ColoringRegionInput[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) continue;
    const record = raw as Record<string, unknown>;
    const id = typeof record.id === 'string' ? record.id.trim() : '';
    if (id.length === 0) continue;
    regions.push({
      ...record,
      id,
      ...(typeof record.label === 'string' ? { label: record.label } : {}),
    });
  }
  return regions;
}

/** Palette entries must be CSS color strings; anything else would land in `style.backgroundColor` as `[object Object]`. */
function readColors(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const colors = value.filter((color): color is string => typeof color === 'string' && color.trim().length > 0);
  return colors.length > 0 ? colors : undefined;
}

export function resolveColoringConfig(payload: Record<string, unknown>): ColoringConfig {
  return {
    imageUrl: readImageUrl(payload),
    regions: readRegions(payload.regions),
    colors: readColors(payload.colors),
  };
}
