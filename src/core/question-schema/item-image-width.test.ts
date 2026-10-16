import { describe, it, expect } from 'vitest';
import { itemImageWidth } from './item-image-width';

describe('itemImageWidth', () => {
  it('nhận độ dài tuyệt đối, giữ nguyên chuỗi đã cắt khoảng trắng', () => {
    expect(itemImageWidth('44px')).toBe('44px');
    expect(itemImageWidth('  150px ')).toBe('150px');
    expect(itemImageWidth('2.5rem')).toBe('2.5rem');
    expect(itemImageWidth('3em')).toBe('3em');
    expect(itemImageWidth('12pt')).toBe('12pt');
  });

  it('BỎ % — quy chiếu theo ô chứa (rất hẹp) và chưa từng được kiểm bằng mắt', () => {
    // Giá trị thật trong kho sách đã kiểm: 7% là nhỏ nhất, 59 câu ≤ 25%.
    for (const w of ['7%', '20%', '70%', '100%']) {
      expect(itemImageWidth(w)).toBeUndefined();
    }
  });

  it('BỎ số trần — không phải độ dài CSS hợp lệ', () => {
    // Kho sách có 24 khối dạng này ("160", "35", "45"…).
    expect(itemImageWidth('160')).toBeUndefined();
    expect(itemImageWidth('35')).toBeUndefined();
  });

  it('BỎ giá trị rỗng, sai kiểu, hoặc đơn vị lạ', () => {
    expect(itemImageWidth(undefined)).toBeUndefined();
    expect(itemImageWidth(null)).toBeUndefined();
    expect(itemImageWidth('')).toBeUndefined();
    expect(itemImageWidth('   ')).toBeUndefined();
    expect(itemImageWidth(44)).toBeUndefined();
    expect(itemImageWidth('44vw')).toBeUndefined();
    expect(itemImageWidth('calc(100% - 10px)')).toBeUndefined();
    expect(itemImageWidth('auto')).toBeUndefined();
    expect(itemImageWidth('-20px')).toBeUndefined();
  });
});
