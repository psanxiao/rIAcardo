/**
 * Centralized numeric formatting utilities.
 */

export function formatDuration(totalSeconds) {
  if (!totalSeconds || totalSeconds <= 0) return '0s';
  const hrs = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = Math.floor(totalSeconds % 60);
  if (hrs > 0) return `${hrs}h ${mins}m ${secs}s`;
  if (mins > 0) return `${mins}m ${secs}s`;
  return `${secs}s`;
}

export function formatDurationShort(totalSeconds) {
  if (!totalSeconds || totalSeconds <= 0) return '0:00';
  const hrs = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = Math.floor(totalSeconds % 60);
  if (hrs > 0) return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

export function formatDurationMinutes(totalMinutes) {
  if (!totalMinutes || totalMinutes <= 0) return '0m';
  const hrs = Math.floor(totalMinutes / 60);
  const mins = Math.floor(totalMinutes % 60);
  if (hrs > 0) return `${hrs}h ${mins}m`;
  return `${mins}m`;
}

export function formatDistance(meters) {
  if (!meters || meters <= 0) return '0';
  const km = meters / 1000;
  if (km >= 100) return km.toFixed(1);
  if (km >= 10) return km.toFixed(1);
  return km.toFixed(2);
}

export function formatDistanceKm(km) {
  if (!km || km <= 0) return '0';
  if (km >= 100) return km.toFixed(1);
  if (km >= 10) return km.toFixed(1);
  return km.toFixed(2);
}

export function formatSpeed(ms) {
  if (!ms || ms <= 0) return '0';
  const kmh = ms * 3.6;
  return kmh.toFixed(1);
}

export function formatSpeedKmh(kmh) {
  if (!kmh || kmh <= 0) return '0';
  return Number(kmh).toFixed(1);
}

export function formatPace(ms) {
  if (!ms || ms <= 0) return '--:--';
  const totalSeconds = 1000 / ms;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export function formatNumber(val, decimals = 0) {
  if (val === null || val === undefined || isNaN(val)) return '-';
  return Number(val).toFixed(decimals);
}

export function formatWatts(val) {
  if (!val || isNaN(val)) return '-';
  return Math.round(val);
}

export function formatBpm(val) {
  if (!val || isNaN(val)) return '-';
  return Math.round(val);
}

export function formatPercent(val) {
  if (!val || isNaN(val)) return '0';
  return Math.round(val);
}

export function formatIF(val) {
  if (!val || isNaN(val)) return '-';
  return Number(val).toFixed(2);
}
