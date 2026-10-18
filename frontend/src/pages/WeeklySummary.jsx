import { useState, useEffect, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { format, parseISO, addDays, isValid } from 'date-fns';
import { es } from 'date-fns/locale';
import api from '../services/api';
import { Spinner, StatTile, SectionCard, EmptyState, ErrorState } from '../components/ui';
import PlannedVsActualChart from '../components/weekly/PlannedVsActualChart';
import WeeklyDayList from '../components/weekly/WeeklyDayList';
import SportBreakdown from '../components/weekly/SportBreakdown';
import WeeklyLoadChart from '../components/weekly/WeeklyLoadChart';
import { formatDistanceKm, formatDurationMinutes } from '../utils/format';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Activity,
  CalendarDays,
  TrendingUp,
  BarChart3,
  ListTodo,
  Bike,
  Footprints,
  Dumbbell,
} from 'lucide-react';

const sportIcon = (sport) => {
  const s = (sport || '').toLowerCase();
  if (s.includes('run') || s.includes('trail')) return Footprints;
  if (s.includes('ride') || s.includes('bike') || s.includes('cycl')) return Bike;
  return Dumbbell;
};

const WeeklySummary = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  const dateParam = searchParams.get('date');
  const weekDate = useMemo(() => {
    const parsed = dateParam ? parseISO(dateParam) : new Date();
    return isValid(parsed) ? parsed : new Date();
  }, [dateParam]);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const goToWeek = (date) => setSearchParams({ date: format(date, 'yyyy-MM-dd') });

  useEffect(() => {
    let active = true;
    const fetchSummary = async () => {
      setLoading(true);
      try {
        const res = await api.get(`/api/coach/weekly-summary?date=${format(weekDate, 'yyyy-MM-dd')}`);
        if (active) {
          setData(res.data);
          setError(null);
        }
      } catch (err) {
        console.error('Error fetching weekly summary:', err);
        if (active) setError('No se pudo cargar el resumen semanal.');
      } finally {
        if (active) setLoading(false);
      }
    };
    fetchSummary();
    return () => {
      active = false;
    };
  }, [weekDate]);

  if (loading && !data) {
    return <Spinner className="h-64" />;
  }

  if (error && !data) {
    return <ErrorState message={error} onRetry={() => goToWeek(weekDate)} />;
  }

  const totals = data?.totals || {};
  const compliance = data?.compliance_pct ?? 0;
  const complianceStatus =
    compliance >= 90 && compliance <= 110
      ? { label: 'En objetivo', cls: 'text-green-600', Icon: CheckCircle2 }
      : compliance > 110
        ? { label: 'Carga extra', cls: 'text-orange-500', Icon: Sparkles }
        : { label: 'Bajo el plan', cls: 'text-red-500', Icon: AlertCircle };

  const hasActivities = (data?.activities || []).length > 0;

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <Link to="/dashboard" className="text-xs text-indigo-600 font-medium hover:underline flex items-center gap-1 mb-1">
            <ArrowLeft className="h-3 w-3" /> Volver al dashboard
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Resumen Semanal</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 capitalize">
            {data
              ? `${format(parseISO(data.start_date), "d 'de' MMMM", { locale: es })} - ${format(parseISO(data.end_date), "d 'de' MMMM", { locale: es })}`
              : 'Cargando...'}
          </p>
        </div>
        <div className="flex items-center gap-1 bg-white dark:bg-gray-800 p-1 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
          <button
            onClick={() => goToWeek(addDays(weekDate, -7))}
            className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors text-gray-500"
            aria-label="Semana anterior"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            onClick={() => goToWeek(new Date())}
            className="px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
          >
            Semana actual
          </button>
          <button
            onClick={() => goToWeek(addDays(weekDate, 7))}
            className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors text-gray-500"
            aria-label="Semana siguiente"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <Spinner size="h-4 w-4" /> Actualizando...
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatTile
          label="TSS realizado"
          value={Math.round(data?.actual_tss || 0)}
          subValue={`de ${Math.round(data?.planned_tss || 0)} planificados`}
          accent="text-indigo-600"
        />
        <StatTile
          label="Cumplimiento"
          value={`${Math.round(compliance)}%`}
          subValue={complianceStatus.label}
          accent={complianceStatus.cls}
        />
        <StatTile label="Tiempo" value={formatDurationMinutes(totals.duration_min)} accent="text-gray-900 dark:text-white" />
        <StatTile label="Distancia" value={`${formatDistanceKm(totals.distance_km)} km`} accent="text-gray-900 dark:text-white" />
        <StatTile label="Desnivel" value={`${Math.round(totals.ascent_m || 0)} m`} accent="text-gray-900 dark:text-white" />
        <StatTile label="Sesiones" value={totals.sessions || 0} accent="text-gray-900 dark:text-white" />
      </div>

      {/* Planned vs actual */}
      <SectionCard icon={BarChart3} title="Plan vs. Realizado" subtitle="TSS por día">
        <div className="p-5">
          <PlannedVsActualChart days={data?.days || []} />
        </div>
      </SectionCard>

      {/* Adherence day by day */}
      <SectionCard icon={ListTodo} title="Cumplimiento del plan" subtitle="Día a día">
        <WeeklyDayList days={data?.days || []} />
      </SectionCard>

      {/* Sport breakdown */}
      <SectionCard icon={Activity} title="Reparto por deporte">
        <div className="p-5">
          <SportBreakdown breakdown={data?.sport_breakdown || {}} />
        </div>
      </SectionCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Load context */}
        <SectionCard icon={TrendingUp} title="Contexto de carga">
          <div className="p-5 space-y-4">
            {data?.load ? (
              <>
                <WeeklyLoadChart load={data.load} />
                <div className="grid grid-cols-3 gap-3 pt-2 border-t border-gray-100 dark:border-gray-700">
                  <div className="text-center">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">ΔCTL</p>
                    <p className={`text-lg font-black ${data.load.ctl_change >= 0 ? 'text-blue-600' : 'text-red-500'}`}>
                      {data.load.ctl_change >= 0 ? '+' : ''}{data.load.ctl_change}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">TSB final</p>
                    <p className="text-lg font-black text-orange-500">{data.load.tsb_end}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">Días descanso</p>
                    <p className="text-lg font-black text-gray-900 dark:text-white">{data.balance?.rest_days ?? 0}</p>
                  </div>
                </div>
              </>
            ) : (
              <EmptyState icon={TrendingUp} title="Sin datos de carga" description="Aún no hay suficiente historial para esta semana." />
            )}
          </div>
        </SectionCard>

        {/* Activities of the week */}
        <SectionCard icon={CalendarDays} title="Actividades de la semana">
          {hasActivities ? (
            <div className="divide-y divide-gray-100 dark:divide-gray-700">
              {data.activities.map((a) => {
                const Icon = sportIcon(a.sport);
                return (
                  <Link
                    key={a.activity_id}
                    to={`/activity/${a.activity_id}`}
                    className="flex items-center justify-between gap-3 p-4 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="bg-indigo-50 dark:bg-indigo-900/20 p-2 rounded-full text-indigo-600 shrink-0">
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-gray-900 dark:text-white capitalize truncate">{a.sport}</p>
                        <p className="text-[10px] text-gray-500">
                          {format(parseISO(a.date), 'EEE d MMM', { locale: es })} · {formatDurationMinutes(a.duration_min)}
                        </p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs font-bold text-gray-900 dark:text-white">{formatDistanceKm(a.distance_km)} km</p>
                      <p className="text-[10px] text-orange-500 font-bold">{Math.round(a.tss)} TSS</p>
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <EmptyState icon={CalendarDays} title="No hay actividades esta semana" description="Sincroniza Garmin o elige otra semana." />
          )}
        </SectionCard>
      </div>
    </div>
  );
};

export default WeeklySummary;
