/**
 * Mục điều hướng nào đang "sáng" với đường dẫn hiện tại.
 *
 * So BẰNG ĐÚNG (`pathname === item.to`) thì mọi trang chi tiết rơi khỏi mục cha
 * — vào /admin/question-bank/<id>, /admin/competency/sets/<id>,
 * /admin/taxonomy/<id> là menu tắt sạch, không mục nào sáng.
 *
 * Nhưng `startsWith` thuần cũng sai: mục chỉ mục như "/teacher", "/student",
 * "/manager" là tiền tố của MỌI mục còn lại nên sẽ sáng ở mọi trang. Vì vậy lấy
 * tiền tố DÀI NHẤT khớp — /teacher/classes/12 về "Lớp học", /teacher về
 * "Dashboard lớp".
 *
 * Ranh giới khớp là dấu "/" nên "/admin/school" KHÔNG nuốt "/admin/school-abc".
 *
 * @returns `to` của mục thắng (đúng chuỗi caller truyền vào, để so sánh thẳng
 * với `item.to`), hoặc `null` nếu không mục nào phủ đường dẫn.
 */
export function activeNavTo(pathname: string, items: readonly { to: string }[]): string | null {
  const path = trimSlash(pathname);
  let best: string | null = null;
  let bestLen = -1;

  for (const { to } of items) {
    const target = trimSlash(to);
    // Mục gốc "/" phủ mọi đường dẫn (và thua mọi mục dài hơn nhờ so bestLen).
    const prefix = target === '/' ? '/' : `${target}/`;
    const matches = path === target || path.startsWith(prefix);
    if (!matches) continue;
    if (target.length > bestLen) {
      best = to;
      bestLen = target.length;
    }
  }

  return best;
}

/** Bỏ "/" cuối để "/admin/users" và "/admin/users/" là một. */
function trimSlash(value: string): string {
  return value.length > 1 && value.endsWith('/') ? value.slice(0, -1) : value;
}
