import { useState, useEffect, useMemo } from 'react';
import toast from 'react-hot-toast';
import api from '../services/api';
import { Spinner } from '../components/ui';
import ZoneEditor from '../components/settings/ZoneEditor';
import { Save, AlertCircle, User, Target, Brain } from 'lucide-react';

const Atleta = () => {
  const [settings, setSettings] = useState({
    ftp: '',
    lthr: '',
    weight: '',
    age: '',
    threshold_pace: '',
    athlete_context: '',
    athlete_goal: '',
  });
  const [powerZones, setPowerZones] = useState([]);
  const [hrZones, setHrZones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [racePredictions, setRacePredictions] = useState(null);
  const [message, setMessage] = useState({ type: '', text: '' });

  // Helpers to convert between m/s and min/km
  const msToPace = (ms) => {
    if (!ms || isNaN(ms) || parseFloat(ms) === 0) return "";
    const totalSeconds = 1000 / parseFloat(ms);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = Math.round(totalSeconds % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const paceToMs = (paceStr) => {
    if (!paceStr || typeof paceStr !== 'string') return 0;
    const parts = paceStr.split(':');
    if (parts.length === 2) {
      const mins = parseInt(parts[0]);
      const secs = parseInt(parts[1]);
      if (isNaN(mins) || isNaN(secs) || (mins === 0 && secs === 0)) return 0;
      return 1000 / (mins * 60 + secs);
    }
    const val = parseFloat(paceStr);
    if (isNaN(val) || val === 0) return 0;
    return 1000 / (val * 60);
  };

  const defaultPowerZones = useMemo(() => [
    { name: 'Z1', label: 'Recuperación Activa', min: 0, max: 0 },
    { name: 'Z2', label: 'Resistencia', min: 0, max: 0 },
    { name: 'Z3', label: 'Tempo', min: 0, max: 0 },
    { name: 'Z4', label: 'Umbral Lactato', min: 0, max: 0 },
    { name: 'Z5', label: 'VO2 Máx', min: 0, max: 0 },
    { name: 'Z6', label: 'Capacidad Anaeróbica', min: 0, max: 0 },
    { name: 'Z7', label: 'Neuromuscular', min: 0, max: 9999 },
  ], []);

  const defaultHrZones = useMemo(() => [
    { name: 'Z1', label: 'Recuperación Activa', min: 0, max: 0 },
    { name: 'Z2', label: 'Aeróbico', min: 0, max: 0 },
    { name: 'Z3', label: 'Tempo', min: 0, max: 0 },
    { name: 'Z4', label: 'Sub-Umbral', min: 0, max: 0 },
    { name: 'Z5', label: 'Umbral / Anaeróbico', min: 0, max: 250 },
  ], []);

  useEffect(() => {
    api.get('/api/analysis/race-predictions').then(r => setRacePredictions(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await api.get('/api/settings');
        setSettings({
          ftp: res.data.ftp || '',
          lthr: res.data.lthr || '',
          weight: res.data.weight || '',
          age: res.data.age || '',
          threshold_pace: msToPace(res.data.threshold_pace),
          athlete_context: res.data.athlete_context || '',
          athlete_goal: res.data.athlete_goal || '',
        });
        
        if (res.data.power_zones) {
          setPowerZones(typeof res.data.power_zones === 'string' ? JSON.parse(res.data.power_zones) : res.data.power_zones);
        } else {
          setPowerZones(defaultPowerZones);
        }

        if (res.data.hr_zones) {
          setHrZones(typeof res.data.hr_zones === 'string' ? JSON.parse(res.data.hr_zones) : res.data.hr_zones);
        } else {
          setHrZones(defaultHrZones);
        }

      } catch (err) {
        console.error('Error al cargar los datos del atleta', err);
        setMessage({ type: 'error', text: 'Error al cargar los datos del atleta.' });
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, [defaultPowerZones, defaultHrZones]);

  const calculatePowerZones = () => {
    const ftp = parseInt(settings.ftp);
    if (!ftp || isNaN(ftp)) {
      toast.error("Por favor, introduce un FTP válido primero.");
      return;
    }
    const newZones = [
      { name: 'Z1', label: 'Recuperación Activa', min: 0, max: Math.round(ftp * 0.55) },
      { name: 'Z2', label: 'Resistencia', min: Math.round(ftp * 0.56), max: Math.round(ftp * 0.75) },
      { name: 'Z3', label: 'Tempo', min: Math.round(ftp * 0.76), max: Math.round(ftp * 0.90) },
      { name: 'Z4', label: 'Umbral Lactato', min: Math.round(ftp * 0.91), max: Math.round(ftp * 1.05) },
      { name: 'Z5', label: 'VO2 Máx', min: Math.round(ftp * 1.06), max: Math.round(ftp * 1.20) },
      { name: 'Z6', label: 'Capacidad Anaeróbica', min: Math.round(ftp * 1.21), max: Math.round(ftp * 1.50) },
      { name: 'Z7', label: 'Neuromuscular', min: Math.round(ftp * 1.51), max: 9999 },
    ];
    setPowerZones(newZones);
  };

  const calculateHrZones = () => {
    const lthr = parseInt(settings.lthr);
    if (!lthr || isNaN(lthr)) {
      toast.error("Por favor, introduce un Umbral Cardíaco (LTHR) válido primero.");
      return;
    }
    const newZones = [
      { name: 'Z1', label: 'Recuperación Activa', min: 0, max: Math.round(lthr * 0.81) },
      { name: 'Z2', label: 'Aeróbico', min: Math.round(lthr * 0.82), max: Math.round(lthr * 0.89) },
      { name: 'Z3', label: 'Tempo', min: Math.round(lthr * 0.90), max: Math.round(lthr * 0.93) },
      { name: 'Z4', label: 'Sub-Umbral', min: Math.round(lthr * 0.94), max: Math.round(lthr * 0.99) },
      { name: 'Z5', label: 'Umbral / Anaeróbico', min: Math.round(lthr * 1.00), max: 250 },
    ];
    setHrZones(newZones);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setSettings(prev => ({ ...prev, [name]: value }));
  };

  const handleZoneChange = (type, index, field, value) => {
    const val = value === '' ? 0 : parseInt(value);
    if (type === 'power') {
      const updated = [...powerZones];
      updated[index][field] = val;
      setPowerZones(updated);
    } else {
      const updated = [...hrZones];
      updated[index][field] = val;
      setHrZones(updated);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage({ type: '', text: '' });
    try {
      const payload = {
        ...settings,
        threshold_pace: paceToMs(settings.threshold_pace),
        power_zones: JSON.stringify(powerZones),
        hr_zones: JSON.stringify(hrZones)
      };
      await api.post('/api/settings', payload);
      setMessage({ type: 'success', text: 'Datos del atleta guardados correctamente.' });
    } catch (err) {
      console.error('Error al guardar los datos del atleta', err);
      setMessage({ type: 'error', text: 'Error al guardar los datos del atleta.' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <Spinner className="h-64" />;
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-12">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Atleta</h1>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          Tu perfil físico, parámetros de rendimiento, zonas y configuración del coach IA.
        </p>
      </div>

      {message.text && (
        <div className={`p-4 rounded-lg flex items-start gap-3 ${
          message.type === 'error' 
            ? 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400' 
            : 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400'
        }`}>
          {message.type === 'error' && <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />}
          <p className="text-sm font-medium">{message.text}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        
        {/* Bloque 1: Información del Atleta (Física y Rendimiento) */}
        <section className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 flex items-center gap-2">
            <User className="h-5 w-5 text-indigo-500" />
            <h2 className="font-semibold text-gray-900 dark:text-white">Perfil y Rendimiento</h2>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              <div>
                <label htmlFor="age" className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Edad</label>
                <input
                  type="number"
                  name="age"
                  id="age"
                  value={settings.age}
                  onChange={handleChange}
                  className="mt-1 block w-full sm:text-sm border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white py-2 px-3 border"
                  placeholder="30"
                />
              </div>
              <div>
                <label htmlFor="weight" className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Peso (kg)</label>
                <input
                  type="number"
                  step="0.1"
                  name="weight"
                  id="weight"
                  value={settings.weight}
                  onChange={handleChange}
                  className="mt-1 block w-full sm:text-sm border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white py-2 px-3 border"
                  placeholder="70.5"
                />
              </div>
              <div>
                <label htmlFor="ftp" className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">FTP (W)</label>
                <input
                  type="number"
                  name="ftp"
                  id="ftp"
                  value={settings.ftp}
                  onChange={handleChange}
                  className="mt-1 block w-full sm:text-sm border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white py-2 px-3 border"
                  placeholder="250"
                />
              </div>
              <div>
                <label htmlFor="lthr" className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Umbral HR (bpm)</label>
                <input
                  type="number"
                  name="lthr"
                  id="lthr"
                  value={settings.lthr}
                  onChange={handleChange}
                  className="mt-1 block w-full sm:text-sm border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white py-2 px-3 border"
                  placeholder="165"
                />
              </div>
              <div>
                <label htmlFor="threshold_pace" className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Ritmo Umbral (min/km)</label>
                <input
                  type="text"
                  name="threshold_pace"
                  id="threshold_pace"
                  value={settings.threshold_pace}
                  onChange={handleChange}
                  className="mt-1 block w-full sm:text-sm border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white py-2 px-3 border"
                  placeholder="4:30"
                />
                <p className="text-[10px] text-gray-400 mt-1">
                  Tu ritmo en el umbral anaeróbico (ej: 4:30)
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Bloque 2: Gestión de Zonas */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <ZoneEditor
            zones={powerZones}
            zoneType="power"
            onZoneChange={handleZoneChange}
            onAutoCalculate={calculatePowerZones}
          />
          <ZoneEditor
            zones={hrZones}
            zoneType="hr"
            onZoneChange={handleZoneChange}
            onAutoCalculate={calculateHrZones}
          />
        </div>

        {/* Predicciones de Rendimiento */}
        {racePredictions && (racePredictions.cycling?.length > 0 || racePredictions.running?.length > 0) && (
          <section className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-indigo-50 dark:bg-indigo-900/10 flex items-center gap-2">
              <Target className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
              <h2 className="font-semibold text-gray-900 dark:text-white">Predicciones de Rendimiento</h2>
              <span className="ml-auto text-[10px] text-gray-400">Basado en tus zonas actuales</span>
            </div>
            <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-6">
              {racePredictions.cycling?.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase mb-3">Ciclismo (Critical Power)</p>
                  <div className="space-y-2">
                    {racePredictions.cycling.map((p, i) => (
                      <div key={i} className="flex justify-between items-center text-sm">
                        <span className="text-gray-500 dark:text-gray-400">{p.duration_label}</span>
                        <span className="font-bold text-gray-900 dark:text-white">{p.predicted_power_w} W</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {racePredictions.running?.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase mb-3">Running (Riegel)</p>
                  <div className="space-y-2">
                    {racePredictions.running.map((p, i) => (
                      <div key={i} className="flex justify-between items-center text-sm">
                        <span className="text-gray-500 dark:text-gray-400">{p.distance_label}</span>
                        <div className="text-right">
                          <div className="font-bold text-gray-900 dark:text-white">{p.predicted_time}</div>
                          <div className="text-[10px] text-gray-400">{p.predicted_pace}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Bloque 3: Configuración del Coach IA (AL FINAL) */}
        <section className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-indigo-50 dark:bg-indigo-900/10 flex items-center gap-2">
            <Brain className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            <h2 className="font-semibold text-gray-900 dark:text-white">Configuración Coach IA</h2>
          </div>
          <div className="p-6 space-y-6">
            <div>
              <div className="flex items-center justify-between">
                <label htmlFor="athlete_context" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Contexto y Perfil Deportivo</label>
                <span className="text-xs text-gray-400 dark:text-gray-500">
                  {(settings.athlete_context || '').length} caracteres
                </span>
              </div>
              <textarea
                id="athlete_context"
                name="athlete_context"
                rows={10}
                value={settings.athlete_context}
                onChange={handleChange}
                className="mt-1 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white p-3 resize-y min-h-[220px] leading-relaxed"
                placeholder="Ej: Ciclista amateur de 35 años que compite en marchas cicloturistas. Entreno unas 8-10 horas semanales. Los lunes hago fuerza, martes y jueves salgo en bici 2-3 horas y el fin de semana hago una tirada larga..."
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Cuanto más detalle des (disponibilidad, lesiones, disciplina, objetivos), mejor será el análisis y el plan del coach.
              </p>
            </div>
            <div>
              <div className="flex items-center justify-between">
                <label htmlFor="athlete_goal" className="flex items-center gap-1.5 text-sm font-medium text-gray-700 dark:text-gray-300">
                  <Target className="h-4 w-4 text-gray-400" />
                  Objetivo Actual
                </label>
                <span className="text-xs text-gray-400 dark:text-gray-500">
                  {(settings.athlete_goal || '').length} caracteres
                </span>
              </div>
              <textarea
                id="athlete_goal"
                name="athlete_goal"
                rows={10}
                value={settings.athlete_goal}
                onChange={handleChange}
                className="mt-1 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white p-3 resize-y min-h-[220px] leading-relaxed"
                placeholder="Ej: Mejorar mi potencia en subidas de 20 minutos de cara a la marcha de junio."
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Describe el objetivo (carrera, fecha, marca o mantenimiento) con el nivel de detalle que necesites.
              </p>
            </div>
          </div>
        </section>

        <div className="flex justify-end sticky bottom-6 z-10">
          <button
            type="submit"
            disabled={saving}
            className="flex justify-center items-center gap-2 py-3 px-10 border border-transparent shadow-2xl text-lg font-bold rounded-xl text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 transition-all transform hover:scale-105"
          >
            <Save className="h-6 w-6" />
            {saving ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default Atleta;
