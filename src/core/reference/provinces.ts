/**
 * 34 đơn vị hành chính cấp tỉnh của Việt Nam theo sắp xếp có hiệu lực từ
 * 01/7/2025: 6 thành phố trực thuộc trung ương và 28 tỉnh.
 *
 * Vì sao là hằng số chứ không gọi API: hệ LCMS có `lcmsListProvinces()`, nhưng
 * hệ legacy (evo-books-api) KHÔNG có danh mục tỉnh, mà hồ sơ học sinh ở khu
 * /student chạy trên hệ legacy. Danh sách này đổi vài năm một lần chứ không phải
 * dữ liệu sống, nên giữ tại chỗ và sửa tay khi Nhà nước sắp xếp lại.
 *
 * Thứ tự: thành phố trực thuộc trung ương trước (người dùng đông nhất nằm ở đây),
 * rồi tới các tỉnh theo A→Z tiếng Việt.
 */

/** 6 thành phố trực thuộc trung ương. */
export const CENTRAL_CITIES = [
  "Hà Nội",
  "Thành phố Hồ Chí Minh",
  "Hải Phòng",
  "Đà Nẵng",
  "Cần Thơ",
  "Huế",
] as const;

/** 28 tỉnh, đã theo tên sau sắp xếp 2025. */
export const PROVINCES_ONLY = [
  "An Giang",
  "Bắc Ninh",
  "Cà Mau",
  "Cao Bằng",
  "Đắk Lắk",
  "Điện Biên",
  "Đồng Nai",
  "Đồng Tháp",
  "Gia Lai",
  "Hà Tĩnh",
  "Hưng Yên",
  "Khánh Hoà",
  "Lai Châu",
  "Lâm Đồng",
  "Lạng Sơn",
  "Lào Cai",
  "Nghệ An",
  "Ninh Bình",
  "Phú Thọ",
  "Quảng Ngãi",
  "Quảng Ninh",
  "Quảng Trị",
  "Sơn La",
  "Tây Ninh",
  "Thái Nguyên",
  "Thanh Hoá",
  "Tuyên Quang",
  "Vĩnh Long",
] as const;

/** Cả 34 đơn vị, dùng để đổ dropdown "Tỉnh/Thành phố". */
export const PROVINCES: readonly string[] = [
  ...CENTRAL_CITIES,
  ...PROVINCES_ONLY,
];

/** Tên này còn nằm trong danh mục hiện hành không? */
export function isKnownProvince(name: string): boolean {
  return PROVINCES.includes(name.trim());
}
