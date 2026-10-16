export interface SubjectDisplay {
  label: string;
  emoji: string;
  color: string; // semantic tone: primary | destructive | warning | success | info | fun
  themeColor: string;
  keywordColor: string;
}

const D = (
  label: string,
  emoji: string,
  color: string,
  theme: string,
  keyword: string,
): SubjectDisplay => ({ label, emoji, color, themeColor: theme, keywordColor: keyword });

/** Map hiển thị duy nhất theo subject_code — label ở đây chỉ là fallback, label chính lấy từ reference API. */
const SUBJECT_DISPLAY: Record<string, SubjectDisplay> = {
  "toan": D("Toán", "➗", "primary", "text-sky-600 bg-sky-50 border-sky-100", "text-sky-500"),
  "tieng-viet": D("Tiếng Việt", "📖", "destructive", "text-rose-600 bg-rose-50 border-rose-100", "text-rose-500"),
  "ngu-van": D("Ngữ văn", "📖", "destructive", "text-rose-600 bg-rose-50 border-rose-100", "text-rose-500"),
  "tap-viet": D("Tập viết", "✍️", "warning", "text-amber-600 bg-amber-50 border-amber-100", "text-amber-500"),
  "tieng-anh": D("Tiếng Anh", "🌐", "info", "text-indigo-600 bg-indigo-50 border-indigo-100", "text-indigo-600"),
  "dao-duc": D("Đạo đức", "🤝", "success", "text-teal-600 bg-teal-50 border-teal-100", "text-teal-600"),
  "giao-duc-cong-dan": D("Giáo dục công dân", "🤝", "success", "text-teal-600 bg-teal-50 border-teal-100", "text-teal-600"),
  "giao-duc-kinh-te-va-phap-luat": D("Giáo dục kinh tế và pháp luật", "⚖️", "success", "text-teal-600 bg-teal-50 border-teal-100", "text-teal-600"),
  "tu-nhien-xa-hoi": D("Tự nhiên và Xã hội", "🌱", "success", "text-emerald-600 bg-emerald-50 border-emerald-100", "text-emerald-500"),
  "khoa-hoc": D("Khoa học", "🔬", "success", "text-emerald-600 bg-emerald-50 border-emerald-100", "text-emerald-500"),
  "khoa-hoc-tu-nhien": D("Khoa học tự nhiên", "🔬", "success", "text-emerald-600 bg-emerald-50 border-emerald-100", "text-emerald-500"),
  "vat-li": D("Vật lí", "🧲", "info", "text-cyan-600 bg-cyan-50 border-cyan-100", "text-cyan-500"),
  "hoa-hoc": D("Hoá học", "🧪", "info", "text-cyan-600 bg-cyan-50 border-cyan-100", "text-cyan-500"),
  "sinh-hoc": D("Sinh học", "🧬", "success", "text-emerald-600 bg-emerald-50 border-emerald-100", "text-emerald-500"),
  "lich-su-dia-li": D("Lịch sử và Địa lí", "🗺️", "warning", "text-amber-600 bg-amber-50 border-amber-100", "text-amber-600"),
  "lich-su": D("Lịch sử", "🏛️", "warning", "text-amber-600 bg-amber-50 border-amber-100", "text-amber-600"),
  "dia-li": D("Địa lí", "🗺️", "warning", "text-amber-600 bg-amber-50 border-amber-100", "text-amber-600"),
  "tin-hoc": D("Tin học", "💻", "info", "text-cyan-600 bg-cyan-50 border-cyan-100", "text-cyan-500"),
  "cong-nghe": D("Công nghệ", "🛠️", "warning", "text-orange-600 bg-orange-50 border-orange-100", "text-orange-600"),
  "am-nhac": D("Âm nhạc", "🎵", "fun", "text-pink-600 bg-pink-50 border-pink-100", "text-pink-500"),
  "mi-thuat": D("Mĩ thuật", "🎨", "fun", "text-purple-600 bg-purple-50 border-purple-100", "text-purple-500"),
  "giao-duc-the-chat": D("Giáo dục thể chất", "🏃", "success", "text-emerald-600 bg-emerald-50 border-emerald-100", "text-emerald-500"),
  "giao-duc-quoc-phong-va-an-ninh": D("Giáo dục quốc phòng và an ninh", "🛡️", "primary", "text-sky-600 bg-sky-50 border-sky-100", "text-sky-500"),
  "hoat-dong-trai-nghiem": D("Hoạt động trải nghiệm", "🏕️", "info", "text-sky-600 bg-sky-50 border-sky-100", "text-sky-600"),
};

const titleCase = (code: string): string =>
  code.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");

/**
 * Metadata hiển thị cho một subject_code. Code lạ (vd từ LCMS) → fallback
 * title-case + 📚, không crash UI. `label` truyền vào (từ API) luôn thắng
 * label tĩnh trong map.
 */
export function getSubjectDisplay(code: string, label?: string): SubjectDisplay {
  const found = SUBJECT_DISPLAY[code];
  if (found) {
    return label ? { ...found, label } : found;
  }
  return D(label || titleCase(code), "📚", "primary", "text-sky-600 bg-sky-50", "text-sky-500");
}
