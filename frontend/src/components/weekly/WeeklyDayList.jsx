import { Link } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { Bike, Footprints, Dumbbell, ExternalLink } from 'lucide-react';
import { formatDistanceKm } from '../../utils/format';

const STATUS = {
  completed: { label: 'Completado', cls: 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400' },
  partial: { label: 'Parcial', cls: 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400' },
  missed: { label: 'No hecho', cls: 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400' },
  extra: { label: 'Extra', cls: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400' },
  rest: { label: 'Descanso', cls: 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400' },
};

const sportIcon = (sport) => {
  const s = (sport || '').toLowerCase();
  if (s.includes('run') || s.includes('trail')) return Footprints;
  if (s.includes('ride') || s.includes('bike') || s.includes('cycl')) return Bike;
  return Dumbbell;
};

const WeeklyDayList = ({ days = [] }) => {
  return (
    <div className="divide-y divide-gray-100 dark:divide-gray-700">
      {days.map((day) => {
        const status = STATUS[day.status] || STATUS.rest;
        return (
          <div key={day.date} className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="sm:w-24 shrink-0">
              <p className="text-sm font-bold text-gray-900 dark:text-white capitalize">{day.weekday}</p>
              <p className="text-[10px] text-gray-400">{format(parseISO(day.date), 'dd MMM', { locale: es })}</p>
            </div>

            <div className="flex-1 min-w-0 grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <p className="text-[10px] font-bold uppercase text-gray-400 tracking-tighter mb-0.5">Plan</p>
                {day.planned.length ? (
                  day.planned.map((w, i) => (
                    <p key={i} className="text-xs text-gray-700 dark:text-gray-300 truncate">
                      {w.title} <span className="text-gray-400">· {Math.round(w.tss)} TSS</span>
                    </p>
                  ))
                ) : (
                  <p className="text-xs text-gray-400">—</p>
                )}
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase text-gray-400 tracking-tighter mb-0.5">Real</p>
                {day.actual.length ? (
                  day.actual.map((a) => {
                    const Icon = sportIcon(a.sport);
                    return (
                      <Link
                        key={a.activity_id}
                        to={`/activity/${a.activity_id}`}
                        className="group flex items-center gap-1.5 text-xs text-gray-700 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400"
                      >
                        <Icon className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
                        <span className="capitalize truncate">{a.sport}</span>
                        <span className="text-gray-400">
                          · {formatDistanceKm(a.distance_km)} km · {Math.round(a.tss)} TSS
                        </span>
                        <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                      </Link>
                    );
                  })
                ) : (
                  <p className="text-xs text-gray-400">—</p>
                )}
              </div>
            </div>

            <span className={`self-start sm:self-center text-[10px] font-bold px-2 py-1 rounded-full ${status.cls}`}>
              {status.label}
            </span>
          </div>
        );
      })}
    </div>
  );
};

export default WeeklyDayList;
