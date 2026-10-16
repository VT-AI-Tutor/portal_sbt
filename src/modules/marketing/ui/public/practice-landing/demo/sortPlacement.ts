/** Vị trí đã đặt của từng item trong câu kéo thả; null = chưa đặt. */
export type Placement = ReadonlyArray<0 | 1 | null>;

export function createPlacement(count: number): Placement {
  return Array.from({ length: count }, () => null);
}

export function placeItem(
  p: Placement,
  itemIndex: number,
  group: 0 | 1,
): Placement {
  if (p[itemIndex] !== null) return p; // đã đặt — không cho làm lại
  return p.map((g, i) => (i === itemIndex ? group : g));
}

export function isComplete(p: Placement): boolean {
  return p.every((g) => g !== null);
}

export function toGradeArray(p: Placement): (0 | 1)[] {
  return p.map((g) => (g === 1 ? 1 : 0));
}
