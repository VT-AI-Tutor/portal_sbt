import { describe, expect, it } from 'vitest';
import { lastGrapheme, normalizeText } from './single-character';

describe('lastGrapheme', () => {
  it('returns empty for empty input', () => {
    expect(lastGrapheme('')).toBe('');
  });

  it('keeps a plain ASCII letter', () => {
    expect(lastGrapheme('a')).toBe('a');
  });

  it('keeps the whole letter of a precomposed Vietnamese character', () => {
    expect(lastGrapheme('Á')).toBe('Á');
    expect(lastGrapheme('Ắ')).toBe('Ắ');
    expect(lastGrapheme('Đ')).toBe('Đ');
  });

  it('keeps the letter, not the accent, for decomposed (NFD) input', () => {
    const nfd = 'Ắ'.normalize('NFD'); // Ă + U+0301
    expect(nfd.length).toBeGreaterThan(1);
    expect(lastGrapheme(nfd)).toBe('Ắ');
    // The old `slice(-1)` kept the bare combining mark — the regression.
    expect(lastGrapheme(nfd)).not.toBe(nfd.slice(-1));
  });

  it('takes the last character of a multi-character value', () => {
    expect(lastGrapheme('AB')).toBe('B');
    expect(lastGrapheme('CÚ')).toBe('Ú');
  });

  it('normalizes its result to NFC', () => {
    expect(lastGrapheme('Ế'.normalize('NFD'))).toBe('Ế'.normalize('NFC'));
  });
});

describe('normalizeText', () => {
  it('upper-cases and trims', () => {
    expect(normalizeText('  cúc ')).toBe('CÚC');
  });

  it('compares a decomposed answer equal to a composed one', () => {
    expect(normalizeText('Ắ'.normalize('NFD'))).toBe(normalizeText('Ắ'.normalize('NFC')));
    expect(normalizeText('ngải cứu'.normalize('NFD'))).toBe(normalizeText('NGẢI CỨU'));
  });
});
