import { describe, it, expect } from 'vitest';
import {
  formatDuration,
  formatDurationShort,
  formatDurationMinutes,
  formatDistance,
  formatDistanceKm,
  formatSpeed,
  formatSpeedKmh,
  formatPace,
  formatNumber,
  formatWatts,
  formatBpm,
  formatPercent,
  formatIF,
} from './format';

describe('formatDuration', () => {
  it('formats hours, minutes and seconds', () => {
    expect(formatDuration(3661)).toBe('1h 1m 1s');
    expect(formatDuration(125)).toBe('2m 5s');
    expect(formatDuration(42)).toBe('42s');
  });

  it('handles missing or non-positive values', () => {
    expect(formatDuration(0)).toBe('0s');
    expect(formatDuration(null)).toBe('0s');
    expect(formatDuration(-10)).toBe('0s');
  });
});

describe('formatDurationShort', () => {
  it('formats m:ss and h:mm:ss', () => {
    expect(formatDurationShort(125)).toBe('2:05');
    expect(formatDurationShort(3661)).toBe('1:01:01');
    expect(formatDurationShort(0)).toBe('0:00');
    expect(formatDurationShort(null)).toBe('0:00');
  });
});

describe('formatDurationMinutes', () => {
  it('formats hours and minutes from minutes', () => {
    expect(formatDurationMinutes(90)).toBe('1h 30m');
    expect(formatDurationMinutes(45)).toBe('45m');
    expect(formatDurationMinutes(0)).toBe('0m');
  });
});

describe('formatDistance', () => {
  it('formats meters as km', () => {
    expect(formatDistance(750)).toBe('0.75');
    expect(formatDistance(12345)).toBe('12.3');
    expect(formatDistance(120000)).toBe('120.0');
    expect(formatDistance(0)).toBe('0');
  });
});

describe('formatDistanceKm', () => {
  it('formats km values', () => {
    expect(formatDistanceKm(0.75)).toBe('0.75');
    expect(formatDistanceKm(12.345)).toBe('12.3');
    expect(formatDistanceKm(120)).toBe('120.0');
    expect(formatDistanceKm(0)).toBe('0');
  });
});

describe('formatSpeed', () => {
  it('converts m/s to km/h with one decimal', () => {
    expect(formatSpeed(5)).toBe('18.0');
    expect(formatSpeed(10)).toBe('36.0');
    expect(formatSpeed(0)).toBe('0');
  });
});

describe('formatSpeedKmh', () => {
  it('formats km/h values', () => {
    expect(formatSpeedKmh(18)).toBe('18.0');
    expect(formatSpeedKmh(36.25)).toBe('36.3');
    expect(formatSpeedKmh(0)).toBe('0');
  });
});

describe('formatPace', () => {
  it('formats m/s as min/km pace', () => {
    expect(formatPace(1000 / 300)).toBe('5:00');
    expect(formatPace(1000 / 270)).toBe('4:30');
    expect(formatPace(0)).toBe('--:--');
    expect(formatPace(null)).toBe('--:--');
  });
});

describe('formatNumber', () => {
  it('formats numbers with a fixed number of decimals', () => {
    expect(formatNumber(3.14159)).toBe('3');
    expect(formatNumber(3.14159, 2)).toBe('3.14');
    expect(formatNumber(null)).toBe('-');
    expect(formatNumber(undefined)).toBe('-');
    expect(formatNumber('abc')).toBe('-');
  });
});

describe('formatWatts / formatBpm / formatPercent', () => {
  it('rounds values and falls back to "-" (or "0") when invalid', () => {
    expect(formatWatts(250.6)).toBe(251);
    expect(formatWatts(null)).toBe('-');
    expect(formatBpm(160.4)).toBe(160);
    expect(formatBpm(null)).toBe('-');
    expect(formatPercent(55.5)).toBe(56);
    expect(formatPercent(null)).toBe('0');
  });
});

describe('formatIF', () => {
  it('formats intensity factor with two decimals', () => {
    expect(formatIF(0.85)).toBe('0.85');
    expect(formatIF(1.006)).toBe('1.01');
    expect(formatIF(null)).toBe('-');
  });
});