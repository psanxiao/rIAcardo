import { useMemo } from 'react';
import { Chart } from 'react-chartjs-2';
import { formatPace, formatBpm } from '../../utils/format';
import { computeKmSplits } from '../../utils/running';
import { SectionCard } from '../ui';

const RunningSplitsChart = ({ records }) => {
  const splits = useMemo(() => computeKmSplits(records), [records]);

  if (splits.length === 0) return null;

  const paces = splits.map(s => s.paceSec);
  const minPace = Math.min(...paces);
  const maxPace = Math.max(...paces);
  const spread = Math.max(maxPace - minPace, 30);
  const yMin = Math.max(0, Math.floor((minPace - spread * 0.25) / 5) * 5);
  const yMax = Math.ceil((maxPace + spread * 0.4) / 5) * 5;

  const chartData = {
    labels: splits.map(s => s.label),
    datasets: [
      {
        type: 'bar',
        label: 'Ritmo (min/km)',
        data: paces,
        base: yMax,
        backgroundColor: 'rgba(34, 197, 94, 0.6)',
        borderRadius: 4,
        yAxisID: 'y',
      },
      {
        type: 'line',
        label: 'FC media (bpm)',
        data: splits.map(s => s.hr),
        borderColor: 'rgb(239, 68, 68)',
        backgroundColor: 'rgb(239, 68, 68)',
        borderWidth: 2,
        pointRadius: 3,
        tension: 0.3,
        yAxisID: 'y1',
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { position: 'top' },
      tooltip: {
        callbacks: {
          title: (items) => {
            const idx = items[0]?.dataIndex;
            const split = splits[idx];
            if (split && split.km < 0.95) {
              return `Km ${items[0].label} (${split.km.toFixed(2)} km)`;
            }
            return `Km ${items[0].label}`;
          },
          label: (ctx) => ctx.datasetIndex === 0
            ? `Ritmo: ${formatPace(1000 / ctx.parsed.y)} /km`
            : `FC media: ${formatBpm(ctx.parsed.y)} bpm`,
        },
      },
    },
    scales: {
      x: { grid: { display: false }, title: { display: true, text: 'Km' } },
      y: {
        reverse: true,
        min: yMin,
        max: yMax,
        title: { display: true, text: 'Ritmo (min/km)' },
        ticks: { callback: (v) => formatPace(1000 / v) },
      },
      y1: { position: 'right', grid: { drawOnChartArea: false }, title: { display: true, text: 'FC (bpm)' } },
    },
  };

  return (
    <SectionCard title="Splits por kilómetro">
      <div className="p-4 sm:p-6">
        <div className="h-[260px]"><Chart type="bar" data={chartData} options={options} /></div>
      </div>
    </SectionCard>
  );
};

export default RunningSplitsChart;
