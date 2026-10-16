/**
 * Demo gallery for all interaction players (route /dev/players).
 *
 * Iterates PLAYER_MANIFEST and renders one realistic Vietnamese sample per
 * entry through the dispatch layer (`renderInteractionPlayer`). A global toggle
 * switches between self-grading ("self") and parent-grading ("parent") mode;
 * in parent mode the verdict is computed via `verdictFor` from the shared
 * grading module. Each card captures its answer; in parent mode a footer
 * "Kiểm tra" button toggles checked state and shows the verdict badge.
 *
 * SAMPLE PAYLOADS use the SINGLE `correctAnswer` answer-key convention only —
 * no legacy correctCells/correctPairs/correctMappings/correctValues/etc.
 */
import React from "react";
import { PLAYER_MANIFEST, type PlayerEntry } from "./manifest";
import { renderInteractionPlayer } from "./dispatch";
import { verdictFor } from "@/core/exercise/grading";
import { SkinProvider, type SkinName } from "@/core/exercise/skin";
import { getApiProvider } from "@/core/api/config";
import { lcmsUploadAttemptFile } from "@/core/api/lcmsAdapter";

// web-own (harness): dưới provider lcms, card upload_answer nối THẬT vào
// POST /attempt/upload-file (cần đăng nhập — chưa đăng nhập thì upload báo
// lỗi ngay trong card). Provider khác giữ chế độ local metadata.
const DEMO_UPLOAD_HANDLERS =
  getApiProvider() === "lcms"
    ? { onUploadFile: (file: File) => lcmsUploadAttemptFile(file) }
    : {};

/** Contains a render error in one card so the rest of the demo still renders. */
class CardBoundary extends React.Component<
  { id: string; children: React.ReactNode },
  { error: string | null }
> {
  state = { error: null as string | null };
  static getDerivedStateFromError(err: unknown) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
  render() {
    if (this.state.error) {
      return (
        <div className="rounded-xl border-2 border-red-300 bg-red-50 p-3 text-sm text-red-700">
          <b>{this.props.id}</b> — lỗi render: {this.state.error}
        </div>
      );
    }
    return this.props.children;
  }
}

/** Build a single-paragraph RichContent from a plain string. */
function rich(text: string) {
  return { blocks: [{ type: "paragraph", text }] };
}

/** Build a multi-line RichContent (title line + body lines). */
function richLines(...lines: string[]) {
  return { blocks: lines.map((text) => ({ type: "paragraph", text })) };
}

function img(seed: string) {
  return `https://picsum.photos/seed/${seed}/600/360`;
}

/**
 * Ảnh "bản scan" giả lập, dựng bằng SVG data-URI — KHÔNG phụ thuộc mạng và cỡ
 * pixel là con số CỐ ĐỊNH, nên ảnh chụp màn hình QA so được giữa các lần.
 *
 * Cỡ mặc định 660×340 lấy đúng trung vị đo được trên kho ảnh thật (31/7:
 * p50 = 659×336; p75 = 1290×525; p90 = 1365×822). Dùng cho nhóm thẻ "Cỡ ảnh"
 * bên dưới — nơi kiểm tra câu có NHIỀU ảnh, ca vốn làm tràn màn hình.
 */
function scan(label: string, w = 660, h = 340) {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">` +
    `<rect width="${w}" height="${h}" fill="#fff"/>` +
    `<rect x="6" y="6" width="${w - 12}" height="${h - 12}" fill="none" stroke="#334155" stroke-width="4"/>` +
    `<text x="${w / 2}" y="${h / 2}" font-family="sans-serif" font-size="${Math.round(Math.min(w, h) / 5)}"` +
    ` font-weight="700" fill="#0f172a" text-anchor="middle" dominant-baseline="middle">${label}</text>` +
    `<text x="${w / 2}" y="${h - 24}" font-family="sans-serif" font-size="22" fill="#64748b"` +
    ` text-anchor="middle">${w}×${h}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

const imgBlock = (label: string, w?: number, h?: number) => ({
  type: "image",
  url: scan(label, w, h),
  alt: `Hình ${label}`,
});

const VIDEO = "https://www.w3schools.com/html/mov_bbb.mp4";
const AUDIO = "https://www.w3schools.com/html/horse.mp3";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Payload = Record<string, any>;

/** Per-manifest-id realistic Vietnamese sample payloads (answer key = correctAnswer only). */
/**
 * Payload mẫu theo mã player.
 *
 * Export để trang nghiệm thu (`AcceptancePage`) dùng CHUNG — hai trang mà mỗi
 * trang một bộ mẫu thì sớm muộn cũng trôi lệch, và lúc đó bản nghiệm thu không
 * còn phản ánh thứ dev nhìn thấy.
 */
export const SAMPLES: Record<string, Payload> = {
  // ── Selection · choice-grid ────────────────────────────────────────────
  P01: {
    // Demo: content with image block + options with image in content.blocks
    content: {
      blocks: [
        { type: "paragraph", text: "Quan sát hình và cho biết: con vật nào dưới đây sống dưới nước?" },
        { type: "image", url: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/1f/Oryctolagus_cuniculus_Rcdo.jpg/320px-Oryctolagus_cuniculus_Rcdo.jpg", alt: "Hình minh họa", width: "60%" },
      ],
    },
    options: [
      { id: "A", text: "Thỏ", content: { blocks: [{ type: "image", url: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/1f/Oryctolagus_cuniculus_Rcdo.jpg/80px-Oryctolagus_cuniculus_Rcdo.jpg" }] } },
      { id: "B", text: "Cá heo" },
      { id: "C", text: "Chim" },
      { id: "D", text: "Mèo" },
    ],
    correctAnswer: "B",
  },
  P02: {
    content: rich("Những số nào dưới đây là số chẵn?"),
    options: [
      { id: "A", content: rich("2") },
      { id: "B", content: rich("3") },
      { id: "C", content: rich("4") },
      { id: "D", content: rich("7") },
    ],
    correctAnswer: ["A", "C"],
  },
  P03: {
    content: rich("Mặt Trời mọc ở hướng Đông."),
    correctAnswer: true,
  },
  P04: {
    content: rich("Em đã hoàn thành bài tập về nhà chưa?"),
    correctAnswer: true,
    trueLabel: "Rồi",
    falseLabel: "Chưa",
  },
  P05: {
    content: rich("Chọn hình con vật sống dưới nước."),
    options: [
      { id: "A", imageUrl: img("ca"), text: "Con cá" },
      { id: "B", imageUrl: img("meo"), text: "Con mèo" },
      { id: "C", imageUrl: img("chim"), text: "Con chim" },
    ],
    correctAnswer: "A",
  },
  P06: {
    content: rich("Chọn tất cả hình có màu đỏ."),
    options: [
      { id: "A", imageUrl: img("tao"), text: "Quả táo" },
      { id: "B", imageUrl: img("la"), text: "Chiếc lá" },
      { id: "C", imageUrl: img("hoahong"), text: "Hoa hồng" },
    ],
    correctAnswer: ["A", "C"],
  },
  P07: {
    content: rich("Chọn chữ cái đầu tiên của bảng chữ cái tiếng Việt."),
    options: [
      { id: "A", text: "A" },
      { id: "B", text: "B" },
      { id: "C", text: "C" },
      { id: "D", text: "D" },
    ],
    correctAnswer: "A",
  },
  P08: {
    content: rich("Chọn mùa diễn ra Tết Nguyên Đán."),
    options: [
      { id: "A", text: "Mùa xuân" },
      { id: "B", text: "Mùa hè" },
      { id: "C", text: "Mùa thu" },
      { id: "D", text: "Mùa đông" },
    ],
    correctAnswer: "A",
  },

  // ── Hotspot · image-hotspot ────────────────────────────────────────────
  P09: {
    content: rich("Nhấn vào vị trí của ngọn núi trên bản đồ."),
    image: { url: img("bando"), altText: "Bản đồ" },
    hotspots: [
      { id: "A", label: "Núi", x: 0.3, y: 0.4, radius: 0.1 },
      { id: "B", label: "Hồ", x: 0.7, y: 0.6, radius: 0.1 },
    ],
    correctAnswer: "A",
  },
  P10: {
    content: rich("Nhấn vào tất cả các hành tinh trong hình."),
    image: { url: img("vutru"), altText: "Vũ trụ" },
    hotspots: [
      { id: "A", label: "Trái Đất", x: 0.25, y: 0.35, radius: 0.1 },
      { id: "B", label: "Sao Hỏa", x: 0.6, y: 0.5, radius: 0.1 },
      { id: "C", label: "Ngôi sao", x: 0.85, y: 0.2, radius: 0.08 },
    ],
    correctAnswer: ["A", "B"],
  },
  P11: {
    content: rich("Đặt ghim vào vị trí thủ đô Hà Nội trên bản đồ."),
    image: { url: img("vietnam"), altText: "Bản đồ Việt Nam" },
    correctAnswer: { x: 0.5, y: 0.4 },
    tolerance: 0.1,
  },

  // ── Text entry · text-input ────────────────────────────────────────────
  P12: {
    content: richLines("Điền từ còn thiếu vào chỗ trống:", "Thủ đô của nước ta là ___[blank_1]___."),
    correctAnswer: { blank_1: ["Hà Nội"] },
  },
  P13: {
    content: richLines(
      "Điền vào các chỗ trống:",
      "Trái Đất quay quanh {blank_1} và quay quanh {blank_2} của nó.",
    ),
    correctAnswer: { blank_1: ["Mặt Trời"], blank_2: ["trục"] },
  },
  P14: {
    content: rich("Tính chu vi hình tròn bán kính 0,66 m (lấy π ≈ 3,14)."),
    correctAnswer: 4.14,
    tolerance: 0.01,
    unit: "m",
  },
  P15: {
    content: rich("Con vật nào kêu \"meo meo\"?"),
    correctAnswer: ["mèo", "con mèo"],
    keywords: ["mèo"],
    minChars: 2,
  },
  P16: {
    // Nhiều đoạn đề: TẤT CẢ phải render như header (to đậm) + đúng 1 thanh màu
    // sau đoạn cuối (Owner 30/7 — contentAsHeading, bỏ heuristic block đầu).
    content: richLines(
      "Quan sát các bức tranh và trả lời câu hỏi:",
      "Mỗi bức tranh vẽ một người lao động đang làm việc.",
      "Em hãy trả lời lần lượt từng câu hỏi bên dưới.",
    ),
    prompts: [
      "a. Những người lao động trong tranh làm nghề gì? Công việc của họ có đóng góp gì cho xã hội?",
      "b. Em ấn tượng nhất với người lao động nào trong tranh? Vì sao?",
      "c. Nếu thiếu một nghề trong tranh, cuộc sống sẽ thay đổi như thế nào?",
      "d. Viết thêm tên một số nghề nghiệp trong xã hội mà em biết.",
    ],
    rubric: [
      { criterion: "Nội dung", maxScore: 5 },
      { criterion: "Diễn đạt", maxScore: 5 },
    ],
  },
  P17: {
    content: rich("Rút gọn biểu thức: x + 1 cộng 0."),
    correctAnswer: ["x+1", "1+x"],
    gradingMode: "symbolic",
  },

  // ── Ordering · sortable-list ───────────────────────────────────────────
  P18: {
    content: rich("Sắp xếp các từ thành câu có nghĩa."),
    items: [
      { id: "1", content: rich("Em") },
      { id: "2", content: rich("đi") },
      { id: "3", content: rich("học") },
    ],
    correctAnswer: ["1", "2", "3"],
  },
  P19: {
    content: rich("Xếp các hành tinh theo thứ tự từ gần Mặt Trời nhất."),
    items: [
      { id: "1", content: rich("Sao Thủy") },
      { id: "2", content: rich("Sao Kim") },
      { id: "3", content: rich("Trái Đất") },
    ],
    correctAnswer: ["1", "2", "3"],
    topLabel: "Gần nhất",
    bottomLabel: "Xa nhất",
  },
  P20: {
    content: rich("Sắp xếp các bước trồng cây theo đúng trình tự."),
    items: [
      { id: "1", content: rich("Đào hố") },
      { id: "2", content: rich("Đặt cây xuống") },
      { id: "3", content: rich("Tưới nước") },
    ],
    correctAnswer: ["1", "2", "3"],
  },
  P21: {
    content: rich("Đặt các sự kiện lịch sử vào đúng mốc thời gian."),
    items: [
      { id: "i1", content: rich("Khởi nghĩa Hai Bà Trưng") },
      { id: "i2", content: rich("Chiến thắng Bạch Đằng") },
      { id: "i3", content: rich("Cách mạng Tháng Tám") },
    ],
    slots: [
      { id: "s1", label: "Năm 40" },
      { id: "s2", label: "Năm 938" },
      { id: "s3", label: "Năm 1945" },
    ],
    correctAnswer: ["i1", "i2", "i3"],
  },

  // ── Matching · match ───────────────────────────────────────────────────
  P22: {
    content: rich("Nối quốc gia với thủ đô tương ứng."),
    leftItems: [
      { id: "L1", content: rich("Việt Nam") },
      { id: "L2", content: rich("Nhật Bản") },
    ],
    rightItems: [
      { id: "R1", content: rich("Hà Nội") },
      { id: "R2", content: rich("Tokyo") },
    ],
    correctAnswer: { L1: "R1", L2: "R2" },
  },
  P23: {
    content: rich("Vẽ đường nối con vật với thức ăn của chúng."),
    leftItems: [
      { id: "L1", content: rich("Con thỏ") },
      { id: "L2", content: rich("Con mèo") },
    ],
    rightItems: [
      { id: "R1", content: rich("Củ cà rốt") },
      { id: "R2", content: rich("Con cá") },
    ],
    correctAnswer: { L1: "R1", L2: "R2" },
  },
  P24: {
    content: rich("Phân loại các con vật vào đúng nhóm."),
    categories: [
      { id: "c1", content: rich("Thú hoang dã") },
      { id: "c2", content: rich("Vật nuôi") },
    ],
    items: [
      { id: "i1", content: rich("Con hổ") },
      { id: "i2", content: rich("Con chó") },
      { id: "i3", content: rich("Sư tử") },
    ],
    correctAnswer: { i1: "c1", i2: "c2", i3: "c1" },
  },
  P25: {
    content: rich("Chọn từ trong ngân hàng từ điền vào chỗ trống."),
    segments: [
      { text: "Mặt Trời mọc ở hướng " },
      { blankId: "blank_1" },
      { text: " và lặn ở hướng " },
      { blankId: "blank_2" },
      { text: "." },
    ],
    wordBank: [
      { id: "w1", text: "Đông" },
      { id: "w2", text: "Tây" },
    ],
    correctAnswer: { blank_1: "w1", blank_2: "w2" },
  },

  // ── Drag-and-drop · dnd-canvas ─────────────────────────────────────────
  P26: {
    content: rich("Kéo mỗi từ vào đúng loại từ của nó."),
    draggables: [
      { id: "d1", content: rich("chạy") },
      { id: "d2", content: rich("đẹp") },
    ],
    dropZones: [
      { id: "z1", label: "Động từ" },
      { id: "z2", label: "Tính từ" },
    ],
    correctAnswer: { d1: "z1", d2: "z2" },
  },
  P27: {
    content: rich("Kéo các nhãn vào đúng bộ phận của cây."),
    image: { url: img("caycoi"), altText: "Cây" },
    labels: [
      { id: "lbl1", text: "Lá" },
      { id: "lbl2", text: "Rễ" },
    ],
    targets: [
      { id: "t1", x: 0.5, y: 0.2 },
      { id: "t2", x: 0.5, y: 0.85 },
    ],
    correctAnswer: { lbl1: "t1", lbl2: "t2" },
  },
  P28: {
    content: rich("Sắp xếp các số vào nhóm số chẵn hoặc số lẻ."),
    // `color` là màu nhóm tác giả khai (spec §5.12) — hai mã dưới đây lấy đúng
    // từ HĐTN 1 bài 5. Đây là cổng nghiệm thu tay cho năng lực đó: P28 phải ra
    // HAI màu khác nhau, còn P24 (không khai màu) phải giữ nguyên đường skin cũ.
    buckets: [
      { id: "b1", label: "Số chẵn", color: "#3AAA35" },
      { id: "b2", label: "Số lẻ", color: "#ED1C24" },
    ],
    items: [
      { id: "i1", content: rich("2") },
      { id: "i2", content: rich("3") },
      { id: "i3", content: rich("4") },
    ],
    correctAnswer: { i1: "b1", i2: "b2", i3: "b1" },
  },
  P29: {
    content: rich("Kéo các chữ số vào đúng ô trong lưới."),
    grid: { rows: 2, cols: 2 },
    tokens: [
      { id: "t1", content: rich("1") },
      { id: "t2", content: rich("2") },
      { id: "t3", content: rich("3") },
      { id: "t4", content: rich("4") },
    ],
    correctAnswer: { "0-0": "t1", "0-1": "t2", "1-0": "t3", "1-1": "t4" },
  },

  // ── Scale / rating · scale ─────────────────────────────────────────────
  P30: {
    content: rich("Em cảm thấy bài học hôm nay thế nào?"),
    points: [
      { value: 1, label: "Rất khó" },
      { value: 2, label: "Khó" },
      { value: 3, label: "Bình thường" },
      { value: 4, label: "Dễ" },
      { value: 5, label: "Rất dễ" },
    ],
    correctAnswer: 3,
  },
  P31: {
    content: rich("Theo em, nhiệt độ sôi của nước là bao nhiêu độ C?"),
    min: 0,
    max: 200,
    step: 5,
    minLabel: "0°C",
    maxLabel: "200°C",
    correctAnswer: 100,
    tolerance: 5,
  },
  P32: {
    content: rich("Em đánh giá câu chuyện này mấy sao?"),
    max: 5,
    icon: "star",
    correctAnswer: 4,
  },
  P33: {
    content: rich("Em tự tin bao nhiêu phần trăm với câu trả lời của mình?"),
    // Self-report — no correctAnswer.
  },
  P34: {
    content: rich("Đánh giá nhân vật chính trong truyện."),
    pairs: [
      { id: "p1", leftLabel: "Hiền lành", rightLabel: "Hung dữ", points: 5 },
      { id: "p2", leftLabel: "Chăm chỉ", rightLabel: "Lười biếng", points: 5 },
    ],
    correctAnswer: { p1: 5, p2: 5 },
  },

  // ── Region / mark · highlight ──────────────────────────────────────────
  P35: {
    content: rich("Tô sáng các danh từ trong câu sau."),
    segments: [
      { id: "A", text: "Con mèo ", selectable: true },
      { id: "B", text: "nhanh nhẹn ", selectable: true },
      { id: "C", text: "bắt ", selectable: true },
      { id: "D", text: "chuột.", selectable: true },
      // SBT-71: dòng nguồn riêng một dòng, sát lề phải.
      {
        id: "src",
        text: "(Sưu tầm)",
        selectable: false,
        align: "right",
        runs: [
          { text: "(", annotations: {} },
          { text: "Sưu tầm", annotations: { italic: true } },
          { text: ")", annotations: {} },
        ],
      },
    ],
    correctAnswer: ["A", "D"],
  },
  P36: {
    content: rich("Chọn các từ chỉ màu sắc trong đoạn văn."),
    passage: "Bầu trời xanh trong nắng vàng rực rỡ trên cánh đồng lúa chín.",
    correctAnswer: [2, 4],
  },
  P37: {
    content: rich("Vẽ thêm ông Mặt Trời vào bức tranh."),
    backgroundImage: img("tranh"),
    colors: ["#ef4444", "#f59e0b", "#3b82f6", "#22c55e"],
    prompt: "Dùng bút màu để vẽ.",
  },

  /**
   * P78 — bài hình học trên lưới (II.38). Lấy nguyên câu Toán 4 bài 30 tiết 1:
   * "Vẽ đường thẳng MN đi qua điểm O và song song với đường thẳng CD cho trước."
   *
   * Hình cho trước khai bằng TOẠ ĐỘ LƯỚI, không phải ảnh scan — hệ phải biết O
   * và CD nằm ở ô nào mới chấm được. Điều kiện nằm trong `correctAnswer` vì với
   * loại câu này điều kiện CHÍNH LÀ đáp án.
   */
  P78: {
    content: rich("Vẽ đường thẳng MN đi qua điểm O và song song với đường thẳng CD cho trước."),
    grid: { rows: 8, cols: 11 },
    tools: ["segment", "point", "polygon", "circle"],
    given: {
      points: [
        { id: "C", x: 1, y: 5 },
        { id: "D", x: 8, y: 5 },
        { id: "O", x: 4, y: 2 },
      ],
      segments: [{ id: "CD", from: "C", to: "D" }],
    },
    correctAnswer: {
      constraints: [{ kind: "segment", through: ["O"], parallelTo: "CD" }],
    },
  },

  // ── Media-anchored · media-wrapper ─────────────────────────────────────
  P38: {
    content: rich("Xem video và trả lời câu hỏi xuất hiện."),
    videoUrl: VIDEO,
    poster: img("video"),
    pauseOnAnchor: true,
    anchors: [
      {
        id: "a1",
        time: 3,
        question: {
          type: "single_choice",
          display: { interactionType: "radio" },
          content: rich("Nhân vật trong video là con vật gì?"),
          options: [
            { id: "A", content: rich("Con thỏ") },
            { id: "B", content: rich("Con chim") },
          ],
          correctAnswer: "A",
        },
      },
    ],
  },
  P39: {
    content: rich("Nghe đoạn âm thanh và trả lời câu hỏi."),
    audioUrl: AUDIO,
    pauseOnAnchor: true,
    anchors: [
      {
        id: "a1",
        time: 2,
        question: {
          type: "true_false",
          display: { interactionType: "boolean" },
          content: rich("Đây là tiếng kêu của con ngựa."),
          correctAnswer: true,
        },
      },
    ],
  },

  // ── Skill · skill ──────────────────────────────────────────────────────
  P40: {
    content: rich("Hãy đọc to câu sau: \"Em yêu trường em.\""),
    maxDuration: 60,
    allowRetake: true,
    // Performance — manual scoring, no correctAnswer.
  },
  P41: {
    content: rich("Nghe và viết lại câu em nghe được."),
    audioUrl: AUDIO,
    correctAnswer: ["Con ngựa đang chạy"],
  },
  P42: {
    content: rich("Tô màu các vùng của lá cờ theo mẫu."),
    image: { url: img("laco"), altText: "Lá cờ" },
    regions: [
      { id: "r1", label: "Nền" },
      { id: "r2", label: "Ngôi sao" },
    ],
    colors: ["#ef4444", "#f59e0b"],
    // Subjective — manual scoring, no correctAnswer.
  },
  P43: {
    content: rich("Tự dựng sơ đồ tư duy về chủ đề \"Gia đình\"."),
    rootLabel: "Gia đình",
    seedNodes: [
      { id: "n1", label: "Ông bà" },
      { id: "n2", label: "Bố mẹ" },
    ],
    // Subjective — manual scoring, no correctAnswer.
  },

  // ── Table · table ──────────────────────────────────────────────────────
  P44: {
    content: rich("Đánh dấu các đặc điểm đúng cho mỗi con vật."),
    columns: [
      { id: "c1", label: "Biết bay" },
      { id: "c2", label: "Có lông" },
      { id: "c3", label: "Sống dưới nước" },
    ],
    rows: [
      { id: "r1", label: "Con chim" },
      { id: "r2", label: "Con cá" },
    ],
    correctAnswer: { r1: ["c1", "c2"], r2: ["c3"] },
  },
  P45: {
    content: rich("Điền thông tin còn thiếu vào bảng."),
    table: {
      // Bảng v2 (GAP-229, spec §5.16.6): columns + headerRows + rows. Ô tiêu
      // đề TRẦN ({columnId}) thừa kế nhãn cột. Đường v1 (headers[]) vẫn là
      // đường đọc hợp lệ — resolveTableModel quy cả hai về một mô hình.
      columns: [
        { id: "c1", label: "Quốc gia" },
        { id: "c2", label: "Thủ đô" },
      ],
      headerRows: [{ id: "h1", cells: [{ columnId: "c1" }, { columnId: "c2" }] }],
      rows: [
        {
          id: "r1",
          cells: [
            { columnId: "c1", cellType: "static", text: "Việt Nam" },
            { columnId: "c2", cellType: "input" },
          ],
        },
        {
          id: "r2",
          cells: [
            { columnId: "c1", cellType: "static", text: "Nhật Bản" },
            { columnId: "c2", cellType: "input" },
          ],
        },
      ],
    },
    correctAnswer: { r1__c2: "Hà Nội", r2__c2: "Tokyo" },
  },
  // Đề THẬT: Toán 4 tập một, bài 1 câu C1/C2 (b1_q5) — chính câu NXB báo lỗi
  // "ĐC màu để nút Đ, S ở dòng màu tím để hiển thị rõ". Bốn nhận định để hàng b)
  // và d) rơi vào sọc chẵn/lẻ, đúng ca cần nhìn khi đổi màu ô Đ/S.
  P46: {
    // Đề khớp với nhãn cột bên dưới ("Đúng"/"Sai"). Đừng viết "chọn Đ / chọn S"
    // ở đây khi `columns` đang khai Đúng/Sai — bảng sẽ không có nút Đ hay S nào,
    // và người kiểm thử sẽ tưởng nhãn hiển thị sai.
    content: rich("Xác định mỗi nhận định sau là Đúng hay Sai."),
    statements: [
      { id: "s_a", label: "a)", text: "9 999 > 10 000" },
      { id: "s_b", label: "b)", text: "27 362 < 27 400" },
      { id: "s_c", label: "c)", text: "57 899 < 75 001" },
      { id: "s_d", label: "d)", text: "84 012 > 84 021" },
    ],
    columns: { statement: "Nhận định", trueLabel: "Đúng", falseLabel: "Sai" },
    correctAnswer: { s_a: false, s_b: true, s_c: true, s_d: false },
  },

  // ── Diagram · diagram ──────────────────────────────────────────────────
  P47: {
    content: rich("Điền tên cơ quan vào sơ đồ tuần hoàn."),
    nodes: [
      { id: "n1", label: "?", fillable: true },
      { id: "n2", label: "Phổi", fillable: false },
    ],
    edges: [{ from: "n1", to: "n2" }],
    correctAnswer: { n1: ["Tim"] },
  },
  P48: {
    content: rich("Nối đường qua các node theo đúng thứ tự."),
    nodes: [
      { id: "n1", label: "Bắt đầu", x: 0.2, y: 0.5 },
      { id: "n2", label: "Giữa", x: 0.5, y: 0.3 },
      { id: "n3", label: "Kết thúc", x: 0.8, y: 0.5 },
    ],
    correctAnswer: ["n1", "n2", "n3"],
  },
  P73: {
    // Thiếu sample trước đây → MindMapTask nhận nodes rỗng và warn
    // "No root nodes found" trên console /dev/players.
    content: rich("Hoàn thành sơ đồ dàn ý bài văn tả cảnh."),
    nodes: [
      { id: "mo", label: "Mở bài", nodeType: "static" },
      { id: "than", label: "Thân bài", nodeType: "static" },
      { id: "ket", label: "Kết bài", nodeType: "static" },
      { id: "y1", prefix: "Ý 1:", nodeType: "input", acceptedAnswers: ["Tả bao quát"] },
      { id: "y2", prefix: "Ý 2:", nodeType: "essay", rowLines: 2 },
    ],
    edges: [
      { from: "than", to: "y1" },
      { from: "than", to: "y2" },
    ],
  },

  // ── Game · game ────────────────────────────────────────────────────────
  P49: {
    content: rich("Lật thẻ tìm cặp giống nhau."),
    pairs: [
      { id: "p1", a: { text: "Mèo" }, b: { text: "Cat" } },
      { id: "p2", a: { text: "Chó" }, b: { text: "Dog" } },
      { id: "p3", a: { text: "Cá" }, b: { text: "Fish" } },
    ],
  },
  P50: {
    content: rich("Nối các cặp biểu tượng giống nhau (Pikachu)."),
    tiles: [
      { id: "t1", symbol: "🍎" },
      { id: "t2", symbol: "🍌" },
      { id: "t3", symbol: "🍎" },
      { id: "t4", symbol: "🍌" },
    ],
  },
  P51: {
    content: rich("Phân loại các thẻ vào đúng nhóm."),
    categories: [
      { id: "c1", label: "Trái cây" },
      { id: "c2", label: "Con vật" },
    ],
    cards: [
      { id: "card1", text: "Táo" },
      { id: "card2", text: "Mèo" },
      { id: "card3", text: "Chuối" },
    ],
    correctAnswer: { card1: "c1", card2: "c2", card3: "c1" },
  },
  P52: {
    content: rich("Ghép các mảnh thành bức tranh hoàn chỉnh."),
    image: { url: img("jigsaw"), altText: "Tranh ghép" },
    grid: { rows: 2, cols: 2 },
  },
  P53: {
    content: rich("Tìm các từ ẩn trong lưới chữ."),
    grid: [
      ["M", "E", "O"],
      ["C", "H", "O"],
      ["C", "A", "X"],
    ],
    words: ["MEO", "CHO", "CA"],
  },
  P54: {
    content: rich("Giải ô chữ theo gợi ý."),
    size: { rows: 5, cols: 5 },
    entries: [
      { id: "e1", row: 0, col: 0, direction: "across", answer: "HANOI", clue: "Thủ đô của Việt Nam" },
      { id: "e2", row: 0, col: 0, direction: "down", answer: "HUE", clue: "Cố đô miền Trung" },
    ],
  },
  P55: {
    content: rich("Đoán từ còn ẩn (Hangman)."),
    answer: "HANOI",
    maxWrong: 6,
    hint: "Thủ đô của Việt Nam",
  },
  P56: {
    content: rich("Tìm các điểm khác nhau giữa hai bức tranh."),
    imageA: img("spotA"),
    imageB: img("spotB"),
    differences: [
      { id: "d1", x: 0.3, y: 0.4, radius: 0.08 },
      { id: "d2", x: 0.7, y: 0.6, radius: 0.08 },
    ],
  },

  // ── Wrapper · wrapper ──────────────────────────────────────────────────
  P57: {
    content: rich("Nhóm câu hỏi về Việt Nam."),
    sharedContent: rich("Dựa vào hiểu biết của em, trả lời các câu hỏi sau."),
    questions: [
      {
        id: "q1",
        type: "single_choice",
        display: { interactionType: "radio" },
        content: rich("Thủ đô của Việt Nam là?"),
        options: [
          { id: "A", content: rich("Hà Nội") },
          { id: "B", content: rich("Huế") },
        ],
        correctAnswer: "A",
      },
      {
        id: "q2",
        type: "true_false",
        display: { interactionType: "boolean" },
        content: rich("Việt Nam nằm ở châu Á."),
        correctAnswer: true,
      },
    ],
  },
  P58: {
    content: rich("Quiz tính giờ — trả lời nhanh nhất có thể."),
    timeLimitMs: 60000,
    questions: [
      {
        id: "q1",
        type: "single_choice",
        display: { interactionType: "radio" },
        content: rich("2 + 2 = ?"),
        options: [
          { id: "A", content: rich("3") },
          { id: "B", content: rich("4") },
        ],
        correctAnswer: "B",
      },
      {
        id: "q2",
        type: "numeric_answer",
        display: { interactionType: "numeric" },
        content: rich("5 × 3 = ?"),
        correctAnswer: 15,
        tolerance: 0,
      },
    ],
  },
  P59: {
    content: rich("Trả lời đúng để giữ mạng và nối chuỗi."),
    lives: 3,
    questions: [
      {
        id: "q1",
        type: "single_choice",
        display: { interactionType: "radio" },
        content: rich("Con vật nào biết bay?"),
        options: [
          { id: "A", content: rich("Con chim") },
          { id: "B", content: rich("Con cá") },
        ],
        correctAnswer: "A",
      },
      {
        id: "q2",
        type: "true_false",
        display: { interactionType: "boolean" },
        content: rich("Cá sống dưới nước."),
        correctAnswer: true,
      },
    ],
  },
  P60: {
    content: rich("Cờ đường đi — trả lời đúng để tiến lên."),
    boardLength: 10,
    questions: [
      {
        id: "q1",
        type: "single_choice",
        display: { interactionType: "radio" },
        content: rich("Màu của lá cây thường là?"),
        options: [
          { id: "A", content: rich("Xanh") },
          { id: "B", content: rich("Đỏ") },
        ],
        correctAnswer: "A",
      },
      {
        id: "q2",
        type: "numeric_answer",
        display: { interactionType: "numeric" },
        content: rich("10 - 4 = ?"),
        correctAnswer: 6,
        tolerance: 0,
      },
    ],
  },
  P61: {
    content: rich("Lớp trình bày đường đi với câu hỏi nối node."),
    totalSteps: 3,
    child: {
      type: "path_connect",
      display: { interactionType: "path" },
      content: rich("Nối đường qua các node theo đúng thứ tự."),
      nodes: [
        { id: "n1", label: "A", x: 0.2, y: 0.5 },
        { id: "n2", label: "B", x: 0.5, y: 0.3 },
        { id: "n3", label: "C", x: 0.8, y: 0.5 },
      ],
      correctAnswer: ["n1", "n2", "n3"],
    },
  },

  // ── Image color classify · image-hotspot ────────────────────────────────
  // Payload THẬT từ LCMS (VBT Tiếng Việt 1 tập một, bài "D d Đ đ", b8_q1) —
  // ảnh nét vẽ khép kín + vùng rect trùm cả nền trắng, đúng ca mà lớp tô theo
  // nét vẽ phải xử lý. Ảnh placeholder trước đây là ảnh CHỤP nên luôn rơi về
  // lối tô hình học, không nghiệm thu được tính năng này.
  P62: {
    content: rich("Tô màu xanh quả có tên gọi chứa d, tô màu vàng quả có tên gọi chứa đ."),
    image: {
      url: "https://cdn.nentanggiaoduc.edu.vn/lcms/assets/images/2f81068f-f09e-41ad-a587-4df1000c64d8.png",
      altText: "Năm quả vẽ nét: đu đủ, dứa, dừa, đào, dưa hấu",
    },
    categories: [
      { id: "xanh", label: "xanh", color: "#43A047" },
      { id: "vang", label: "vàng", color: "#FBC02D" },
    ],
    items: [
      { id: "dudu",           label: "dudu",           shape: "rect", x: 0.0319, y: 0.2457, width: 0.2742, height: 0.3353 },
      { id: "dua_pineapple",  label: "dua_pineapple",  shape: "rect", x: 0.3338, y: 0.196,  width: 0.1676, height: 0.5611 },
      { id: "dua_coconut",    label: "dua_coconut",    shape: "rect", x: 0.545,  y: 0.0639, width: 0.2375, height: 0.5256 },
      { id: "dao",            label: "dao",            shape: "rect", x: 0.162,  y: 0.6151, width: 0.1739, height: 0.3082 },
      { id: "duahau",         label: "duahau",         shape: "rect", x: 0.75,   y: 0.4645, width: 0.2278, height: 0.5043 },
    ],
    correctAnswer: {
      dudu: "vang",
      dua_pineapple: "xanh",
      dua_coconut: "xanh",
      dao: "vang",
      duahau: "xanh",
    },
  },

  // ── Bổ sung mẫu cho các trình phát còn trống (trước đây rơi vào fallback
  //    `{ content: rich(label) }` nên hiện ra trống trơn). ────────────────────
  // P63 — Nhiều nhận định Đúng/Sai (TrueFalseTablePlayer, biến thể radio)
  P63: {
    content: rich("Xác định mỗi nhận định sau là Đúng hay Sai."),
    statements: [
      { id: "s1", text: "Nước sôi ở 100°C trong điều kiện thường." },
      { id: "s2", text: "Cá thở bằng phổi." },
      { id: "s3", text: "Một năm có 12 tháng." },
    ],
    columns: { statement: "Nhận định", trueLabel: "Đúng", falseLabel: "Sai" },
    correctAnswer: { s1: true, s2: false, s3: true },
  },
  // P64 — Nối 2 hàng trên/dưới (MatchRowsPlayer)
  P64: {
    content: rich("Nối mỗi con vật với thức ăn của nó."),
    leftItems: [
      { id: "L1", content: rich("Thỏ") },
      { id: "L2", content: rich("Mèo") },
      { id: "L3", content: rich("Ong") },
    ],
    rightItems: [
      { id: "R1", content: rich("Cà rốt") },
      { id: "R2", content: rich("Cá") },
      { id: "R3", content: rich("Mật hoa") },
    ],
    correctAnswer: { L1: "R1", L2: "R2", L3: "R3" },
  },
  // P65 — Nối vòng tròn (MatchRadialPlayer)
  P65: {
    content: rich("Nối mỗi hành tinh với đặc điểm đúng."),
    leftItems: [
      { id: "L1", content: rich("Trái Đất") },
      { id: "L2", content: rich("Sao Hỏa") },
      { id: "L3", content: rich("Sao Thổ") },
    ],
    rightItems: [
      { id: "R1", content: rich("Có sự sống") },
      { id: "R2", content: rich("Hành tinh đỏ") },
      { id: "R3", content: rich("Có vành đai") },
    ],
    correctAnswer: { L1: "R1", L2: "R2", L3: "R3" },
  },
  // P66 — Nối chuỗi 3 cột (ChainMatchPlayer)
  P66: {
    content: rich("Nối con vật → thức ăn → nơi sống."),
    leftItems: [
      { id: "a1", content: rich("Cá") },
      { id: "a2", content: rich("Chim") },
    ],
    middleItems: [
      { id: "m1", content: rich("Rong rêu") },
      { id: "m2", content: rich("Sâu bọ") },
    ],
    rightItems: [
      { id: "z1", content: rich("Dưới nước") },
      { id: "z2", content: rich("Trên cây") },
    ],
    correctAnswer: { a1: "m1", m1: "z1", a2: "m2", m2: "z2" },
  },
  // P67 — Circle choice, single (SingleChoicePlayer)
  P67: {
    content: rich("Số nào lớn nhất?"),
    options: [
      { id: "A", text: "12" },
      { id: "B", text: "8" },
      { id: "C", text: "15" },
      { id: "D", text: "9" },
    ],
    correctAnswer: "C",
  },
  // P68 — Circle choice, multiple (MultiChoicePlayer)
  P68: {
    content: rich("Chọn tất cả các loài chim."),
    options: [
      { id: "A", content: rich("Chim sẻ") },
      { id: "B", content: rich("Cá heo") },
      { id: "C", content: rich("Chim én") },
      { id: "D", content: rich("Con bò") },
    ],
    correctAnswer: ["A", "C"],
  },
  // P69 — Color-fill choice, single (SingleChoicePlayer)
  P69: {
    content: rich("Thủ đô của Việt Nam là thành phố nào?"),
    options: [
      { id: "A", text: "TP. Hồ Chí Minh" },
      { id: "B", text: "Hà Nội" },
      { id: "C", text: "Đà Nẵng" },
      { id: "D", text: "Huế" },
    ],
    correctAnswer: "B",
  },
  // P70 — Color-fill choice, multiple (MultiChoicePlayer)
  P70: {
    content: rich("Chọn tất cả các số chia hết cho 5."),
    options: [
      { id: "A", content: rich("10") },
      { id: "B", content: rich("12") },
      { id: "C", content: rich("25") },
      { id: "D", content: rich("34") },
    ],
    correctAnswer: ["A", "C"],
  },
  // P71 — Button select, multiple (TileSelectPlayer)
  P71: {
    content: rich("Chọn tất cả các mùa trong năm."),
    options: [
      { id: "A", text: "Xuân" },
      { id: "B", text: "Hạ" },
      { id: "C", text: "Bão" },
      { id: "D", text: "Thu" },
      { id: "E", text: "Đông" },
    ],
    correctAnswer: ["A", "B", "D", "E"],
  },
  // P72 — Nối các điểm (ConnectPointsPlayer)
  P72: {
    content: rich("Nối các điểm theo thứ tự 1 → 2 → 3 → 4."),
    points: [
      { id: "p1", label: "1", x: 0.2,  y: 0.3 },
      { id: "p2", label: "2", x: 0.7,  y: 0.25 },
      { id: "p3", label: "3", x: 0.75, y: 0.7 },
      { id: "p4", label: "4", x: 0.25, y: 0.75 },
    ],
    correctAnswer: [
      { from: "p1", to: "p2" },
      { from: "p2", to: "p3" },
      { from: "p3", to: "p4" },
    ],
  },
  // P74 — Nộp bài làm (UploadAnswerPlayer) — không có đáp án, chỉ tải lên
  P74: {
    content: rich("Giải bài toán vào vở, chụp ảnh và tải lên bài làm của em."),
  },
  // P75 — Math expression as text (FormulaEntryPlayer)
  P75: {
    content: rich("Nhập công thức tính diện tích hình chữ nhật (dùng a và b)."),
    correctAnswer: ["a*b", "b*a", "a \\times b"],
    gradingMode: "symbolic",
  },
  // P82 — ô trống NẰM TRONG công thức. Mẫu cố ý đặt một ô ở MẪU SỐ: đó là chỗ mà
  // marker `{blank_N}` mức văn bản không với tới, nên nhìn card này là thấy ngay
  // player có làm đúng việc của nó hay không.
  P82: {
    content: {
      blocks: [
        { type: "paragraph", text: "Điền số thích hợp để hoàn thành biểu thức:" },
        { type: "math", latex: "\\frac{3}{\\placeholder[blank_1]{}} = \\placeholder[blank_2]{}" },
      ],
    },
    gradingMode: "symbolic",
    blanks: [
      { id: "blank_1", correctAnswer: ["5"], gradingMode: "numeric" },
      { id: "blank_2", correctAnswer: ["\\frac{3}{5}"], gradingMode: "algebraic_equivalence" },
    ],
  },
  // P76 — Nối 3 cột lấy giữa làm trung tâm (ChainMatchPlayer, biến thể triad)
  P76: {
    content: rich("Nối nguyên nhân → hiện tượng → kết quả."),
    leftItems: [
      { id: "h1", content: rich("Trời mưa") },
      { id: "h2", content: rich("Trời nắng to") },
    ],
    middleItems: [
      { id: "g1", content: rich("Đường ướt") },
      { id: "g2", content: rich("Đường khô") },
    ],
    rightItems: [
      { id: "k1", content: rich("Dễ trơn trượt") },
      { id: "k2", content: rich("Đi lại dễ dàng") },
    ],
    correctAnswer: { h1: "g1", g1: "k1", h2: "g2", g2: "k2" },
  },

  /**
   * P80 / P81 — kéo thả vào vùng thả và vào ô lưới (§5.11, ULNL II.16).
   *
   * Trước 2026-08-06 loại này là mở rộng chỉ-đọc với mã X01/X02 và KHÔNG có mẫu
   * demo, nên không ai xem được nó trên trang này — cùng lỗi mà P77 đã mắc.
   */
  P80: {
    content: rich("Kéo mỗi con vật vào đúng nơi sống của nó."),
    draggables: [
      { id: "d1", text: "Con cá" },
      { id: "d2", text: "Con chim" },
      { id: "d3", text: "Con giun" },
    ],
    dropZones: [
      { id: "z1", label: "Dưới nước" },
      { id: "z2", label: "Trên cây" },
      { id: "z3", label: "Trong đất" },
    ],
    correctAnswer: { d1: "z1", d2: "z2", d3: "z3" },
  },
  P81: {
    content: rich("Kéo mỗi số vào đúng ô của bảng."),
    grid: { rows: 2, cols: 2 },
    tokens: [
      { id: "t1", text: "2" },
      { id: "t2", text: "4" },
      { id: "t3", text: "6" },
      { id: "t4", text: "8" },
    ],
    correctAnswer: { t1: "0-0", t2: "0-1", t3: "1-0", t4: "1-1" },
  },

  /**
   * P79 — DỰNG biểu đồ (II.39).
   *
   * Khác biểu đồ dạng đề bài: 5 câu biểu đồ đang chạy trong kho sách đều đưa
   * biểu đồ vào như một ẢNH và học sinh trả lời bằng cloze/table_completion.
   * Loại này là chiều ngược lại — học sinh tự dựng biểu đồ từ số liệu.
   */
  P79: {
    content: richLines(
      "Số học sinh giỏi của bốn lớp khối 4 như sau: 4A có 8 bạn, 4B có 5 bạn, 4C có 10 bạn, 4D có 6 bạn.",
      "Hãy dựng biểu đồ cột thể hiện số liệu trên.",
    ),
    chart: {
      kind: "bar",
      categories: [
        { id: "a", label: "4A" },
        { id: "b", label: "4B" },
        { id: "c", label: "4C" },
        { id: "d", label: "4D" },
      ],
      yMax: 12,
      yStep: 1,
      yLabel: "Số học sinh",
      xLabel: "Lớp",
    },
    correctAnswer: { a: 8, b: 5, c: 10, d: 6 },
  },

  /**
   * P77 — điền khuyết bằng CHỌN đáp án (II.7). Lấy nguyên câu Tiếng Việt 1 bài 38:
   * "Điền ai, ay hay ây?" — một danh sách lựa chọn DÙNG CHUNG cho mọi ô, khai ở
   * `options` cấp câu chứ không lặp lại trong từng ô.
   *
   * Ô cuối tự khai `options` riêng để thấy luật ĐÈ: lựa chọn của ô thắng danh
   * sách dùng chung (§5.6.3).
   */
  P77: {
    content: richLines(
      "Điền ai, ay hay ây?",
      "lùm c___[b1]___ · đám m___[b2]___ · b___[b3]___ tay",
      "Ô cuối có danh sách riêng: ___[b4]___",
    ),
    options: ["ai", "ay", "ây"],
    blanks: [
      { id: "b1" },
      { id: "b2" },
      { id: "b3" },
      { id: "b4", options: ["quả na", "quả nha"] },
    ],
    correctAnswer: { b1: "ây", b2: "ây", b3: "ai", b4: "quả na" },
  },
};

// ---------------------------------------------------------------------------
// Nhóm thẻ "Cỡ ảnh" — ca NHIỀU ảnh trong một câu (web-own, thêm 31/7)
// ---------------------------------------------------------------------------
//
// Bốn thẻ dưới đây là bộ kiểm bằng mắt cho việc xử lý ảnh khó kiểm soát cỡ:
//   M01 — đề bài 4 ảnh liền nhau  → phải gom LƯỚI + trần cao + bấm phóng to
//   M02 — đề bài 1 ảnh            → phải giữ NGUYÊN KHỔ (chính sách #427)
//   M03 — đáp án có ảnh           → chỉ đổi CỠ, không đổi bố cục lựa chọn
//   M04 — nối cột, ảnh trong item → mỗi item vẫn MỘT HÀNG, cột không vỡ
//   M05 — nhóm câu, câu con có ảnh→ từng câu con hiển thị đạt như câu đơn
//
// Chúng KHÔNG nằm trong PLAYER_MANIFEST (không phải trình phát mới) nên được
// dựng thành PlayerEntry tổng hợp và ghép vào đầu danh sách nhóm.

/** Chip MỘT TỪ — đơn vị nhỏ mà `layout: "list"` từng ép mỗi cái một dòng. */
const CHIP_WORDS = ["sấm", "hươu", "giờ", "trời", "mưa", "gió", "nắng", "bão"];

const MEDIA_SAMPLES: Record<string, Payload> = {
  M01: {
    content: {
      blocks: [
        { type: "paragraph", text: "Quan sát bốn bức tranh rồi cho biết bức nào vẽ mùa xuân?" },
        imgBlock("Tranh 1"),
        imgBlock("Tranh 2"),
        imgBlock("Tranh 3", 420, 900),
        imgBlock("Tranh 4"),
      ],
    },
    options: [
      { id: "A", text: "Tranh 1" },
      { id: "B", text: "Tranh 2" },
      { id: "C", text: "Tranh 3" },
      { id: "D", text: "Tranh 4" },
    ],
    correctAnswer: "C",
  },
  M02: {
    content: {
      blocks: [
        { type: "paragraph", text: "Đọc bản nhạc rồi cho biết bài hát ở nhịp mấy?" },
        imgBlock("Bản nhạc", 900, 620),
      ],
    },
    options: [
      { id: "A", text: "Nhịp 2/4" },
      { id: "B", text: "Nhịp 3/4" },
      { id: "C", text: "Nhịp 4/4" },
    ],
    correctAnswer: "A",
  },
  M03: {
    content: rich("Chọn hình có nhiều hình tròn nhất."),
    options: [
      { id: "A", content: { blocks: [imgBlock("A", 700, 780)] } },
      { id: "B", content: { blocks: [imgBlock("B")] } },
      { id: "C", content: { blocks: [imgBlock("C", 1200, 500)] } },
    ],
    correctAnswer: "B",
  },
  M04: {
    content: rich("Nối mỗi bức tranh với tên gọi đúng."),
    leftItems: [
      { id: "L1", imageUrl: scan("Cá", 640, 700) },
      { id: "L2", imageUrl: scan("Mèo") },
      { id: "L3", imageUrl: scan("Chim", 1300, 520) },
    ],
    rightItems: [
      { id: "R1", text: "Con cá" },
      { id: "R2", text: "Con mèo" },
      { id: "R3", text: "Con chim" },
    ],
    correctAnswer: { L1: "R1", L2: "R2", L3: "R3" },
  },
  M05: {
    content: rich("Đọc đoạn văn rồi trả lời các câu hỏi."),
    questions: [
      {
        id: "g1",
        type: "single_choice",
        content: { blocks: [{ type: "paragraph", text: "1) Bức tranh nào vẽ buổi sáng?" }, imgBlock("Câu 1a"), imgBlock("Câu 1b")] },
        options: [{ id: "A", text: "Bên trái" }, { id: "B", text: "Bên phải" }],
        correctAnswer: "A",
      },
      {
        id: "g2",
        type: "single_choice",
        content: { blocks: [{ type: "paragraph", text: "2) Con vật nào sống dưới nước?" }, imgBlock("Câu 2", 800, 700)] },
        options: [{ id: "A", text: "Cá" }, { id: "B", text: "Mèo" }],
        correctAnswer: "A",
      },
      {
        id: "g3",
        type: "single_choice",
        content: { blocks: [{ type: "paragraph", text: "3) Hình nào là hình tam giác?" }, imgBlock("Câu 3a"), imgBlock("Câu 3b"), imgBlock("Câu 3c")] },
        options: [{ id: "A", text: "Hình 1" }, { id: "B", text: "Hình 3" }],
        correctAnswer: "B",
      },
    ],
  },
  // Đúng hình dạng `b5_i4_q1`: chip MỘT TỪ + tác giả khai layout "list".
  // Trước sửa: mỗi chip một dòng, khay dài lê thê.
  M06: {
    display: { layout: "list" },
    content: rich("Xếp các từ sau vào đúng nhóm."),
    categories: [
      { id: "c1", label: "Sự vật" },
      { id: "c2", label: "Hiện tượng" },
    ],
    items: CHIP_WORDS.map((text, i) => ({ id: `i${i}`, text })),
    correctAnswer: CHIP_WORDS.map((_, i) => ({
      itemId: `i${i}`,
      categoryId: i % 2 === 0 ? "c1" : "c2",
    })),
  },
  // GAP-251 — layout `dots`: điểm nối vẽ thành chấm đen nhỏ như bài nối-số in
  // trong vở. Dùng chuỗi 10 điểm (không phải 4 điểm của P72) để soi đúng hai thứ
  // mà mẫu thưa giấu mất: chấm có bị nét nuốt không, và vùng chạm 44px của hai
  // chấm liền nhau có chồng nhau không.
  M07: {
    display: { layout: "dots" },
    content: rich("Nối các điểm từ 1 đến 10 để hoàn thành hình."),
    points: Array.from({ length: 10 }, (_, i) => {
      const angle = (Math.PI * (i + 1)) / 11;
      return {
        id: `d${i + 1}`,
        label: String(i + 1),
        x: 0.12 + 0.76 * (1 - Math.cos(angle)) / 2,
        y: 0.78 - 0.5 * Math.sin(angle),
      };
    }),
    correctAnswer: Array.from({ length: 9 }, (_, i) => ({ from: `d${i + 1}`, to: `d${i + 2}` })),
  },
};

const MEDIA_ENTRIES: PlayerEntry[] = [
  { id: "M01", label: "Đề bài 4 ảnh liền nhau", type: "single_choice", interactionType: "radio" },
  { id: "M02", label: "Đề bài 1 ảnh (phải nguyên khổ)", type: "single_choice", interactionType: "radio" },
  { id: "M03", label: "Đáp án có ảnh", type: "single_choice", interactionType: "radio" },
  { id: "M04", label: "Nối cột — ảnh trong item", type: "matching", interactionType: "columns" },
  { id: "M05", label: "Nhóm câu — câu con có ảnh", type: "question_group", interactionType: "group" },
  { id: "M06", label: "Khay chip ngắn + layout list", type: "classification", interactionType: "buckets" },
  { id: "M07", label: "Nối điểm — dạng chấm đen (layout dots)", type: "connect_points", interactionType: "lines" },
].map((entry) => ({
  ...entry,
  family: "media-sizing" as PlayerEntry["family"],
  component: "—",
  supportedLayouts: [],
}));

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

const FAMILY_LABELS: Record<string, string> = {
  "choice-grid": "Lựa chọn (choice-grid)",
  "image-hotspot": "Điểm ảnh (image-hotspot)",
  "text-input": "Nhập văn bản (text-input)",
  "sortable-list": "Sắp xếp (sortable-list)",
  match: "Ghép nối (match)",
  "dnd-canvas": "Kéo thả (dnd-canvas)",
  scale: "Thang đo (scale)",
  highlight: "Tô chọn (highlight)",
  "media-wrapper": "Đa phương tiện (media-wrapper)",
  skill: "Kỹ năng (skill)",
  table: "Bảng (table)",
  diagram: "Sơ đồ (diagram)",
  game: "Trò chơi (game)",
  wrapper: "Bao bọc (wrapper)",
  "media-sizing": "Cỡ ảnh — câu nhiều ảnh (media-sizing)",
};

/**
 * `review` = bề mặt XEM LẠI bài đã nộp: giống `parent` nhưng `revealCorrect`
 * bật, nên khối "Đáp án đúng" của PlayerShell mới hiện ra. Không có chế độ này
 * thì 36 player dựng đáp án qua `answerReveal` không soi được trên trang dev.
 */
type Mode = "self" | "parent" | "review";

/** A single demo card: owns its captured answer + checked state. */
function PlayerCard({ entry, mode, dark }: { entry: PlayerEntry; mode: Mode; dark: boolean }) {
  const sample = MEDIA_SAMPLES[entry.id] ?? SAMPLES[entry.id] ?? { content: rich(entry.label) };
  // The variant is chosen by display.interactionType — inject it from the
  // manifest entry so non-default variants resolve to the right player.
  const payload = {
    ...sample,
    display: { ...(sample.display as object | undefined), interactionType: entry.interactionType },
  };
  const [answer, setAnswer] = React.useState<unknown>(undefined);
  const [checked, setChecked] = React.useState(false);

  // Reset verdict when the global grading mode changes.
  React.useEffect(() => {
    setChecked(false);
  }, [mode]);

  const result =
    mode !== "self" && checked
      ? verdictFor(entry.type, payload, undefined, answer)
      : undefined;

  const handlers =
    mode === "self"
      ? {
          ...DEMO_UPLOAD_HANDLERS,
          onAnswerChange: (a: unknown) => setAnswer(a),
          submitted: checked,
        }
      : {
          ...DEMO_UPLOAD_HANDLERS,
          onAnswerChange: (a: unknown) => setAnswer(a),
          submitted: checked,
          gradeMode: "parent" as const,
          // Demo phải khớp surface học sinh: facade QuestionPlayer đặt
          // revealCorrect=false (chấm sai không lộ ô đúng chưa chọn — BUG-03).
          // Chỉ bề mặt xem lại bài đã nộp mới lộ đáp án.
          revealCorrect: mode === "review",
          result,
        };

  return (
    <section
      id={entry.id}
      className={
        "scroll-mt-8 rounded-2xl border p-5 shadow-sm " +
        (dark ? "border-gray-700 bg-gray-900" : "border-slate-200 bg-white")
      }
    >
      <div className="mb-3">
        <h2 className={"text-lg font-bold " + (dark ? "text-gray-100" : "")}>
          <span className={dark ? "font-mono text-indigo-400" : "font-mono text-blue-600"}>{entry.id}</span> ·{" "}
          {entry.label} ·{" "}
          <code className={
            "rounded px-1.5 py-0.5 text-sm font-normal " +
            (dark ? "bg-gray-800 text-gray-400" : "bg-slate-100 text-slate-600")
          }>
            {entry.type}/{entry.interactionType}
          </code>
        </h2>
      </div>
      <div className={
        "mt-3 min-h-[180px] rounded-xl border p-2 " +
        (dark ? "border-gray-700 bg-gray-950/40" : "border-slate-100 bg-slate-50/50")
      }>
        <CardBoundary id={entry.id}>
          {renderInteractionPlayer(entry.type, payload, handlers)}
        </CardBoundary>
      </div>
      {mode !== "self" && (
        <div className="mt-4 flex items-center justify-end gap-2 border-t border-slate-100 pt-4">
          {checked && (
            <span
              className={
                "rounded-full px-2 py-0.5 text-xs font-semibold " +
                (result === "correct"
                  ? "bg-green-100 text-green-700"
                  : result === "incorrect"
                    ? "bg-red-100 text-red-700"
                    : "bg-amber-100 text-amber-700")
              }
            >
              {result === "correct"
                ? "Đúng"
                : result === "incorrect"
                  ? "Sai"
                  : result === "incomplete"
                    ? "Chưa chấm được"
                    : "Chưa trả lời"}
            </span>
          )}
          <button
            type="button"
            onClick={() => setChecked((c) => !c)}
            className={
              "rounded-lg px-3 py-1 text-sm font-semibold transition-colors " +
              (checked
                ? "bg-slate-200 text-slate-700 hover:bg-slate-300"
                : "bg-blue-600 text-white hover:bg-blue-700")
            }
          >
            {checked ? "Làm lại" : "Kiểm tra"}
          </button>
        </div>
      )}
    </section>
  );
}

const MODE_OPTIONS: { value: Mode; label: string; title: string }[] = [
  { value: "self", label: "Tự chấm", title: "Học sinh tự chấm" },
  { value: "parent", label: "Parent", title: "Phụ huynh chấm" },
  { value: "review", label: "Xem lại", title: "Xem lại bài đã nộp — hiện khối Đáp án đúng" },
];

const SKIN_OPTIONS: { value: SkinName; label: string; title: string }[] = [
  { value: "playful", label: "Học sinh", title: "Giao diện học sinh" },
  { value: "studio", label: "Studio", title: "Giao diện studio" },
  { value: "dark", label: "Dark", title: "Giao diện tối" },
  { value: "corporate", label: "Corp", title: "Giao diện corporate" },
];

/**
 * Compact segmented control used by the floating dev panel. Renders as a
 * 2-column grid so >2 options wrap onto extra rows instead of widening the
 * panel (bg-slate-300 + gap-px draws the hairlines between cells).
 */
function MiniSegmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string; title: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="grid w-full grid-cols-2 gap-px overflow-hidden rounded-md border border-slate-300 bg-slate-300">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          title={opt.title}
          onClick={() => onChange(opt.value)}
          className={
            "px-2 py-1 text-xs font-semibold leading-5 transition-colors " +
            (value === opt.value
              ? "bg-blue-600 text-white"
              : "bg-white text-slate-600 hover:bg-slate-100")
          }
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export function PlayersDemoPage() {
  const [mode, setMode] = React.useState<Mode>("self");
  const [skin, setSkin] = React.useState<SkinName>("playful");
  const [panelOpen, setPanelOpen] = React.useState(true);

  // Group manifest entries by family, preserving manifest order. Nhóm "Cỡ ảnh"
  // (không thuộc manifest) đứng ĐẦU — đây là bộ kiểm bằng mắt hay phải mở nhất.
  const families: { family: string; entries: PlayerEntry[] }[] = [
    { family: "media-sizing", entries: MEDIA_ENTRIES },
  ];
  for (const entry of PLAYER_MANIFEST) {
    let group = families.find((g) => g.family === entry.family);
    if (!group) {
      group = { family: entry.family, entries: [] };
      families.push(group);
    }
    group.entries.push(entry);
  }

  const dark = skin === "dark";
  // corporateSkin dùng CSS-var (bg-primary, bg-primary-light…) chỉ resolve ra
  // bảng màu design-system dưới [data-theme="corporate"]. Đặt lên wrapper để
  // preview đúng màu, không bị theme playful (global) chen vào.
  const corporate = skin === "corporate";
  const wrapperBg = dark
    ? "bg-gray-950 text-gray-200"
    : corporate
      ? "bg-white text-slate-800"
      : "bg-slate-50 text-slate-800";

  return (
    <SkinProvider skin={skin}>
    <div data-theme={corporate ? "corporate" : undefined} className={"min-h-screen " + wrapperBg}>
      {/* Floating controls — dock sát lề phải, thu gọn được để không che player */}
      <div className="fixed top-1/2 right-0 z-50 flex -translate-y-1/2 items-stretch opacity-70 transition-opacity hover:opacity-100 focus-within:opacity-100">
        {panelOpen ? (
          <div className="flex items-center gap-1 rounded-l-xl border border-r-0 border-slate-200 bg-white/95 py-2 pr-1 pl-2 shadow-md backdrop-blur">
            <div className="flex w-40 flex-col gap-2">
              <div>
                <p className="mb-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                  Cách chấm
                </p>
                <MiniSegmented value={mode} options={MODE_OPTIONS} onChange={setMode} />
              </div>
              <div className="border-t border-slate-200 pt-2">
                <p className="mb-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                  Giao diện
                </p>
                <MiniSegmented value={skin} options={SKIN_OPTIONS} onChange={setSkin} />
              </div>
            </div>
            <button
              type="button"
              title="Ẩn bảng điều khiển"
              onClick={() => setPanelOpen(false)}
              className="self-stretch rounded px-1 text-xs text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            >
              ›
            </button>
          </div>
        ) : (
          <button
            type="button"
            title="Hiện bảng điều khiển (chấm · giao diện)"
            onClick={() => setPanelOpen(true)}
            className="rounded-l-lg border border-r-0 border-slate-200 bg-white/95 px-1 py-3 text-xs leading-4 text-slate-400 shadow-md backdrop-blur hover:text-slate-600"
          >
            ‹
          </button>
        )}
      </div>

      <div className="mx-auto max-w-6xl px-4 py-8">
        <header className="mb-6">
          <h1 className="text-3xl font-black tracking-tight">
            Thư viện trình phát câu hỏi
          </h1>
          <p className="mt-1 text-slate-500">
            {PLAYER_MANIFEST.length} trình phát qua lớp điều phối{" "}
            <code className="rounded bg-slate-200 px-1 py-0.5 text-sm">
              renderInteractionPlayer
            </code>
            .
          </p>
        </header>

        <div className="flex gap-8">
          {/* Sticky left index */}
          <nav className="sticky top-8 hidden h-fit w-56 shrink-0 self-start lg:block">
            <ul className="space-y-4 text-sm">
              {families.map((g) => (
                <li key={g.family}>
                  <p className="mb-1 font-bold text-slate-700">
                    {FAMILY_LABELS[g.family] ?? g.family}
                  </p>
                  <ul className="space-y-0.5 border-l-2 border-slate-200 pl-3">
                    {g.entries.map((entry) => (
                      <li key={entry.id}>
                        <a
                          href={`#${entry.id}`}
                          className="block text-slate-500 transition-colors hover:text-blue-600"
                        >
                          <span className="font-mono text-xs">{entry.id}</span>{" "}
                          {entry.label}
                        </a>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </nav>

          {/* Right column of cards, grouped by family in manifest order */}
          <div className="min-w-0 flex-1 space-y-10">
            {families.map((g) => (
              <div key={g.family} className="space-y-6">
                <h3 className="text-sm font-bold uppercase tracking-wide text-slate-400">
                  {FAMILY_LABELS[g.family] ?? g.family}
                </h3>
                {g.entries.map((entry) => (
                  <PlayerCard key={entry.id} entry={entry} mode={mode} dark={dark} />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
    </SkinProvider>
  );
}
