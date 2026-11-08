export const movingAverage = (values, windowSize) => {
  const half = Math.floor(windowSize / 2);
  return values.map((v, i) => {
    if (!(v > 0)) return null;
    const slice = values.slice(Math.max(0, i - half), i + half + 1).filter(x => x > 0);
    return slice.reduce((a, b) => a + b, 0) / slice.length;
  });
};

const centeredMean = (values, half) => values.map((_, i) => {
  const slice = values.slice(Math.max(0, i - half), i + half + 1);
  return slice.reduce((a, b) => a + b, 0) / slice.length;
});

const toSeconds = (t) => new Date(String(t).replace(' ', 'T')).getTime() / 1000;

export const computeBestEfforts = (records) => {
  const pts = records
    .filter(r => r.distance != null && r.time != null)
    .map(r => ({ d: r.distance, t: toSeconds(r.time) }));
  if (pts.length < 2) return {};

  const bestDistance = (meters) => {
    let best = null;
    let j = 0;
    for (let i = 0; i < pts.length; i++) {
      if (j < i) j = i;
      while (j < pts.length && pts[j].d - pts[i].d < meters) j++;
      if (j >= pts.length) break;
      const sec = pts[j].t - pts[i].t;
      const dist = pts[j].d - pts[i].d;
      if (sec > 0 && dist > 0) {
        const pace = sec / (dist / 1000);
        if (best === null || pace < best) best = pace;
      }
    }
    return best;
  };

  const bestTime = (seconds) => {
    let best = null;
    let j = 0;
    for (let i = 0; i < pts.length; i++) {
      if (j < i) j = i;
      while (j < pts.length && pts[j].t - pts[i].t < seconds) j++;
      if (j >= pts.length) break;
      const sec = pts[j].t - pts[i].t;
      const dist = pts[j].d - pts[i].d;
      if (sec > 0 && dist > 0) {
        const pace = sec / (dist / 1000);
        if (best === null || pace < best) best = pace;
      }
    }
    return best;
  };

  return {
    '1km': bestDistance(1000),
    '5km': bestDistance(5000),
    '10km': bestDistance(10000),
    '20min': bestTime(1200),
  };
};

const haversineMeters = (lat1, lon1, lat2, lon2) => {
  const R = 6371000;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const p1 = toRad(lat1);
  const p2 = toRad(lat2);
  const dp = toRad(lat2 - lat1);
  const dl = toRad(lon2 - lon1);
  const a = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
};

// Empirical Grade Adjusted Pace (GAP) effort factor:
// Uphills penalize speed strongly; downhills only give a moderate speed benefit
// up to ~-7% before eccentric braking costs increase again.
const gapEffortFactor = (grade) => {
  const g = Math.max(-0.35, Math.min(0.35, grade));
  if (g >= 0) {
    return 1.0 + 3.3 * g + 15.0 * g * g;
  }
  return 1.0 + 1.6 * g + 11.5 * g * g;
};

export const computeGapPace = (records, basePaceSec = null) => {
  const pts = records.filter(r => r.distance != null && r.altitude != null && r.time != null);
  if (pts.length < 2) return null;

  let rawAlt = pts.map(r => Number(r.altitude));
  const totalDist = pts[pts.length - 1].distance - pts[0].distance;

  // Correct barometric altimeter drift on closed-loop / out-and-back runs
  const gpsPts = pts.filter(r => r.lat != null && r.lng != null);
  if (gpsPts.length >= 2 && totalDist > 500) {
    const startEndDist = haversineMeters(
      gpsPts[0].lat,
      gpsPts[0].lng,
      gpsPts[gpsPts.length - 1].lat,
      gpsPts[gpsPts.length - 1].lng,
    );
    if (startEndDist < 250) {
      const drift = rawAlt[rawAlt.length - 1] - rawAlt[0];
      const d0 = pts[0].distance;
      rawAlt = rawAlt.map((a, idx) => a - drift * ((pts[idx].distance - d0) / totalDist));
    }
  }

  const altitude = centeredMean(rawAlt, 12);
  const times = pts.map(r => toSeconds(r.time));
  const k = 10;

  let equivalentMeters = 0;
  let totalMeters = 0;
  let movingSeconds = 0;

  for (let i = 0; i < pts.length - 1; i++) {
    const segMeters = pts[i + 1].distance - pts[i].distance;
    const dt = times[i + 1] - times[i];
    if (segMeters <= 0 || dt <= 0 || dt > 10) continue;

    const h = Math.max(0, i - k);
    const j = Math.min(pts.length - 1, i + k);
    const runMeters = pts[j].distance - pts[h].distance;
    const grade = runMeters >= 5 ? (altitude[j] - altitude[h]) / runMeters : 0;

    equivalentMeters += segMeters * gapEffortFactor(grade);
    totalMeters += segMeters;
    movingSeconds += dt;
  }

  if (equivalentMeters <= 0 || totalMeters <= 0 || movingSeconds <= 0) return null;
  const effortRatio = equivalentMeters / totalMeters;
  const refPaceSec = basePaceSec && basePaceSec > 0
    ? basePaceSec
    : movingSeconds / (totalMeters / 1000);
  return refPaceSec / effortRatio;
};
