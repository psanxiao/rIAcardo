import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { format, addDays, subDays } from 'date-fns';
import toast from 'react-hot-toast';
import api from '../services/api';
import { formatDistanceKm } from '../utils/format';
import { Modal, Spinner } from '../components/ui';
import KpiGrid from '../components/dashboard/KpiGrid';
import WeeklyComplianceWidget from '../components/dashboard/WeeklyComplianceWidget';
import {
  Activity,
  RefreshCw,
  Link as LinkIcon,
  Calendar,
  Clock,
  ListTodo,
  Brain,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  X
} from 'lucide-react';

const Dashboard = () => {
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [data, setData] = useState(null);
  const [upcoming, setUpcoming] = useState([]);
  const [garminStatus, setGarminStatus] = useState({ connected: false, sync_status: 'IDLE' });
  const [complianceDate, setComplianceDate] = useState(new Date());
  const [complianceData, setComplianceData] = useState(null);
  const [loadingCompliance, setLoadingCompliance] = useState(false);
  const [, setError] = useState(null);
  const [analysisPeriod] = useState(() => parseInt(localStorage.getItem('analytics_period') || '6'));
  const [showConnectForm, setShowConnectForm] = useState(false);
  const [garminEmail, setGarminEmail] = useState('');
  const [garminPassword, setGarminPassword] = useState('');
  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    fetchDashboardData();
    
    const interval = setInterval(() => {
      if (garminStatus.sync_status === 'SYNCING' || garminStatus.sync_status === 'RATE_LIMITED') {
        refreshStatus();
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [garminStatus.sync_status, analysisPeriod]);

  useEffect(() => {
    fetchCompliance();
  }, [complianceDate]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const monthsToFetch = analysisPeriod;
      
      const [loadRes, statusRes, upcomingRes] = await Promise.all([
        api.get(`/api/analysis/training-load?months=${monthsToFetch}`),
        api.get('/api/garmin/status').catch(() => ({ data: { connected: false, sync_status: 'IDLE' } })),
        api.get('/api/coach/upcoming').catch(() => ({ data: [] }))
      ]);

      setData(loadRes.data);
      setGarminStatus(statusRes.data);
      setUpcoming(upcomingRes.data);
      setError(null);
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
      setError('No se pudieron cargar los datos del dashboard.');
    } finally {
      setLoading(false);
    }
  };

  const fetchCompliance = async () => {
    try {
      setLoadingCompliance(true);
      const dateStr = format(complianceDate, 'yyyy-MM-dd');
      const res = await api.get(`/api/coach/weekly-tss?date=${dateStr}`);
      setComplianceData(res.data);
    } catch (err) {
      console.error('Error fetching compliance:', err);
    } finally {
      setLoadingCompliance(false);
    }
  };

  const refreshStatus = async () => {
    try {
      const res = await api.get('/api/garmin/status');
      setGarminStatus(res.data);
      if (garminStatus.sync_status !== 'COMPLETED' && res.data.sync_status === 'COMPLETED') {
        fetchDashboardData();
      }
    } catch (err) {
      console.error('Error refreshing status:', err);
    }
  };

  const handleConnectGarmin = async (e) => {
    e.preventDefault();
    setConnecting(true);
    try {
      await api.post('/api/garmin/connect', { email: garminEmail, password: garminPassword });
      setShowConnectForm(false);
      setGarminEmail('');
      setGarminPassword('');
      await refreshStatus();
    } catch (err) {
      toast.error('Error al conectar con Garmin: ' + (err.response?.data?.detail || err.message));
    } finally {
      setConnecting(false);
    }
  };

  const handleSync = async () => {
    if (!garminStatus.connected) return;
    try {
      setSyncing(true);
      await api.post('/api/garmin/sync', { days_back: 30 });
      await refreshStatus();
    } catch (err) {
      console.error('Sync failed', err);
      toast.error('Error al iniciar la sincronización.');
    } finally {
      setSyncing(false);
    }
  };

  const handleStopSync = async () => {
    try {
      await api.post('/api/garmin/stop-sync');
      await refreshStatus();
    } catch (err) {
      console.error('Stop sync failed', err);
      toast.error('Error al detener la sincronización.');
    }
  };

  if (loading && !data) {
    return <Spinner className="h-64" />;
  }

  const recentActivities = data?.activities 
    ? data.activities.filter(act => {
        const actDate = new Date(act.date + 'T00:00:00');
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
        sevenDaysAgo.setHours(0, 0, 0, 0);
        return actDate >= sevenDaysAgo;
      }).reverse()
    : [];

  return (
    <div className="space-y-6 pb-12">
      {/* Header Row */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Panel de control de entrenamiento</p>
        </div>

        <div className="flex gap-2">
          {!garminStatus.connected ? (
            <button onClick={() => setShowConnectForm(true)} className="flex items-center gap-2 bg-[#007cc3] hover:bg-[#006aa8] text-white px-4 py-2 rounded-lg font-medium transition-colors">
              <LinkIcon className="h-4 w-4" /> Conectar Garmin
            </button>
          ) : (
            <button
              onClick={handleSync}
              disabled={syncing || garminStatus.sync_status === 'SYNCING'}
              className="flex items-center gap-2 bg-indigo-600 text-white hover:bg-indigo-700 px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${syncing || garminStatus.sync_status === 'SYNCING' ? 'animate-spin' : ''}`} />
              {garminStatus.sync_status === 'SYNCING' ? 'Sincronizando...' : 'Sincronizar'}
            </button>
          )}
        </div>
      </div>

      {/* Garmin Connect Modal */}
      <Modal isOpen={showConnectForm} onClose={() => setShowConnectForm(false)} title="Conectar Garmin Connect">
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Introduce tus credenciales de Garmin Connect (las mismas que usas en la app).</p>
        <form onSubmit={handleConnectGarmin} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1 dark:text-gray-400">Email</label>
            <input
              type="email"
              value={garminEmail}
              onChange={(e) => setGarminEmail(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl dark:bg-gray-700 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1 dark:text-gray-400">Contraseña</label>
            <input
              type="password"
              value={garminPassword}
              onChange={(e) => setGarminPassword(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl dark:bg-gray-700 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
              required
            />
          </div>
          <button
            type="submit"
            disabled={connecting}
            className="w-full bg-[#007cc3] hover:bg-[#006aa8] text-white py-2.5 rounded-xl font-medium transition-colors disabled:opacity-50"
          >
            {connecting ? 'Conectando...' : 'Conectar'}
          </button>
        </form>
      </Modal>

      {/* Sync Status Banner */}
      {garminStatus.connected && garminStatus.sync_status !== 'IDLE' && garminStatus.sync_status !== 'COMPLETED' && (
        <div className={`p-4 rounded-xl border flex items-center justify-between ${
          garminStatus.sync_status === 'RATE_LIMITED' ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-blue-50 border-blue-200 text-blue-800'
        }`}>
          <div className="flex items-center gap-3">
            {garminStatus.sync_status === 'RATE_LIMITED' ? <Clock className="h-5 w-5 animate-pulse" /> : <RefreshCw className="h-5 w-5 animate-spin" />}
            <p className="text-sm font-bold">{garminStatus.sync_status === 'RATE_LIMITED' ? 'Límite alcanzado (Esperando...)' : 'Sincronizando historial...'}</p>
          </div>
          <button onClick={handleStopSync} className="text-xs font-bold underline">Detener</button>
        </div>
      )}

      {/* Main KPIs Row (6 Cards) */}
      <KpiGrid data={data} />

      {/* Weekly Compliance Widget */}
      <WeeklyComplianceWidget
        complianceData={complianceData}
        loadingCompliance={loadingCompliance}
        onPrevWeek={() => setComplianceDate(subDays(complianceDate, 7))}
        onNextWeek={() => setComplianceDate(addDays(complianceDate, 7))}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activities */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden flex flex-col text-gray-900 dark:text-white">
          <div className="p-5 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50/50 dark:bg-gray-800/50">
            <div className="flex items-center gap-2"><Activity className="h-5 w-5 text-indigo-500" /><h2 className="text-lg font-bold">Actividades (7d)</h2></div>
            <Link to="/analytics" className="text-sm text-indigo-600 font-medium hover:underline">Ver Análisis</Link>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-gray-700 flex-1">
            {recentActivities.length > 0 ? recentActivities.map((act, i) => (
              <Link key={i} to={`/activity/${act.activity_id}`} className="block p-4 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                <div className="flex justify-between items-center text-gray-900 dark:text-white">
                  <div className="flex items-center gap-3"><div className="bg-indigo-50 dark:bg-indigo-900/20 p-2 rounded-full text-indigo-600"><Activity className="h-5 w-5" /></div><div><h4 className="text-sm font-bold capitalize">{act.sport}</h4><p className="text-[10px] text-gray-500">{act.date}</p></div></div>
                  <div className="text-right"><p className="text-xs font-bold">{formatDistanceKm(act.distance_km)} km</p><p className="text-[10px] text-orange-500 font-bold">{Math.round(act.tss)} TSS</p></div>
                </div>
              </Link>
            )) : <div className="p-12 text-center text-gray-400 text-sm">No hay actividades recientes.</div>}
          </div>
        </div>

        {/* Upcoming Workouts */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden flex flex-col text-gray-900 dark:text-white">
          <div className="p-5 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-indigo-50/30 dark:bg-indigo-900/10">
            <div className="flex items-center gap-2"><ListTodo className="h-5 w-5 text-indigo-600" /><h2 className="text-lg font-bold">Próximos Entrenamientos</h2></div>
            <Link to="/coach" className="text-sm text-indigo-600 font-medium hover:underline">Ir al Coach</Link>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-gray-700 flex-1">
            {upcoming.length > 0 ? upcoming.map((w, i) => (
              <div key={i} className="p-4 hover:bg-indigo-50/20 dark:hover:bg-indigo-900/10 transition-colors text-gray-900 dark:text-white">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-3"><div className="bg-green-50 dark:bg-green-900/20 p-2 rounded-lg text-green-600"><Calendar className="h-5 w-5" /></div><div><h4 className="text-sm font-bold">{w.title}</h4><p className="text-[10px] text-gray-500">{new Date(w.date).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'short' })}</p></div></div>
                  <div className="text-right text-gray-900 dark:text-white"><div className="flex items-center gap-1 justify-end text-xs font-bold text-gray-700 dark:text-gray-300"><Clock className="h-3 w-3" /> {w.duration} min</div><p className="text-[10px] text-indigo-500 font-bold">{w.tss} TSS Previsto</p></div>
                </div>
                <p className="mt-2 text-xs text-gray-600 dark:text-gray-400 line-clamp-1 italic">{w.description}</p>
              </div>
            )) : <div className="p-12 text-center flex flex-col items-center gap-3"><Brain className="h-8 w-8 text-gray-300" /><p className="text-sm text-gray-400 max-w-[200px]">Pide a la IA que genere tu plan en la pestaña de Coach.</p></div>}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
