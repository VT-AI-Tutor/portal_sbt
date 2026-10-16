/** Vietnamese cardinal digits 0–9. */
const VIETNAMESE_DIGITS = [
  "không", "một", "hai", "ba", "bốn", "năm", "sáu", "bảy", "tám", "chín",
];

/**
 * Read an integer 1..99 as Vietnamese words (enough for book volume numbers).
 * Handles the usual tone shifts: mười/mươi, mốt (…1), lăm (…5), tư (…4).
 * Returns "" for values outside 1..99 or non-integers.
 */
export function numberToVietnameseWords(n: number): string {
  if (!Number.isInteger(n) || n < 1 || n > 99) return "";
  if (n < 10) return VIETNAMESE_DIGITS[n];
  const tens = Math.floor(n / 10);
  const units = n % 10;
  const head = tens === 1 ? "mười" : `${VIETNAMESE_DIGITS[tens]} mươi`;
  if (units === 0) return head;
  const unit =
    units === 1 && tens > 1 ? "mốt"
    : units === 4 && tens > 1 ? "tư"
    : units === 5 ? "lăm"
    : VIETNAMESE_DIGITS[units];
  return `${head} ${unit}`;
}
