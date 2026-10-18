import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  LineController,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Chart } from 'react-chartjs-2';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, LineController, Tooltip, Legend, Filler);

const WeeklyLoadChart = ({ load }) => {
  const data = {
    labels: (load?.dates || []).map((d) => format(parseISO(d), 'EEE', { locale: es })),
    datasets: [
      { label: 'CTL', data: load?.ctl || [], borderColor: 'rgb(59, 130, 246)', backgroundColor: 'rgba(59, 130, 246, 0.1)', borderWidth: 2, pointRadius: 2, tension: 0.4, fill: true, yAxisID: 'y' },
      { label: 'ATL', data: load?.atl || [], borderColor: 'rgb(236, 72, 153)', borderWidth: 1.5, pointRadius: 1, tension: 0.4, yAxisID: 'y' },
      { label: 'TSB', data: load?.tsb || [], borderColor: 'rgb(249, 115, 22)', borderWidth: 1.5, pointRadius: 2, tension: 0.4, yAxisID: 'y1' },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { position: 'top', align: 'end', labels: { boxWidth: 10, font: { size: 10 } } },
    },
    scales: {
      x: { grid: { display: false }, ticks: { font: { size: 10 } } },
      y: { grid: { color: 'rgba(156, 163, 175, 0.1)' }, ticks: { font: { size: 9 } }, title: { display: true, text: 'Carga', font: { size: 10 } } },
      y1: { type: 'linear', position: 'right', grid: { drawOnChartArea: false }, ticks: { font: { size: 9 } }, title: { display: true, text: 'TSB', font: { size: 10 } } },
    },
  };

  return (
    <div className="h-[240px]">
      <Chart type="line" data={data} options={options} />
    </div>
  );
};

export default WeeklyLoadChart;
