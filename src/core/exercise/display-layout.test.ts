import { describe, expect, it } from 'vitest';
import {
  DISPLAY_LAYOUTS,
  displayLayoutKey,
  displayLayoutScope,
  layoutContainerClass,
  legacyMatchingInteractionType,
  matchingLegacyLayout,
  normalizeDisplayLayout,
  readDisplayLayout,
  ARRANGEMENT_LAYOUTS,
  TYPE_SCOPED_LAYOUTS,
} from './display-layout';

describe('display layout contract', () => {
  it('matches the schema layout vocabulary and scopes', () => {
    // Năm layout XẾP + layout giới hạn theo type (§10.1). Thứ tự là thứ tự hiển thị
    // trong ô chọn bố cục, nên `dots` đứng cuối.
    expect(DISPLAY_LAYOUTS).toEqual(['list', 'grid_2', 'grid_3', 'grid_4', 'inline', 'dots']);
    expect(ARRANGEMENT_LAYOUTS).toEqual(['list', 'grid_2', 'grid_3', 'grid_4', 'inline']);
    expect(TYPE_SCOPED_LAYOUTS).toEqual(['dots']);
    expect(displayLayoutScope('single_choice')).toBe('options');
    expect(displayLayoutScope('multiple_choice')).toBe('options');
    expect(displayLayoutScope('true_false')).toBe('options');
    expect(displayLayoutScope('ordering')).toBe('items');
    expect(displayLayoutScope('classification')).toBe('items');
    expect(displayLayoutScope('question_group')).toBe('children');
    expect(displayLayoutScope('connect_points')).toBe('points');
    expect(displayLayoutScope('drag_drop')).toBeNull();
    expect(displayLayoutScope('matching')).toBeNull();
  });

  it('reads only display.layout and maps legacy matching separately', () => {
    expect(readDisplayLayout({ display: { layout: 'grid_4' } })).toBe('grid_4');
    expect(readDisplayLayout({ layout: 'row' })).toBeUndefined();
    expect(matchingLegacyLayout({ layout: 'scene' })).toBe('scene');
    expect(legacyMatchingInteractionType('radial')).toBe('radial');
    expect(legacyMatchingInteractionType('row')).toBe('rows');
    expect(legacyMatchingInteractionType('scene')).toBe('scene');
  });

  it('keeps every layout class statically discoverable', () => {
    expect(layoutContainerClass('list')).toContain('flex-col');
    expect(layoutContainerClass('grid_2')).toContain('sm:grid-cols-2');
    expect(layoutContainerClass('grid_3')).toContain('lg:grid-cols-3');
    expect(layoutContainerClass('grid_4')).toContain('lg:grid-cols-4');
    expect(layoutContainerClass('inline')).toContain('flex-wrap');
  });

  it.each([
    ['list', { mode: 'list', flow: 'column', columns: 1, order: 'column-major' }],
    ['inline', { mode: 'inline', flow: 'row', columns: 'auto', order: 'row-major' }],
    ['grid_2', { mode: 'grid', flow: 'row', columns: 2, order: 'row-major' }],
    ['grid_3', { mode: 'grid', flow: 'row', columns: 3, order: 'row-major' }],
    ['grid_4', { mode: 'grid', flow: 'row', columns: 4, order: 'row-major' }],
    // `dots` giữ nguyên `key` khi chuẩn hoá — nhánh `default` cũ ghi đè về 'list',
    // tức là giá trị trông như được nhận nhưng player vẫn vẽ y hệt cũ.
    ['dots', { mode: 'inline', flow: 'row', columns: 'auto', order: 'row-major' }],
  ] as const)('normalizes and round-trips %s without changing its meaning', (layout, descriptor) => {
    const resolved = normalizeDisplayLayout(layout);
    expect(resolved).toEqual({ key: layout, ...descriptor });
    expect(displayLayoutKey(resolved)).toBe(layout);
    expect(layoutContainerClass(resolved)).toBe(layoutContainerClass(layout));
  });
});
