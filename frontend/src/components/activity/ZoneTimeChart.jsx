import { Chart } from 'react-chartjs-2';

const ZoneTimeChart = ({ zoneData, title, emptyMessage }) => {
  return (
    <div className="bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 h-[300px]">
      {zoneData ? (
        <Chart type="bar" data={zoneData} options={{
          responsive: true, maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: { label: (ctx) => {
                const pct = ctx.dataset.percentages?.[ctx.dataIndex] ?? 0;
                return `${ctx.parsed.y} min (${pct}%)`;
              }}
            },
            title: { display: !!title, text: title, font: { size: 12 }, color: '#9ca3af' }
          },
          scales: {
            x: { grid: { display: false }, ticks: { font: { size: 9 }, maxRotation: 45 } },
            y: { beginAtZero: true, title: { display: true, text: 'Minutos', font: { size: 10 } }, ticks: { font: { size: 10 } } }
          },
        }} />
      ) : (
        <div className="flex h-full items-center justify-center text-gray-400 text-sm italic">{emptyMessage}</div>
      )}
    </div>
  );
};

export default ZoneTimeChart;