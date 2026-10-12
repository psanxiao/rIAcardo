import { TrendingUp, Activity, Zap, Dumbbell, Timer, Wind } from 'lucide-react';
import { formatDurationMinutes } from '../../utils/format';

const KpiGrid = ({ data }) => {
  const kpis = [
    { label: 'Fitness (CTL)', val: Math.round(data?.current_ctl || 0), icon: TrendingUp, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Fatiga (ATL)', val: Math.round(data?.current_atl || 0), icon: Activity, color: 'text-pink-600', bg: 'bg-pink-50' },
    { label: 'Forma (TSB)', val: Math.round(data?.current_tsb || 0), icon: Zap, color: (data?.current_tsb >= 0 ? 'text-green-600' : 'text-red-600'), bg: 'bg-orange-50' },
    { label: 'TSS (7d)', val: Math.round(data?.last_7_days_tss || 0), icon: Dumbbell, color: 'text-indigo-600', bg: 'bg-indigo-50' },
    { label: 'Tiempo (7d)', val: formatDurationMinutes(data?.last_7_days_time_min || 0), icon: Timer, color: 'text-purple-600', bg: 'bg-purple-50' },
    { label: 'VO2 Máx', val: data?.current_vo2max || '--', icon: Wind, color: 'text-green-600', bg: 'bg-green-50' },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
      {kpis.map((kpi, i) => (
        <div key={i} className="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 text-center">
          <div className="flex items-center gap-2 mb-2 justify-center">
            <div className={`p-1.5 ${kpi.bg} dark:bg-opacity-20 rounded-lg ${kpi.color}`}><kpi.icon className="h-4 w-4" /></div>
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-tight">{kpi.label}</span>
          </div>
          <p className={`text-2xl font-black ${kpi.label === 'Forma (TSB)' ? kpi.color : 'text-gray-900 dark:text-white'}`}>{kpi.val}</p>
        </div>
      ))}
    </div>
  );
};

export default KpiGrid;