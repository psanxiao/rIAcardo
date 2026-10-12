import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { formatDurationMinutes, formatDistanceKm } from '../utils/format';
import { 
  format, 
  addMonths, 
  subMonths, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  isSameMonth, 
  isSameDay, 
  eachDayOfInterval,
  parseISO
} from 'date-fns';
import { es } from 'date-fns/locale';
import { 
  ChevronLeft, 
  ChevronRight, 
  Activity, 
  Clock, 
  TrendingUp,
  ExternalLink
} from 'lucide-react';
import api from '../services/api';
import { Spinner } from '../components/ui';

const Calendar = () => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchActivities();
  }, [currentMonth]);

  const fetchActivities = async () => {
    try {
      setLoading(true);
      const start = format(startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 1 }), 'yyyy-MM-dd');
      const end = format(endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 1 }), 'yyyy-MM-dd');
      
      const res = await api.get(`/api/analysis/activities?start_date=${start}&end_date=${end}`);
      setActivities(res.data);
    } catch (err) {
      console.error('Error fetching calendar activities:', err);
    } finally {
      setLoading(false);
    }
  };

  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
  const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));

  const renderHeader = () => {
    return (
      <div className="flex items-center justify-between px-4 py-4 bg-white dark:bg-gray-800 rounded-t-2xl border-b border-gray-100 dark:border-gray-700">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white capitalize">
          {format(currentMonth, 'MMMM yyyy', { locale: es })}
        </h2>
        <div className="flex gap-2">
          <button 
            onClick={prevMonth}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors text-gray-600 dark:text-gray-400"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <button 
            onClick={nextMonth}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors text-gray-600 dark:text-gray-400"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        </div>
      </div>
    );
  };

  const renderDays = () => {
    const days = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
    return (
      <div className="grid grid-cols-7 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-700">
        {days.map((day) => (
          <div key={day} className="py-2 text-center text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            {day}
          </div>
        ))}
      </div>
    );
  };

  const renderCells = () => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
    const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });

    const calendarDays = eachDayOfInterval({ start: startDate, end: endDate });

    return (
      <div className="grid grid-cols-7 flex-1">
        {calendarDays.map((day) => {
          const formattedDate = format(day, 'yyyy-MM-dd');
          const dayActivities = activities.filter(act => {
            const actDate = act.date ? act.date.trim() : '';
            return actDate === formattedDate;
          });
          const isToday = isSameDay(day, new Date());
          const isCurrentMonth = isSameMonth(day, monthStart);

          return (
            <div 
              key={day.toString()}
              className={`min-h-[120px] p-2 border-r border-b border-gray-100 dark:border-gray-700 flex flex-col transition-colors ${
                !isCurrentMonth ? 'bg-gray-50/50 dark:bg-gray-900/20' : 'bg-white dark:bg-gray-800'
              } ${isToday ? 'bg-indigo-50/30 dark:bg-indigo-900/10' : ''}`}
            >
              <div className={`text-right mb-1 ${
                !isCurrentMonth ? 'text-gray-400' : 'text-gray-900 dark:text-white'
              } ${isToday ? 'font-bold' : ''}`}>
                <span className={isToday ? 'bg-indigo-600 text-white w-6 h-6 inline-flex items-center justify-center rounded-full text-xs' : 'text-sm'}>
                  {format(day, 'd')}
                </span>
              </div>
              
              <div className="flex-1 space-y-1 overflow-y-auto max-h-[100px] scrollbar-hide">
                {dayActivities.map((act) => (
                  <Link 
                    key={act.activity_id}
                    to={`/activity/${act.activity_id}`}
                    className="block p-1.5 rounded bg-indigo-50 dark:bg-indigo-900/40 border border-indigo-100 dark:border-indigo-800 hover:scale-[1.02] transition-transform"
                  >
                    <div className="flex items-center justify-between gap-1">
                      <div className="flex items-center gap-1 min-w-0">
                        <Activity className="h-3 w-3 text-indigo-600 dark:text-indigo-400 shrink-0" />
                        <span className="text-[10px] font-bold text-gray-700 dark:text-gray-200 truncate capitalize">
                          {act.sport}
                        </span>
                      </div>
                      {act.tss > 0 && (
                        <span className="text-[9px] font-bold text-orange-500 shrink-0">
                          {Math.round(act.tss)}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 text-[8px] text-gray-500 dark:text-gray-400">
                      <span className="flex items-center gap-0.5"><Clock className="h-2 w-2" /> {formatDurationMinutes(act.duration_min)}</span>
                      {act.distance_km > 0 && <span>{formatDistanceKm(act.distance_km)}km</span>}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const monthActivities = activities.filter(a => isSameMonth(parseISO(a.start_time), currentMonth));

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Calendario de Actividades</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Visualiza y navega por tu historial de entrenamiento mes a mes.
          </p>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col overflow-hidden">
        {renderHeader()}
        <div className="flex flex-col">
          {renderDays()}
          <div className="relative">
            {loading && (
              <div className="absolute inset-0 bg-white/50 dark:bg-gray-800/50 z-10 flex items-center justify-center backdrop-blur-sm">
                <Spinner size="h-8 w-8" />
              </div>
            )}
            {renderCells()}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl border border-indigo-100 dark:border-indigo-800">
          <h4 className="text-xs font-bold text-indigo-700 dark:text-indigo-300 uppercase mb-1">Actividades este mes</h4>
          <p className="text-2xl font-black text-indigo-900 dark:text-white">
            {monthActivities.length}
          </p>
        </div>
        <div className="p-4 bg-orange-50 dark:bg-orange-900/20 rounded-xl border border-orange-100 dark:border-orange-800">
          <h4 className="text-xs font-bold text-orange-700 dark:text-orange-300 uppercase mb-1">TSS Total del mes</h4>
          <p className="text-2xl font-black text-orange-900 dark:text-white">
            {Math.round(monthActivities.reduce((acc, curr) => acc + (curr.tss || 0), 0))}
          </p>
        </div>
        <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-100 dark:border-green-800">
          <h4 className="text-xs font-bold text-green-700 dark:text-green-300 uppercase mb-1">Tiempo Total</h4>
          <p className="text-2xl font-black text-green-900 dark:text-white">
            {formatDurationMinutes(monthActivities.reduce((acc, curr) => acc + curr.duration_min, 0))}
          </p>
        </div>
      </div>
    </div>
  );
};

export default Calendar;
