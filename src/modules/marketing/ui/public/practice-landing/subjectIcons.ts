import {
  Atom,
  BookOpen,
  BookText,
  Calculator,
  Dna,
  Dumbbell,
  FlaskConical,
  Globe,
  GraduationCap,
  Handshake,
  Landmark,
  Languages,
  Laptop,
  Magnet,
  Map,
  Microscope,
  Music,
  Palette,
  PenLine,
  Scale,
  Shield,
  Sprout,
  Tent,
  Wrench,
  type LucideIcon,
} from "lucide-react";

/**
 * Icon lucide theo subject_code — dùng cho bìa bài tập và sidebar môn học của
 * landing luyện tập (trang tham khảo dùng icon nét, không dùng emoji).
 *
 * Cố tình KHÔNG nhét vào `@/core/reference/subjectDisplay`: file đó thuần dữ
 * liệu, không dính React, và được import từ cả những đường không phải UI —
 * thêm LucideIcon vào đó là kéo lucide-react vào core cho đúng một consumer.
 *
 * Danh sách mã phải phủ hết SUBJECT_DISPLAY trong core/reference/subjectDisplay.ts
 * (subjectIcons.test.ts đọc file đó và kiểm tra).
 */
const SUBJECT_ICON: Record<string, LucideIcon> = {
  toan: Calculator,
  "tieng-viet": BookOpen,
  "ngu-van": BookText,
  "tap-viet": PenLine,
  "tieng-anh": Languages,
  "dao-duc": Handshake,
  "giao-duc-cong-dan": Handshake,
  "giao-duc-kinh-te-va-phap-luat": Scale,
  "tu-nhien-xa-hoi": Sprout,
  "khoa-hoc": Microscope,
  "khoa-hoc-tu-nhien": Atom,
  "vat-li": Magnet,
  "hoa-hoc": FlaskConical,
  "sinh-hoc": Dna,
  "lich-su-dia-li": Map,
  "lich-su": Landmark,
  "dia-li": Globe,
  "tin-hoc": Laptop,
  "cong-nghe": Wrench,
  "am-nhac": Music,
  "mi-thuat": Palette,
  "giao-duc-the-chat": Dumbbell,
  "giao-duc-quoc-phong-va-an-ninh": Shield,
  "hoat-dong-trai-nghiem": Tent,
};

/**
 * Icon fallback cho mã lạ (vd môn mới từ LCMS). Cố tình KHÔNG trùng icon nào
 * đã map để môn chưa khai báo nhìn ra ngay, không giả dạng môn khác — cùng
 * tinh thần với emoji 📚 fallback của getSubjectDisplay().
 */
export const FALLBACK_SUBJECT_ICON: LucideIcon = GraduationCap;

export function getSubjectIcon(code: string): LucideIcon {
  return SUBJECT_ICON[code] ?? FALLBACK_SUBJECT_ICON;
}
