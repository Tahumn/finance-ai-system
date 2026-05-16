import { describe, it, expect, vi } from 'vitest';
import { percent, parseNumberInput } from './format.js';

// Mock userPrefs to avoid dependency issues in tests
vi.mock('./userPrefs.js', () => ({
  getUserPrefs: () => ({ language: 'vi', currency: 'VND' }),
  getLocaleForLanguage: () => 'vi-VN'
}));

describe('format utils', () => {
  it('should format percentage correctly', () => {
    expect(percent(0.1)).toBe('10%');
    expect(percent(0.555)).toBe('56%');
    expect(percent(1)).toBe('100%');
  });

  it('should parse number input correctly', () => {
    expect(parseNumberInput('1.000.000')).toBe(1000000);
    expect(parseNumberInput('-50.000')).toBe(-50000);
    expect(parseNumberInput('abc 123')).toBe(123);
    expect(parseNumberInput('')).toBe(0);
  });
});
