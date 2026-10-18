import {
  Chart as ChartJS,
  ArcElement,
  DoughnutController,
  Tooltip,
  Legend,
} from 'chart.js';
import { Doughnut } from 'react-chartjs-2';
import { formatDistanceKm } from '../../utils/format';

ChartJS.register(ArcElement, DoughnutController, Tooltip, Legend);

const SPORT_META = {
  cycling: { label: 'Ciclismo', color: 'rgba(59, 130, 246, 0.85)' },
  running: { label: 'Running', color: 'rgba(34, 197, 94, 0.85)' },
  other: { label: 'Otro', color: 'rgba(156, 163, 175, 0.85)' },
};

const SportBreakdown = ({ breakdown = {} }) => {
  const keys = Object.keys(breakdown);
  if (!keys.length) {
    return <p className="p-8 text-center text-sm text-gray-400">No hay actividades esta semana.</p>;
  }

  const data = {
    labels: keys.map((k) => SPORT_META[k]?.label || k),
    datasets: [
      {
        data: keys.map((k) => breakdown[k].tss),
        backgroundColor: keys.map((k) => SPORT_META[k]?.color || 'rgba(156, 163, 175, 0.85)'),
        borderWidth: 0,
        hoverOffset: 4,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '65%',
    plugins: {
      legend: { position: 'right', labels: { boxWidth: 10, font: { size: 10 } } },
      tooltip: { callbacks: { label: (c) => ` ${c.label}: ${Math.round(c.raw)} TSS` } },
    },
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
      <div className="h-[220px]">
        <Doughnut data={data} options={options} />
      </div>
      <div className="space-y-3">
        {keys.map((k) => (
          <div key={k} className="flex items-center justify-between border-b border-gray-100 dark:border-gray-700 pb-2 last:border-0">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: SPORT_META[k]?.color || '#9ca3af' }} />
              <span className="text-sm font-bold text-gray-800 dark:text-gray-200">{SPORT_META[k]?.label || k}</span>
            </div>
            <div className="text-right text-xs text-gray-500 dark:text-gray-400">
              <span className="font-bold text-gray-800 dark:text-gray-200">{breakdown[k].sessions} ses.</span>
              {' · '}{Math.round(breakdown[k].tss)} TSS
              {' · '}{formatDistanceKm(breakdown[k].distance_km)} km
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SportBreakdown;
