import { describe, it, expect } from 'vitest';
import { movingAverage, computeGapPace, computeBestEfforts, computeKmSplits } from './running';

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

describe('computeKmSplits', () => {
  it('excludes activity pauses and stationary periods from per-km pace and HR', () => {
    const start = Date.UTC(2026, 0, 1, 10, 0, 0);
    const records = [];
    let t = start;
    let d = 0;

    // Km 1: steady 5:00/km (3.3333 m/s), 300s
    for (let s = 0; s <= 300; s++) {
      records.push({
        time: new Date(t).toISOString().replace('T', ' ').slice(0, 19),
        distance: d,
        hr: 150,
        speed: 12.0,
      });
      if (s < 300) {
        t += 1000;
        d += 1000 / 300;
      }
    }

    // Km 2 first 500m at 4:00/km (4.1667 m/s), 120s
    for (let s = 1; s <= 120; s++) {
      t += 1000;
      d += 500 / 120;
      records.push({
        time: new Date(t).toISOString().replace('T', ' ').slice(0, 19),
        distance: d,
        hr: 165,
        speed: 15.0,
      });
    }

    // Slow down to stop (3 seconds at 1.5 km/h) + 3-minute pause (180s gap) + 5 stationary seconds
    for (let s = 1; s <= 3; s++) {
      t += 1000;
      d += 0.3;
      records.push({
        time: new Date(t).toISOString().replace('T', ' ').slice(0, 19),
        distance: d,
        hr: 110,
        speed: 1.5,
      });
    }
    t += 180 * 1000; // 3-minute watch pause
    for (let s = 1; s <= 5; s++) {
      t += 1000;
      records.push({
        time: new Date(t).toISOString().replace('T', ' ').slice(0, 19),
        distance: d,
        hr: 100,
        speed: 0,
      });
    }

    // Km 2 remaining ~500m at 4:00/km (4.1667 m/s), 120s
    for (let s = 1; s <= 120; s++) {
      t += 1000;
      d += 500 / 120;
      records.push({
        time: new Date(t).toISOString().replace('T', ' ').slice(0, 19),
        distance: d,
        hr: 165,
        speed: 15.0,
      });
    }

    const splits = computeKmSplits(records);
    expect(splits).toHaveLength(2);
    expect(splits[0].paceSec).toBeCloseTo(300, 0);
    expect(splits[0].hr).toBeCloseTo(150, 0);
    expect(splits[1].paceSec).toBeCloseTo(240, 0);
    expect(splits[1].hr).toBeCloseTo(165, 0);
  });
});
