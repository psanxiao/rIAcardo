import { SectionCard, StatTile } from '../ui';

const BEST_EFFORTS = [
  ['1km', '1 km'],
  ['5km', '5 km'],
  ['10km', '10 km'],
  ['20min', '20 min'],
];

const driftVerdict = (pct) => {
  if (pct < 5) return { text: 'Aeróbico sólido', color: 'text-green-600 dark:text-green-400' };
  if (pct < 10) return { text: 'Deriva moderada', color: 'text-amber-600 dark:text-amber-400' };
  return { text: 'Deriva alta', color: 'text-red-600 dark:text-red-400' };
};

const formatPaceSec = (sec) => {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
};

const RunningInsights = ({ cardiacDriftPct, bestEfforts, gapPace, avgPaceSec }) => {
  const hasDrift = cardiacDriftPct !== null && cardiacDriftPct !== undefined;
  const bestRows = BEST_EFFORTS.filter(([key]) => bestEfforts?.[key] > 0);

  if (!hasDrift && !gapPace && bestRows.length === 0) return null;

  const verdict = hasDrift ? driftVerdict(cardiacDriftPct) : null;
  const markerPos = hasDrift ? Math.min(100, Math.max(0, (cardiacDriftPct / 15) * 100)) : 0;
  const gapDelta = gapPace && avgPaceSec ? avgPaceSec - gapPace : null;

  return (
    <SectionCard title="Análisis de running">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-gray-100 dark:bg-gray-700">
        {hasDrift && (
          <div className="bg-white dark:bg-gray-800 p-5">
            <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-tighter">Desacoplamiento FC</p>
            <div className="flex items-baseline gap-3 mt-1">
              <p className="text-3xl font-black text-gray-900 dark:text-white">{cardiacDriftPct.toFixed(1)} %</p>
              <p className={`text-sm font-semibold ${verdict.color}`}>{verdict.text}</p>
            </div>
            <div className="relative h-2 mt-4 rounded-full bg-gradient-to-r from-green-400 via-amber-400 to-red-500">
              <div
                className="absolute -top-1 h-4 w-1 rounded bg-gray-900 dark:bg-white"
                style={{ left: `calc(${markerPos}% - 2px)` }}
              />
            </div>
            <div className="flex justify-between text-[10px] text-gray-400 mt-1">
              <span>0 %</span>
              <span>5 %</span>
              <span>10 %</span>
              <span>15 %+</span>
            </div>
            <p className="text-xs text-gray-400 mt-3">
              Variación del ritmo por latido entre la primera y la segunda mitad.
            </p>
          </div>
        )}

        {gapPace && (
          <div className="bg-white dark:bg-gray-800 p-5">
            <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-tighter">Ritmo ajustado (GAP)</p>
            <div className="flex items-baseline gap-2 mt-1">
              <p className="text-3xl font-black text-gray-900 dark:text-white">{formatPaceSec(gapPace)}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">/km</p>
            </div>
            {gapDelta !== null && (
              <p className="text-sm text-gray-600 dark:text-gray-300 mt-3">
                {Math.abs(gapDelta) < 3
                  ? 'Similar al ritmo real: terreno prácticamente llano.'
                  : gapDelta > 0
                    ? `${Math.round(gapDelta)} s/km más rápido que tu ritmo real por el desnivel.`
                    : `${Math.round(-gapDelta)} s/km más lento que tu ritmo real por el desnivel.`}
              </p>
            )}
            <p className="text-xs text-gray-400 mt-3">Ritmo equivalente en llano según el coste energético de la pendiente.</p>
          </div>
        )}
      </div>

      {bestRows.length > 0 && (
        <div className="p-5 border-t border-gray-100 dark:border-gray-700">
          <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-tighter mb-3">Mejores intervalos</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {bestRows.map(([key, label]) => (
              <StatTile key={key} label={`Mejor ${label}`} value={`${formatPaceSec(bestEfforts[key])} /km`} />
            ))}
          </div>
        </div>
      )}
    </SectionCard>
  );
};

export default RunningInsights;
