/**
 * Small formatting helpers shared by the Arena screens (dates in dd/MM/yyyy
 * VN, mm:ss durations). Kept separate from journeyLogic.ts (state mapping).
 */

export function formatArenaDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

export function formatArenaDateRange(startIso: string, endIso: string): string {
  return `${formatArenaDate(startIso)} - ${formatArenaDate(endIso)}`;
}

export function formatArenaDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function formatArenaDuration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const mm = Math.floor(s / 60);
  const ss = s % 60;
  return `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}
