/** Năm học VN lật vào tháng 8 — trùng luật AcademicYear::current() phía backend. */
export function currentAcademicYear(now: Date = new Date()): string {
  const y = now.getFullYear();
  return now.getMonth() >= 7 ? `${y}-${y + 1}` : `${y - 1}-${y}`;
}

export function academicYearOptions(count = 3, now: Date = new Date()): string[] {
  const [start] = currentAcademicYear(now).split("-").map(Number);
  return Array.from({ length: count }, (_, i) => `${start - i}-${start - i + 1}`);
}
