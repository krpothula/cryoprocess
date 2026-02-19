import { suggestBoxSize } from './smartDefaults';

describe('suggestBoxSize', () => {
  it('calculates correct box size for typical ribosome (200 A, 1.4 A/px)', () => {
    // diameter_px = 200/1.4 ≈ 142.86, raw = ceil(1.5 * 142.86) = ceil(214.29) = 215, round to even = 216
    expect(suggestBoxSize(200, 1.4)).toBe(216);
  });

  it('calculates correct box size for small protein (80 A, 0.85 A/px)', () => {
    // diameter_px = 80/0.85 ≈ 94.12, raw = ceil(1.5 * 94.12) = ceil(141.18) = 142, already even = 142
    expect(suggestBoxSize(80, 0.85)).toBe(142);
  });

  it('rounds up to nearest even number when result is odd', () => {
    // diameter_px = 100/1.0 = 100, raw = ceil(150) = 150, already even
    expect(suggestBoxSize(100, 1.0)).toBe(150);
    // diameter_px = 50/1.0 = 50, raw = ceil(75) = 75, round to even = 76
    expect(suggestBoxSize(50, 1.0)).toBe(76);
  });

  it('returns even number in all cases', () => {
    const sizes = [
      suggestBoxSize(120, 1.2),
      suggestBoxSize(300, 0.5),
      suggestBoxSize(45, 1.06),
    ];
    sizes.forEach((size) => {
      expect(size % 2).toBe(0);
    });
  });

  it('returns null for zero diameter', () => {
    expect(suggestBoxSize(0, 1.4)).toBeNull();
  });

  it('returns null for zero pixel size', () => {
    expect(suggestBoxSize(200, 0)).toBeNull();
  });

  it('returns null for negative diameter', () => {
    expect(suggestBoxSize(-100, 1.4)).toBeNull();
  });

  it('returns null for negative pixel size', () => {
    expect(suggestBoxSize(200, -1.0)).toBeNull();
  });

  it('returns null when diameter is null/undefined', () => {
    expect(suggestBoxSize(null, 1.4)).toBeNull();
    expect(suggestBoxSize(undefined, 1.4)).toBeNull();
  });

  it('returns null when pixel size is null/undefined', () => {
    expect(suggestBoxSize(200, null)).toBeNull();
    expect(suggestBoxSize(200, undefined)).toBeNull();
  });
});
