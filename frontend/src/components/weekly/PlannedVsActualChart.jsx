import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  BarController,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, BarElement, BarController, Title, Tooltip, Legend);

const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);

const PlannedVsActualChart = ({ days = [] }) => {
  const data = {
    labels: days.map((d) => capitalize(d.weekday.slice(0, 3))),
    datasets: [
      {
        label: 'Planificado',
        data: days.map((d) => d.planned_tss),
        backgroundColor: 'rgba(156, 163, 175, 0.55)',
        borderRadius: 4,
      },
      {
        label: 'Realizado',
        data: days.map((d) => d.actual_tss),
        backgroundColor: 'rgba(79, 70, 229, 0.85)',
        borderRadius: 4,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { position: 'top', align: 'end', labels: { boxWidth: 10, font: { size: 10 } } },
      tooltip: { callbacks: { label: (c) => ` ${c.dataset.label}: ${Math.round(c.raw)} TSS` } },
    },
    scales: {
      x: { grid: { display: false }, ticks: { font: { size: 10 } } },
      y: {
        beginAtZero: true,
        grid: { color: 'rgba(156, 163, 175, 0.1)' },
        ticks: { font: { size: 9 } },
        title: { display: true, text: 'TSS', font: { size: 10 } },
      },
    },
  };

  return (
    <div className="h-[300px]">
      <Bar data={data} options={options} />
    </div>
  );
};

export default PlannedVsActualChart;
