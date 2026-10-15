import { useEffect, useState } from 'react';
import { CalendarClock, Save } from 'lucide-react';
import api from '../../services/api';

const CADENCES = [
  { value: 'weekly', label: 'Semanal' },
  { value: 'biweekly', label: 'Quincenal' },
];

const DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

const formatDate = (iso) => {
  if (!iso) return '';
  const [year, month, day] = iso.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
};

const PlanningSchedule = () => {
  const [enabled, setEnabled] = useState(false);
  const [cadence, setCadence] = useState('weekly');
  const [day, setDay] = useState(0);
  const [hour, setHour] = useState(6);
  const [nextRun, setNextRun] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    let active = true;
    api
      .get('/api/settings/plan')
      .then((res) => {
        if (!active) return;
        setEnabled(!!res.data.enabled);
        setCadence(res.data.cadence || 'weekly');
        setDay(res.data.day ?? 0);
        setHour(res.data.hour ?? 6);
        setNextRun(res.data.next_run || null);
      })
      .catch(() => {
        if (active) setMessage({ type: 'error', text: 'No se pudo cargar la planificación automática.' });
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setMessage({ type: '', text: '' });
    try {
      const res = await api.post('/api/settings/plan', {
        enabled,
        cadence,
        day: Number(day),
      });
      setNextRun(res.data.next_run || null);
      setMessage({ type: 'success', text: 'Planificación automática guardada.' });
    } catch (err) {
      setMessage({
        type: 'error',
        text: err?.response?.data?.detail || 'No se pudo guardar la planificación automática.',
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return null;

  return (
    <section className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-indigo-50 dark:bg-indigo-900/10 flex items-center gap-2">
        <CalendarClock className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
        <h2 className="font-semibold text-gray-900 dark:text-white">Planificación automática</h2>
      </div>

      <div className="p-6 space-y-6">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Elige cómo quieres recibir tu planificación. El día elegido se generarán automáticamente el
          informe del coach IA y los entrenamientos del próximo ciclo.
        </p>

        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 dark:border-gray-600 text-indigo-600 focus:ring-indigo-500"
          />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Activar planificación automática
          </span>
        </label>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div>
            <label htmlFor="plan-cadence" className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
              Frecuencia
            </label>
            <select
              id="plan-cadence"
              value={cadence}
              onChange={(e) => setCadence(e.target.value)}
              className="mt-1 block w-full sm:text-sm border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white py-2 px-3"
            >
              {CADENCES.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="plan-day" className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
              Día de la semana
            </label>
            <select
              id="plan-day"
              value={day}
              onChange={(e) => setDay(Number(e.target.value))}
              className="mt-1 block w-full sm:text-sm border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white py-2 px-3"
            >
              {DAYS.map((name, index) => (
                <option key={name} value={index}>
                  {name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {enabled && nextRun && (
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Próxima generación: <span className="font-medium text-gray-700 dark:text-gray-200">{formatDate(nextRun)}</span>{' '}
            a las {String(hour).padStart(2, '0')}:00.
          </p>
        )}

        {message.text && (
          <p
            className={`text-sm font-medium ${
              message.type === 'error'
                ? 'text-red-600 dark:text-red-400'
                : 'text-green-600 dark:text-green-400'
            }`}
          >
            {message.text}
          </p>
        )}

        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 py-2 px-5 border border-transparent shadow-sm text-sm font-medium rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 transition-colors"
          >
            <Save className="h-4 w-4" />
            {saving ? 'Guardando...' : 'Guardar planificación'}
          </button>
        </div>
      </div>
    </section>
  );
};

export default PlanningSchedule;
