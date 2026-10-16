/**
 * Ngữ pháp id của tay cầm kéo — cả HAI thành phần:
 *
 * - `scope` (`subQuestions[1]::f1`) — câu con NÀO sở hữu field (#1113);
 * - `occurrence` (`f1#3`) — ENTRY NÀO của mảng, khi một mảng mang hai entry
 *   trùng id (hai ô `hotspots[]` phủ hai đoạn của cùng một con đường, cùng
 *   chấm về một đáp án).
 *
 * Cả hai bộ parse đều phải BẢO THỦ: một id tình cờ chứa `::` hay kết thúc bằng
 * `#<số>` không được băm nhỏ. Đó là lý do việc giải id ở
 * `apply-field-geometry.ts` thử id NGUYÊN VĂN trước, rồi mới tới occurrence.
 */
import { describe, expect, it } from 'vitest';
import {
  extendFieldScope,
  nestedFieldScopeSegment,
  parseFieldOccurrence,
  parseScopedFieldId,
  scopeFieldId,
  withFieldOccurrence,
} from './field-scope';

describe('occurrence — entry thứ mấy của mảng', () => {
  it('gắn chỉ số mảng vào id', () => {
    expect(withFieldOccurrence('f1', 0)).toBe('f1#0');
    expect(withFieldOccurrence('f1', 3)).toBe('f1#3');
  });

  it('tách lại đúng id gốc và chỉ số', () => {
    expect(parseFieldOccurrence('f1#3')).toEqual({ fieldId: 'f1', occurrence: 3 });
    expect(parseFieldOccurrence('hs_10#12')).toEqual({ fieldId: 'hs_10', occurrence: 12 });
  });

  it('id trơn giữ nguyên, không sinh occurrence', () => {
    expect(parseFieldOccurrence('f1')).toEqual({ fieldId: 'f1', occurrence: null });
    expect(parseFieldOccurrence('row_1__answer')).toEqual({
      fieldId: 'row_1__answer',
      occurrence: null,
    });
  });

  it('id chứa `#` nhưng không kết thúc bằng `#<số>` thì không bị băm', () => {
    expect(parseFieldOccurrence('a#b')).toEqual({ fieldId: 'a#b', occurrence: null });
    expect(parseFieldOccurrence('#3')).toEqual({ fieldId: '#3', occurrence: null });
    expect(parseFieldOccurrence('f1#')).toEqual({ fieldId: 'f1#', occurrence: null });
  });

  it('id vốn đã chứa `#<số>` vẫn tách được lớp ngoài cùng', () => {
    // Lớp trong (`f#1`) là id gốc; việc chọn id NGUYÊN VĂN trước ở tầng giải
    // mã mới là chỗ bảo vệ dữ liệu kiểu này.
    expect(parseFieldOccurrence('f#1#2')).toEqual({ fieldId: 'f#1', occurrence: 2 });
  });
});

describe('occurrence đi cùng scope', () => {
  it('hai thành phần lồng nhau: scope bọc ngoài, occurrence nằm trong id', () => {
    const scope = extendFieldScope('', nestedFieldScopeSegment('subQuestions', 1));
    const reported = scopeFieldId(scope, withFieldOccurrence('f1', 2));
    expect(reported).toBe('subQuestions[1]::f1#2');

    const parsed = parseScopedFieldId(reported);
    expect(parsed.path).toEqual([{ key: 'subQuestions', index: 1 }]);
    expect(parsed.fieldId).toBe('f1#2');
    expect(parseFieldOccurrence(parsed.fieldId)).toEqual({ fieldId: 'f1', occurrence: 2 });
  });
});
