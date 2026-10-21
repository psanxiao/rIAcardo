import { describe, it, expect } from 'vitest';
import { movingAverage, computeGapPace, computeBestEfforts } from './running';

const buildRecords = (slopePerMeter) => {
  const start = Date.UTC(2026, 0, 1, 10, 0, 0);
  return Array.from({ length: 4001 }, (_, i) => ({
    time: new Date(start + i * 1000).toISOString().replace('T', ' ').slice(0, 19),
    distance: i * 3,
    altitude: 100 + i * 3 * slopePerMeter,
  }));
};

describe('movingAverage', () => {
  it('ignores zeros and keeps gaps', () => {
    const result = movingAverage([0, 2, 4, 0], 3);
    expect(result[0]).toBeNull();
    expect(result[1]).toBeCloseTo(3);
    expect(result[3]).toBeNull();
  });
});

describe('computeBestEfforts', () => {
  it('returns the constant pace for a steady run', () => {
    const best = computeBestEfforts(buildRecords(0));
    expect(best['1km']).toBeCloseTo(1000 / 3, 0);
    expect(best['5km']).toBeCloseTo(1000 / 3, 0);
    expect(best['10km']).toBeCloseTo(1000 / 3, 0);
    expect(best['20min']).toBeCloseTo(1000 / 3, 0);
  });

  it('omits distances the activity does not cover', () => {
    const best = computeBestEfforts(buildRecords(0));
    expect(best['10km']).toBeCloseTo(1000 / 3, 0);
    const short = computeBestEfforts(buildRecords(0).slice(0, 100));
    expect(short['5km']).toBeNull();
    expect(short['20min']).toBeNull();
  });
});

describe('computeGapPace', () => {
  it('equals actual pace on flat ground', () => {
    const pace = computeGapPace(buildRecords(0));
    expect(pace).toBeCloseTo(1000 / 3, 0);
  });

  it('is faster than actual pace on an uphill', () => {
    const pace = computeGapPace(buildRecords(0.05));
    expect(pace).toBeLessThan(1000 / 3);
  });

  it('returns null without altitude data', () => {
    expect(computeGapPace([{ time: '2026-01-01 10:00:00', distance: 0, altitude: null }])).toBeNull();
  });
});
