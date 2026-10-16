import { matchingInteractionFromLayoutAlias } from '@/core/question-schema/matching';

/**
 * Shared contract for the schema's item-level display layout hint.
 *
 * `display.layout` is presentation-only. It must never be used by grading or
 * answer adapters. The scope is deliberately narrow and mirrors §10.1 of the
 * canonical content schema specification.
 */
/**
 * Layout XẾP: mô tả cách xếp một tập phần tử, hợp lệ về cấu trúc trên mọi type
 * (§10.1). Đây là tập mặc định phát cho mọi interaction — xem `ALL` ở manifest.
 */
export const ARRANGEMENT_LAYOUTS = ['list', 'grid_2', 'grid_3', 'grid_4', 'inline'] as const;

/**
 * Layout GIỚI HẠN THEO TYPE (§10.1 "Layout giới hạn theo type", GAP-251): chỉ hợp lệ
 * trên type được cấp riêng trong manifest, KHÔNG được gộp vào tập mặc định — nếu gộp
 * thì cả 47 type đều chào giá trị này trong ô chọn bố cục của editor.
 *
 * `dots` — `connect_points` vẽ điểm nối thành chấm tròn đen nhỏ (bản in nối-số trong
 * vở bài tập) thay cho vòng tròn lớn có viền. Cùng player P72, cùng cách chấm.
 */
export const TYPE_SCOPED_LAYOUTS = ['dots'] as const;

export const DISPLAY_LAYOUTS = [...ARRANGEMENT_LAYOUTS, ...TYPE_SCOPED_LAYOUTS] as const;
export type DisplayLayout = (typeof DISPLAY_LAYOUTS)[number];

export interface ResolvedLayout {
  key: DisplayLayout;
  mode: 'list' | 'inline' | 'grid';
  flow: 'row' | 'column';
  columns: 1 | 2 | 3 | 4 | 'auto';
  order: 'row-major' | 'column-major';
  /**
   * false khi layout chỉ là fallback mặc định của manifest (tác giả KHÔNG khai
   * display.layout). Cho phép player có chrome mặc định riêng (lưới thẻ vuông
   * count-aware của image-choice, pill cạnh nhau…) dùng nó thay fallback
   * "list"; layout tác giả khai rõ vẫn được tôn trọng.
   */
  authored?: boolean;
}

export const DISPLAY_LAYOUT_LABELS: Record<DisplayLayout, string> = {
  list: 'Danh sách dọc',
  grid_2: 'Lưới 2 cột',
  grid_3: 'Lưới 3 cột',
  grid_4: 'Lưới 4 cột',
  inline: 'Hàng ngang',
  dots: 'Chấm tròn (nối số)',
};

export const MATCHING_LEGACY_LAYOUTS = ['radial', 'row', 'scene'] as const;
export type MatchingLegacyLayout = (typeof MATCHING_LEGACY_LAYOUTS)[number];

export const MATCHING_LEGACY_LAYOUT_LABELS: Record<MatchingLegacyLayout, string> = {
  radial: 'Nối vòng tròn (legacy)',
  row: 'Nối theo hàng (legacy)',
  scene: 'Nối theo cảnh (legacy)',
};

export type DisplayLayoutScope = 'options' | 'items' | 'children' | 'points';

/** Return the schema-defined collection that the generic layout controls. */
export function displayLayoutScope(
  type: string,
): DisplayLayoutScope | null {
  if (type === 'single_choice' || type === 'multiple_choice' || type === 'true_false') {
    return 'options';
  }
  if (type === 'ordering') return 'items';
  if (type === 'classification') return 'items';
  if (type === 'question_group') return 'children';
  // §10.1: vùng các điểm nối (chỉ `list` + `dots`).
  if (type === 'connect_points') return 'points';
  return null;
}

export function isDisplayLayout(value: unknown): value is DisplayLayout {
  return typeof value === 'string' && (DISPLAY_LAYOUTS as readonly string[]).includes(value);
}

export function readDisplayLayout(payload: Record<string, unknown>): DisplayLayout | undefined {
  const display = payload.display;
  const value = display && typeof display === 'object'
    ? (display as Record<string, unknown>).layout
    : undefined;
  return isDisplayLayout(value) ? value : undefined;
}

export function normalizeDisplayLayout(layout: DisplayLayout): ResolvedLayout {
  switch (layout) {
    case 'inline':
      return { key: layout, mode: 'inline', flow: 'row', columns: 'auto', order: 'row-major' };
    case 'grid_2':
      return { key: layout, mode: 'grid', flow: 'row', columns: 2, order: 'row-major' };
    case 'grid_3':
      return { key: layout, mode: 'grid', flow: 'row', columns: 3, order: 'row-major' };
    case 'grid_4':
      return { key: layout, mode: 'grid', flow: 'row', columns: 4, order: 'row-major' };
    case 'dots':
      // Layout giới hạn theo type: flow/columns ở đây là trơ — player canvas đặt
      // điểm theo toạ độ x/y, không theo dòng cột. Giữ shape đầy đủ để mọi hàm đọc
      // ResolvedLayout không phải xử lý ngoại lệ.
      return { key: layout, mode: 'inline', flow: 'row', columns: 'auto', order: 'row-major' };
    case 'list':
    default:
      return { key: 'list', mode: 'list', flow: 'column', columns: 1, order: 'column-major' };
  }
}

export type LayoutInput = DisplayLayout | ResolvedLayout | undefined;

export function displayLayoutKey(layout: LayoutInput, fallback: DisplayLayout = 'list'): DisplayLayout {
  return typeof layout === 'object' && layout != null ? layout.key : layout ?? fallback;
}

/**
 * true khi layout đến từ tác giả (string trực tiếp, hoặc ResolvedLayout không
 * bị đánh dấu fallback). Player dùng nó để quyết định giữa
 * `layoutContainerClass` (tôn trọng tác giả) và chrome mặc định riêng.
 */
export function isAuthoredLayout(layout: LayoutInput): boolean {
  if (layout == null) return false;
  return typeof layout !== 'object' || layout.authored !== false;
}

/**
 * Bố cục NGANG (wrap) có phải là mặc định cho danh sách phương án chữ này?
 *
 * MẶC ĐỊNH INLINE (Owner 4/8 → 5/8): câu chọn (single/multi) mà tác giả KHÔNG
 * khai `display.layout` thì hiển thị options INLINE (flex-wrap) — phương án ngắn
 * xếp NGANG cạnh nhau, phương án dài (pill rộng) tự xuống dòng riêng. Trước đây
 * chỉ inline khi có ≥5 phương án ngắn (avg ≤40 ký tự); ngưỡng đó đã bỏ theo yêu
 * cầu "để default hiển thị các options inline".
 *
 * Hai ngoại lệ giữ nguyên:
 * - Tác giả khai `display.layout` → LUÔN thắng (`isAuthoredLayout`).
 * - Phương án có ẢNH (`textLength` null) → giữ bố cục dọc: bề rộng thẻ do ảnh
 *   quyết định, xếp ngang không suy ra được từ chữ (lưới ảnh có player riêng).
 */
export function shouldInlineChoiceOptions(
  layout: LayoutInput,
  textLengths: (number | null)[],
): boolean {
  if (isAuthoredLayout(layout)) return false;
  if (textLengths.some((len) => len == null)) return false;
  return true;
}

export function matchingLegacyLayout(payload: Record<string, unknown>): MatchingLegacyLayout | undefined {
  const value = payload.layout;
  return typeof value === 'string' && (MATCHING_LEGACY_LAYOUTS as readonly string[]).includes(value)
    ? value as MatchingLegacyLayout
    : undefined;
}

/** Static classes keep Tailwind's scanner aware of every supported layout. */
export function layoutContainerClass(
  layout: LayoutInput,
  fallback: DisplayLayout = 'list',
): string {
  switch (displayLayoutKey(layout, fallback)) {
    case 'grid_2':
      return 'grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3';
    case 'grid_3':
      return 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3';
    case 'grid_4':
      return 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3';
    case 'inline':
      return 'flex flex-wrap gap-2 sm:gap-3';
    case 'list':
    default:
      return 'flex flex-col gap-2 sm:gap-3';
  }
}

/**
 * Container class cho KHAY/NHÓM CHIP — luôn wrap ngang, KHÔNG đọc
 * `display.layout` (Owner 31/7).
 *
 * Chip là đơn vị NHỎ (một từ: "sấm", "hươu", "giờ"). `display.layout = "list"`
 * chỉ có nghĩa với thẻ phương án DÀI; áp vào khay chip thì mỗi chữ một dòng và
 * câu `b5_i4_q1` dài lê thê, cuộn mãi không hết. Theo luật Owner 30/7 —
 * "layout chỉ quyết định CÁCH XẾP, không quyết định chrome" — thì với chip,
 * cách xếp đúng luôn là wrap ngang, bất kể tác giả khai gì.
 *
 * Vẫn giữ `data-layout-region` + `data-display-layout` ở call site để test/QA
 * soi được layout tác giả khai, chỉ CLASS là không theo nữa.
 *
 * KHÔNG dùng cho thẻ phương án / thẻ sắp xếp (SingleChoice, MultiChoice, Rank,
 * ReorderList, ProcessSequence…) — ở đó `list` là ý đồ thật.
 */
export function chipTrayClass(): string {
  return 'flex flex-wrap gap-2 sm:gap-3';
}

/**
 * Lớp bọc các ô nối của MỘT CỘT trong lưới nối nhiều cột (chuỗi/triad).
 *
 * `hasMedia` là điều kiện của CẢ CÂU, không phải của riêng cột: câu có ảnh/video
 * ở bất kỳ cột nào thì mọi cột canh giữa theo trục dọc; câu toàn CHỮ thì mọi cột
 * dồn lên đầu (Owner 9/8 — "không có ảnh thì cơ bản là không cần căn gì cả").
 *
 * Vì sao lấy media làm cửa (chứ không canh giữa đại trà):
 * - Ô nối KHÔNG tương ứng theo hàng (cặp đúng cố tình xáo), nên canh giữa không
 *   làm gì "thẳng hàng" cả — nó chỉ chia lại chỗ trống. Với CHỮ, các khối cao
 *   thấp khác nhau sẵn, canh giữa chỉ đổi mép lởm chởm từ một đầu sang hai đầu,
 *   lại kéo ô đầu tiên rời khỏi tiêu đề cột.
 * - Với ẢNH thì khác: thẻ tranh cao cố định, không reflow, nên cột 2 tranh cạnh
 *   cột 3 tranh để lại khoảng trống chết ~200px và đường nối chúc hết xuống dưới.
 *   Đó là chỗ canh giữa mua được đối xứng thật.
 * - Chữ mà tràn/dài quá là lỗi DỮ LIỆU, sửa ở data, không "chữa cháy" bằng layout.
 *
 * Lịch sử: #92 canh giữa mọi cột (không điều kiện) → `95131076/bai2` câu 1 toàn
 * chữ bị lệch 53px, kéo cả nhãn cột → phải gỡ ở 58086b6. Cửa media + tách tiêu
 * đề ra khỏi vùng canh giữa là hai điều kiện commit đó dặn phải có trước khi lấy
 * lại hiệu ứng này.
 *
 * Chuỗi Tailwind để NGUYÊN VẸN (không nối chuỗi) cho bộ quét sinh CSS.
 */
export function matchColumnItemsClass(hasMedia: boolean): string {
  return hasMedia
    ? 'flex min-w-0 flex-1 flex-col justify-center gap-2 sm:gap-3'
    : 'flex min-w-0 flex-col gap-2 sm:gap-3';
}

/** Nhãn QA cho {@link matchColumnItemsClass} — soi được cửa media đã mở hay chưa. */
export function matchColumnItemsAlign(hasMedia: boolean): 'center' | 'top' {
  return hasMedia ? 'center' : 'top';
}

/**
 * Default square-card grid for the image-choice players when the author did NOT
 * declare a display.layout (Owner 30/7 — layout của web thắng). Count-aware,
 * mirroring nxbgd .img-grid: exactly 2 or 4 options → 2 columns (a clean 2×2
 * for 4, avoiding an unbalanced 3+1); otherwise responsive 2/3. Static strings
 * keep Tailwind's scanner aware of every class.
 */
export function imageChoiceGridClass(count: number): string {
  return count === 2 || count === 4
    ? 'grid gap-3 grid-cols-2'
    : 'grid gap-3 grid-cols-2 sm:grid-cols-3';
}

/** Số cột thực tế của {@link imageChoiceGridClass} ở khung desktop — dùng để
 * suy ra SỐ HÀNG khi cần chia chỗ trống cho ảnh (xem useAvailableHeight). */
export function imageChoiceGridColumns(count: number): number {
  return count === 2 || count === 4 ? 2 : 3;
}

/**
 * Số cột TỐI THIỂU để lưới có không quá 2 hàng (Owner 8/8) — ba hàng là tràn
 * khỏi vùng làm bài. 2–4 phần tử → 2 cột; 5–6 → 3 cột; từ 7 → 4 cột (trần:
 * hẹp hơn nữa thì ảnh bé đến mức không nhận ra nội dung). Caller có thể giữ số
 * cột tác giả khai lớn hơn: 2 hàng là trần, không phải mục tiêu bắt buộc. Quá
 * 8 phần tử buộc phải sang hàng thứ ba — chấp nhận, vì thu nhỏ tiếp là mất nghĩa.
 *
 * Lớp Tailwind phải là chuỗi NGUYÊN VẸN trong mã nguồn thì bộ quét mới sinh
 * CSS — nên tra bảng, không nối chuỗi `sm:grid-cols-${n}`.
 */
export function twoRowGridColumns(count: number): number {
  return Math.min(4, Math.max(2, Math.ceil(count / 2)));
}

const TWO_ROW_GRID_COLS: Record<number, string> = {
  2: 'sm:grid-cols-2',
  3: 'sm:grid-cols-3',
  4: 'sm:grid-cols-4',
};

export function twoRowGridClass(count: number, gap = 'gap-4'): string {
  return `grid ${gap} ${TWO_ROW_GRID_COLS[twoRowGridColumns(count)]}`;
}

/** `data-display-layout` key matching {@link imageChoiceGridClass}. */
export function imageChoiceGridKey(count: number): DisplayLayout {
  return count === 2 || count === 4 ? 'grid_2' : 'grid_3';
}

/**
 * Trần số cột của lưới ảnh tự động — 5.
 *
 * Chọn từ SỐ ĐO THẬT (3/8, harness `b7_q1` trong khung 900px → lưới rộng 788px,
 * và khung 1280px → lưới 1024px; ảnh trung vị kho 660×340):
 *
 *   cột   ảnh rộng @788px   ảnh cao   |   ảnh rộng @1024px   ảnh cao
 *   2       364px            188px    |     435px             224px
 *   3       231px            119px    |     309px             159px
 *   4       164px             84px    |     223px             115px
 *   5       124px             64px    |     171px              88px
 *   6        97px             50px    |     137px              70px
 *   7        78px             40px    |     112px              58px
 *
 * 5 cột là bậc cuối còn giữ ảnh trên ngưỡng 100px rộng ở khung hẹp (124px) —
 * vẫn nhận ra đồ vật trong câu TNXH lớp 1. Từ 6 cột trở đi ảnh tụt xuống
 * 97×50px: cỡ favicon, học sinh không phân biệt được "bàn chải" với "lược", nên
 * ép cho đủ 2 hàng ở đó là đổi một vấn đề bố cục lấy một vấn đề nội dung.
 */
const MEDIA_RUN_MAX_COLUMNS = 5;

/**
 * Số cột cho LƯỚI ẢNH TỰ ĐỘNG trong đề bài (chuỗi ≥2 khối `image` liền nhau —
 * xem `autoMediaRuns`). Tách khỏi {@link imageChoiceGridClass} thay vì dùng lại,
 * vì hai thứ này bó buộc khác nhau:
 *
 * - Ô image-choice là THẺ BẤM ĐƯỢC, phải đủ to cho vùng chạm và nhãn A/B/C bên
 *   dưới, nên trần 3 cột là hợp lý cho mọi số lượng.
 * - Ô của lưới media chỉ là ẢNH MINH HOẠ — không bấm, không nhãn — nên với
 *   chuỗi DÀI, hẹp cột lại là cách duy nhất giữ câu trong một màn.
 *
 * Công thức (Owner 3/8 — "lưới ảnh chỉ hiển thị TỐI ĐA 2 HÀNG"):
 *
 *   cột = min(5, max(2, ceil(n / 2)))
 *
 * `ceil(n/2)` là số cột nhỏ nhất đủ xếp n ảnh vào 2 hàng; `max(2, …)` giữ 2 ảnh
 * nằm cạnh nhau thay vì chồng dọc; `min(5, …)` là {@link MEDIA_RUN_MAX_COLUMNS}.
 * Bảng ra: 2–4 ảnh → 2 cột (4 ảnh vẫn là 2×2 cân đối như trước), 5–6 → 3 cột,
 * 7–8 → 4 cột, 9–10 → 5 cột.
 *
 * NGƯỠNG VƯỢT 2 HÀNG: **từ 11 ảnh trở lên**. `ceil(11/2) = 6` đụng trần 5, nên
 * 11–15 ảnh xếp 3 hàng, 16–20 ảnh 4 hàng… Đây là đánh đổi CÓ CHỦ Ý: giữ ảnh đủ
 * to thắng quy tắc 2 hàng, vì bên dưới 100px rộng thì lưới hết tác dụng. Không
 * ẩn ảnh, không "xem thêm", không cuộn ngang — chuỗi dài vẫn hiện đủ, chỉ cao
 * hơn. Trong kho hiện tại chuỗi dài nhất là 10 ảnh (`b7_q1`), nên ngưỡng này
 * chưa cắn vào ca thật nào.
 *
 * `MEDIA_GRID_MAX_HEIGHT` (224px) GIỮ NGUYÊN dù cột hẹp đi: số đo trên cho thấy
 * từ 4 cột trở lên chiều RỘNG ô mới là ràng buộc cắn (ảnh trung vị chỉ cao
 * 64–88px ở 5 cột, chạm đâu tới 224px). Trần cao chỉ còn canh ảnh CAO-HẸP (bản
 * nhạc, cột số liệu), và 2 hàng × 224px ≈ 520px vẫn lọt một màn — hạ nó xuống
 * chỉ làm ảnh dạng đó bé thêm mà không tiết kiệm được gì cho ảnh ngang.
 *
 * MOBILE: mọi bậc vẫn khởi từ `grid-cols-2` và chỉ nới ở `sm:`/`md:`. Cố ý
 * KHÔNG ép 2 hàng ở màn hẹp — 5 cột trên 390px là mỗi ảnh ~60px, vô dụng; mà
 * dưới 2 cột thì lưới không còn là lưới. Nói cách khác quy tắc 2 hàng là cam
 * kết cho màn `md` trở lên (≥768px), còn mobile nhận 2 cột và chấp nhận cuộn.
 */
export function mediaRunGridColumns(count: number): number {
  return Math.min(MEDIA_RUN_MAX_COLUMNS, Math.max(2, Math.ceil(count / 2)));
}

/** Static strings keep Tailwind's scanner aware of every supported column count. */
export function mediaRunGridClass(count: number): string {
  switch (mediaRunGridColumns(count)) {
    case 2:
      return 'grid gap-3 grid-cols-2';
    case 3:
      return 'grid gap-3 grid-cols-2 sm:grid-cols-3';
    case 4:
      return 'grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-4';
    default:
      return 'grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-5';
  }
}

/**
 * `data-display-layout` key khớp với {@link mediaRunGridClass}.
 *
 * `grid_5` KHÔNG thuộc {@link DISPLAY_LAYOUTS}: đó là hợp đồng schema cho
 * `display.layout` tác giả khai, còn đây chỉ là nhãn QA/test soi lưới tự động.
 * Nới schema chỉ để đặt tên cho một thuộc tính debug là đắt hơn giá trị.
 */
export function mediaRunGridKey(count: number): DisplayLayout | 'grid_5' {
  switch (mediaRunGridColumns(count)) {
    case 2:
      return 'grid_2';
    case 3:
      return 'grid_3';
    case 4:
      return 'grid_4';
    default:
      return 'grid_5';
  }
}

/** Trần cột của lưới VIDEO — xem {@link videoRunGridColumns}. */
const VIDEO_RUN_MAX_COLUMNS = 3;

/**
 * Bề ngang tối thiểu để thanh điều khiển gốc của video còn ĐỦ NÚT (play, đồng
 * hồ, loa, toàn màn hình, ⋮). Đo trên Chrome — bảng đầy đủ ở
 * {@link videoRunGridColumns}.
 */
export const VIDEO_CONTROLS_FULL_MIN_WIDTH = 290;

/**
 * Bề ngang mà dưới đó thanh điều khiển mất NÚT TOÀN MÀN HÌNH — mốc tệ nhất, vì
 * mất luôn đường xem to. Mọi bậc lưới video phải nằm trên mốc này.
 */
export const VIDEO_CONTROLS_FULLSCREEN_MIN_WIDTH = 170;

/**
 * Số cột cho chuỗi ≥2 VIDEO liền nhau, cùng cam kết "tối đa 2 hàng" như lưới ảnh
 * ({@link mediaRunGridColumns}) nhưng trần cột thấp hơn: 3 thay vì 5.
 *
 * Vì sao thấp hơn: video KHÔNG phải thumbnail. Nó mang thanh điều khiển gốc của
 * trình duyệt, và thanh đó RỤNG NÚT theo bề ngang. Đo thật (Chrome, video
 * 1920×1080 của `99688484/bai2`, dựng từng bề ngang rồi soi thanh điều khiển):
 *
 * | bề ngang | play | đồng hồ | loa | toàn màn hình | ⋮ |
 * |----------|------|---------|-----|---------------|---|
 * | 440–290px| ✓    | ✓       | ✓   | ✓             | ✓ |
 * | 260px    | ✓    | mất tổng thời lượng | ✓ | ✓ | ✓ |
 * | 230–200px| ✓    | **mất** | ✓   | ✓             | ✓ |
 * | 170px    | ✓    | mất     | ✓   | **mất**       | ✓ |
 *
 * Hai ngưỡng đáng giá: **290px** (thanh còn đủ) và **170px** (mất nút toàn màn
 * hình — hết đường xem to, tệ nhất). Khung đề bài trên desktop đo được ~1018px,
 * gap 12px → 3 cột = 331px/ô, còn nguyên thanh; 4 cột = 245px đã mất đồng hồ.
 * Nên trần đặt ở 3.
 *
 * Hệ quả: từ 7 video trở lên, trần cột thắng và lưới tràn sang hàng thứ 3. Đó là
 * đánh đổi CỐ Ý — cùng kiểu với trần 5 cột của ảnh — và ca thật hiếm (câu nhiều
 * video nhất trong kho hiện là 4). Nếu sau này có ca ≥7 video thì nới lên 4 cột
 * vẫn nằm trong vùng đo được (245px: mất đồng hồ, còn nút toàn màn hình).
 */
export function videoRunGridColumns(count: number): number {
  return Math.min(VIDEO_RUN_MAX_COLUMNS, Math.max(2, Math.ceil(count / 2)));
}

/**
 * Static strings keep Tailwind's scanner aware of every supported column count.
 *
 * MOBILE khởi từ 1 CỘT — CỐ Ý lệch sàn "mọi lưới khởi từ `grid-cols-2`" của
 * Tầng 4 trong `docs/PLAYER-LAYOUT-RULES.md`, và ngoại lệ này đã được ghi vào
 * chính doc đó (Owner duyệt 2026-08-09) sau khi đo trên máy thật ở 375px:
 *
 * - **1 cột** → mỗi video 292px: thanh điều khiển ĐỦ (play, đồng hồ, loa, toàn
 *   màn hình, ⋮). Giá phải trả: 4 video dài ~2,5 màn cuộn mới tới khu vẽ.
 * - **2 cột** → mỗi video 141px: nằm DƯỚI ngưỡng 170px nên mất cả đồng hồ lẫn
 *   **nút toàn màn hình**. Được: cả 4 video + thanh màu + khu vẽ gọn một màn.
 *
 * Chọn 1 cột vì mất nút toàn màn hình là mất hẳn đường xem to — với video dạy
 * viết chữ ở 141×79 thì học sinh không nhìn ra nét bút, tức hỏng đúng thứ mà
 * cái video sinh ra để làm. Sàn 2 cột của Tầng 4 viết cho ẢNH (ô nhỏ vẫn nhận
 * ra hình); video có ngưỡng dùng-được riêng, đo được, nên đi luật riêng.
 */
export function videoRunGridClass(count: number): string {
  return videoRunGridColumns(count) === 2
    ? 'grid gap-3 grid-cols-1 sm:grid-cols-2'
    : 'grid gap-3 grid-cols-1 sm:grid-cols-2 md:grid-cols-3';
}

/** `data-display-layout` key khớp với {@link videoRunGridClass}. */
export function videoRunGridKey(count: number): DisplayLayout {
  return videoRunGridColumns(count) === 2 ? 'grid_2' : 'grid_3';
}

/**
 * How many text columns a continuous passage / prose flow should split into for
 * the given generic layout. Unlike `layoutContainerClass` (which lays out a
 * *collection* of discrete items into a grid), this maps the same `columns`
 * hint onto CSS multi-column, so a single passage of text (e.g. a highlight
 * poem printed in two columns) flows across N columns. `list`, `inline` and
 * `auto` keep the single natural flow.
 */
export function passageColumnCount(layout: LayoutInput): 1 | 2 | 3 | 4 {
  switch (displayLayoutKey(layout, 'list')) {
    case 'grid_2':
      return 2;
    case 'grid_3':
      return 3;
    case 'grid_4':
      return 4;
    case 'inline':
    case 'list':
    default:
      return 1;
  }
}

/**
 * Static CSS multi-column classes for a passage of text. Empty string keeps the
 * single-column default. Responsive like `layoutContainerClass`: collapses to a
 * single column on narrow screens where side-by-side text would be unreadable.
 * `gap-x-*` maps to `column-gap`, the multi-column gutter. Static strings keep
 * Tailwind's scanner aware of every supported column count.
 */
export function passageColumnsClass(layout: LayoutInput): string {
  switch (passageColumnCount(layout)) {
    case 2:
      return 'sm:columns-2 sm:gap-x-8';
    case 3:
      return 'sm:columns-2 lg:columns-3 sm:gap-x-8';
    case 4:
      return 'sm:columns-2 lg:columns-4 sm:gap-x-8';
    default:
      return '';
  }
}

export function legacyMatchingInteractionType(layout: MatchingLegacyLayout): string | undefined {
  return matchingInteractionFromLayoutAlias(layout);
}
