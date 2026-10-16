import { describe, expect, it } from 'vitest';
import { activeNavTo } from './activeNav';

const adminItems = [
  { to: '/admin/content' },
  { to: '/admin/competency' },
  { to: '/admin/taxonomy' },
  { to: '/admin/question-bank' },
  { to: '/admin/school' },
  { to: '/admin/organization' },
];

// Mục chỉ mục "/teacher" là tiền tố của mọi mục còn lại — bẫy của startsWith thuần.
const teacherItems = [{ to: '/teacher' }, { to: '/teacher/classes' }, { to: '/teacher/bank' }];

describe('activeNavTo', () => {
  it('sáng mục cha khi đang ở trang chi tiết', () => {
    expect(activeNavTo('/admin/question-bank/3f6027c2-0189', adminItems)).toBe('/admin/question-bank');
    expect(activeNavTo('/admin/competency/sets/abc', adminItems)).toBe('/admin/competency');
    expect(activeNavTo('/admin/taxonomy/xyz', adminItems)).toBe('/admin/taxonomy');
    expect(activeNavTo('/admin/school/classes/9', adminItems)).toBe('/admin/school');
  });

  it('giữ nguyên hành vi cũ ở chính trang danh sách', () => {
    expect(activeNavTo('/admin/content', adminItems)).toBe('/admin/content');
  });

  it('mục chỉ mục không nuốt các mục con', () => {
    expect(activeNavTo('/teacher', teacherItems)).toBe('/teacher');
    expect(activeNavTo('/teacher/classes', teacherItems)).toBe('/teacher/classes');
    expect(activeNavTo('/teacher/classes/12/students', teacherItems)).toBe('/teacher/classes');
  });

  it('khớp theo ranh giới "/" chứ không theo ký tự', () => {
    expect(activeNavTo('/admin/schooling', adminItems)).toBeNull();
  });

  it('bỏ qua dấu "/" thừa cuối đường dẫn', () => {
    expect(activeNavTo('/admin/question-bank/', adminItems)).toBe('/admin/question-bank');
  });

  it('trả null khi không mục nào phủ đường dẫn', () => {
    expect(activeNavTo('/admin/login', adminItems)).toBeNull();
  });
});
