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

const minettiCost = (grade) => {
  const g = Math.max(-0.45, Math.min(0.45, grade));
  return 155.4 * g ** 5 - 30.4 * g ** 4 - 43.3 * g ** 3 + 46.3 * g ** 2 + 19.5 * g + 3.6;
};

export const computeGapPace = (records) => {
  const pts = records.filter(r => r.distance != null && r.altitude != null && r.time != null);
  if (pts.length < 2) return null;

  const altitude = centeredMean(pts.map(r => r.altitude), 7);
  const times = pts.map(r => toSeconds(r.time));
  const k = 10;

  let equivalentMeters = 0;
  let movingSeconds = 0;

  for (let i = 0; i < pts.length - 1; i++) {
    const segMeters = pts[i + 1].distance - pts[i].distance;
    const dt = times[i + 1] - times[i];
    if (segMeters <= 0 || dt <= 0 || dt > 10) continue;

    const h = Math.max(0, i - k);
    const j = Math.min(pts.length - 1, i + k);
    const runMeters = pts[j].distance - pts[h].distance;
    const grade = runMeters >= 5 ? (altitude[j] - altitude[h]) / runMeters : 0;

    equivalentMeters += segMeters * (minettiCost(grade) / 3.6);
    movingSeconds += dt;
  }

  if (equivalentMeters <= 0 || movingSeconds <= 0) return null;
  return movingSeconds / (equivalentMeters / 1000);
};
