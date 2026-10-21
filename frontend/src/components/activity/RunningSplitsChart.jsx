import { useMemo } from 'react';
import { Chart } from 'react-chartjs-2';
import { formatPace, formatBpm } from '../../utils/format';
import { SectionCard } from '../ui';

const toMs = (t) => new Date(String(t).replace(' ', 'T')).getTime();

const computeKmSplits = (records) => {
  const valid = records.filter(r => r.distance != null && r.time != null);
  if (valid.length < 2) return [];

  const splits = [];
  const origin = valid[0].distance;
  let segStart = valid[0];
  let segStartDist = origin;
  let boundary = origin + 1000;
  let hrs = [];

  const pushSplit = (end, meters) => {
    const seconds = (toMs(end.time) - toMs(segStart.time)) / 1000;
    if (meters < 100 || seconds <= 0) return;
    const avgHr = hrs.length ? hrs.reduce((a, b) => a + b, 0) / hrs.length : null;
    splits.push({ label: `${splits.length + 1}`, paceSec: seconds / (meters / 1000), hr: avgHr, km: meters / 1000 });
  };

  valid.forEach(r => {
    if (r.distance >= boundary) {
      pushSplit(r, boundary - segStartDist);
      segStart = r;
      segStartDist = boundary;
      boundary += 1000;
      hrs = [];
    }
    if (r.hr) hrs.push(r.hr);
  });

  const last = valid[valid.length - 1];
  pushSplit(last, last.distance - segStartDist);

  return splits;
};

const RunningSplitsChart = ({ records }) => {
  const splits = useMemo(() => computeKmSplits(records), [records]);

  if (splits.length === 0) return null;

  const chartData = {
    labels: splits.map(s => s.label),
    datasets: [
      {
        type: 'bar',
        label: 'Ritmo (min/km)',
        data: splits.map(s => s.paceSec),
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
          title: (items) => `Km ${items[0].label}`,
          label: (ctx) => ctx.datasetIndex === 0
            ? `Ritmo: ${formatPace(1000 / ctx.parsed.y)} /km`
            : `FC media: ${formatBpm(ctx.parsed.y)} bpm`,
        },
      },
    },
    scales: {
      x: { grid: { display: false }, title: { display: true, text: 'Km' } },
      y: {
        beginAtZero: false,
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
