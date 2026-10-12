import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { Spinner, ErrorState } from '../components/ui';
import { User, Mail, Lock, Link as LinkIcon, CheckCircle2, XCircle, AlertCircle, Save, ShieldCheck, Calendar as CalendarIcon, RefreshCw } from 'lucide-react';

const Atleta = () => {
  const { user, refreshProfile, isLoading: authLoading } = useAuth();
  const [profile, setProfile] = useState({
    email: '',
    full_name: '',
    garmin_connected: false,
    garmin_email: null,
    google_calendar_id: ''
  });
  const [garminStatus, setGarminStatus] = useState({ connected: false, sync_status: 'IDLE' });
  const [garminForm, setGarminForm] = useState({ email: '', password: '' });
  const [connecting, setConnecting] = useState(false);
  const [passwords, setPasswords] = useState({
    current: '',
    new: '',
    confirm: ''
  });
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingCalendar, setSavingCalendar] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    if (user) {
      setProfile({
        ...user,
        google_calendar_id: user.google_calendar_id || ''
      });
      setLoading(false);
    } else if (!authLoading) {
      setLoading(false);
    }
  }, [user, authLoading]);

  useEffect(() => {
    const fetchGarminStatus = async () => {
      try {
        const res = await api.get('/api/garmin/status');
        setGarminStatus(res.data);
      } catch (err) {
        console.error('Error fetching Garmin status:', err);
      }
    };
    fetchGarminStatus();
  }, []);

  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    setSavingProfile(true);
    setMessage({ type: '', text: '' });
    try {
      await api.patch('/api/auth/profile', { 
        full_name: profile.full_name
      });
      await refreshProfile();
      setMessage({ type: 'success', text: 'Nombre actualizado correctamente.' });
    } catch (err) {
      setMessage({ type: 'error', text: 'Error al actualizar el perfil.' });
    } finally {
      setSavingProfile(false);
    }
  };

  const handleCalendarSubmit = async (e) => {
    e.preventDefault();
    setSavingCalendar(true);
    setMessage({ type: '', text: '' });
    try {
      await api.patch('/api/auth/profile', { 
        google_calendar_id: profile.google_calendar_id 
      });
      await refreshProfile();
      setMessage({ type: 'success', text: 'ID de Calendario guardado correctamente.' });
    } catch (err) {
      setMessage({ type: 'error', text: 'Error al actualizar las conexiones.' });
    } finally {
      setSavingCalendar(false);
    }
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    if (passwords.new !== passwords.confirm) {
      setMessage({ type: 'error', text: 'Las nuevas contraseñas no coinciden.' });
      return;
    }
    setChangingPassword(true);
    setMessage({ type: '', text: '' });
    try {
      await api.post('/api/auth/change-password', {
        current_password: passwords.current,
        new_password: passwords.new
      });
      setMessage({ type: 'success', text: 'Contraseña actualizada correctamente.' });
      setPasswords({ current: '', new: '', confirm: '' });
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.detail || 'Error al cambiar la contraseña.' });
    } finally {
      setChangingPassword(false);
    }
  };

  const handleGarminConnect = async (e) => {
    e.preventDefault();
    setConnecting(true);
    setMessage({ type: '', text: '' });
    try {
      await api.post('/api/garmin/connect', { 
        email: garminForm.email, 
        password: garminForm.password 
      });
      setMessage({ type: 'success', text: 'Garmin Connect conectado correctamente.' });
      setGarminForm({ email: '', password: '' });
      const res = await api.get('/api/garmin/status');
      setGarminStatus(res.data);
      await refreshProfile();
    } catch (err) {
      setMessage({ type: 'error', text: 'Error al conectar con Garmin: ' + (err.response?.data?.detail || err.message) });
    } finally {
      setConnecting(false);
    }
  };

  const handleGarminDisconnect = async () => {
    if (!confirm('¿Estás seguro de desconectar Garmin?')) return;
    try {
      await api.post('/api/garmin/disconnect');
      setMessage({ type: 'success', text: 'Garmin desconectado correctamente.' });
      const res = await api.get('/api/garmin/status');
      setGarminStatus(res.data);
      await refreshProfile();
    } catch (err) {
      setMessage({ type: 'error', text: 'Error al desconectar Garmin.' });
    }
  };

  if (loading || authLoading) {
    return <Spinner className="h-64" />;
  }

  if (!user) {
    return (
      <div className="max-w-md mx-auto mt-12 p-4">
        <ErrorState
          message="No se pudo cargar la información del perfil del atleta."
          onRetry={refreshProfile}
        />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-12">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white">Perfil del Atleta</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Gestiona tu identidad, seguridad y conexiones externas desde un solo lugar.
          </p>
        </div>
      </div>

      {message.text && (
        <div className={`p-4 rounded-xl flex items-start gap-3 animate-in fade-in slide-in-from-top-2 ${
          message.type === 'error' 
            ? 'bg-red-50 text-red-700 border border-red-100 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800' 
            : 'bg-green-50 text-green-700 border border-green-100 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800'
        }`}>
          {message.type === 'error' ? <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" /> : <CheckCircle2 className="h-5 w-5 flex-shrink-0 mt-0.5" />}
          <p className="text-sm font-medium">{message.text}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        
        {/* Lado Izquierdo: Identidad y Conexiones */}
        <div className="space-y-8">
          {/* Tarjeta de Identidad */}
          <section className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="p-5 border-b border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 flex items-center gap-3">
              <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg">
                <User className="h-5 w-5" />
              </div>
              <h2 className="font-bold text-gray-900 dark:text-white">Datos Personales</h2>
            </div>
            <form onSubmit={handleProfileSubmit} className="p-6 space-y-5">
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Email (Usuario)</label>
                <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400">
                  <Mail className="h-4 w-4" />
                  <span className="text-sm truncate">{profile.email}</span>
                </div>
              </div>
              <div>
                <label htmlFor="full_name" className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Nombre Completo</label>
                <input
                  type="text"
                  id="full_name"
                  value={profile.full_name || ''}
                  onChange={(e) => setProfile({...profile, full_name: e.target.value})}
                  className="block w-full sm:text-sm border-gray-300 dark:border-gray-600 rounded-xl dark:bg-gray-700 dark:text-white py-2.5 px-4 border focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                  placeholder="Introduce tu nombre"
                />
              </div>
              <button
                type="submit"
                disabled={savingProfile}
                className="w-full flex justify-center items-center gap-2 py-2.5 px-4 border border-transparent shadow-sm text-sm font-bold rounded-xl text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 transition-colors"
              >
                <Save className="h-4 w-4" />
                {savingProfile ? 'Guardando...' : 'Guardar Cambios'}
              </button>
            </form>
          </section>

          {/* Tarjeta de Conexiones */}
          <section className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="p-5 border-b border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 flex items-center gap-3">
              <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg">
                <LinkIcon className="h-5 w-5" />
              </div>
              <h2 className="font-bold text-gray-900 dark:text-white">Conexiones Externas</h2>
            </div>
            <form onSubmit={handleCalendarSubmit} className="p-6 space-y-6">
              {/* Garmin Connect */}
              <div className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-2xl border border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-4">
                    <div className="bg-[#007cc3]/10 p-2.5 rounded-xl">
                      <svg viewBox="0 0 24 24" className="h-6 w-6 text-[#007cc3] fill-current"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
                    </div>
                    <div>
                      <p className="font-bold text-base text-gray-900 dark:text-white">Garmin Connect</p>
                      <p className="text-xs text-gray-500 font-medium">
                        {garminStatus.connected ? `Conectado` : 'Cuenta no vinculada'}
                      </p>
                    </div>
                  </div>
                  {garminStatus.connected ? (
                    <span className="flex items-center gap-1.5 px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-[10px] font-black uppercase rounded-full border border-green-200 dark:border-green-800">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Activo
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 px-3 py-1 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 text-[10px] font-black uppercase rounded-full border border-gray-200 dark:border-gray-600">
                      <XCircle className="h-3.5 w-3.5" />
                      Inactivo
                    </span>
                  )}
                </div>
                
                {!garminStatus.connected ? (
                  <div className="space-y-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                    <p className="text-xs text-gray-500">Introduce tus credenciales de Garmin Connect:</p>
                    <div>
                      <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1 ml-1">Email</label>
                      <input
                        type="email"
                        value={garminForm.email}
                        onChange={(e) => setGarminForm({...garminForm, email: e.target.value})}
                        className="block w-full sm:text-sm border-gray-300 dark:border-gray-600 rounded-xl dark:bg-gray-700 dark:text-white py-2.5 px-4 border focus:ring-2 focus:ring-indigo-500 outline-none"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1 ml-1">Contraseña</label>
                      <input
                        type="password"
                        value={garminForm.password}
                        onChange={(e) => setGarminForm({...garminForm, password: e.target.value})}
                        className="block w-full sm:text-sm border-gray-300 dark:border-gray-600 rounded-xl dark:bg-gray-700 dark:text-white py-2.5 px-4 border focus:ring-2 focus:ring-indigo-500 outline-none"
                        required
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleGarminConnect}
                      disabled={connecting}
                      className="w-full flex justify-center items-center gap-2 py-2.5 px-4 border border-transparent shadow-sm text-sm font-bold rounded-xl text-white bg-[#007cc3] hover:bg-[#006aa8] focus:outline-none transition-colors disabled:opacity-50"
                    >
                      {connecting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <LinkIcon className="h-4 w-4" />}
                      {connecting ? 'Conectando...' : 'Conectar Garmin'}
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={handleGarminDisconnect}
                    className="w-full flex justify-center items-center gap-2 py-2 px-4 border border-red-200 dark:border-red-800 shadow-sm text-xs font-bold rounded-xl text-red-600 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/30 transition-colors"
                  >
                    <XCircle className="h-4 w-4" />
                    Desconectar Garmin
                  </button>
                )}
              </div>

              {/* Google Calendar ID */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="bg-blue-100 dark:bg-blue-900/30 p-2 rounded-lg">
                    <CalendarIcon className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  </div>
                  <label htmlFor="google_calendar_id" className="text-sm font-bold text-gray-700 dark:text-gray-300">Google Calendar ID</label>
                </div>
                <input
                  type="text"
                  id="google_calendar_id"
                  value={profile.google_calendar_id || ''}
                  onChange={(e) => setProfile({...profile, google_calendar_id: e.target.value})}
                  className="block w-full sm:text-sm border-gray-300 dark:border-gray-600 rounded-xl dark:bg-gray-700 dark:text-white py-2.5 px-4 border focus:ring-2 focus:ring-indigo-500 outline-none"
                  placeholder="ej: c_12345...6789@group.calendar.google.com"
                />
                <div className="p-3 bg-blue-50 dark:bg-blue-900/10 rounded-xl border border-blue-100 dark:border-blue-800/50">
                  <p className="text-[10px] text-blue-800 dark:text-blue-400 leading-tight">
                    Para que la IA pueda escribir en tu calendario, debes <strong>compartirlo</strong> con permisos de edición con este email:
                  </p>
                  <p className="text-[11px] font-mono font-bold text-blue-900 dark:text-blue-300 mt-1 break-all selection:bg-blue-200">
                    tu-bot@tu-proyecto.iam.gserviceaccount.com
                  </p>
                </div>
              </div>
              <button
                type="submit"
                disabled={savingCalendar}
                className="w-full flex justify-center items-center gap-2 py-2.5 px-4 border border-transparent shadow-sm text-sm font-bold rounded-xl text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none transition-colors disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                {savingCalendar ? 'Guardando...' : 'Guardar Conexiones'}
              </button>
            </form>
          </section>
        </div>

        {/* Lado Derecho: Seguridad */}
        <section className="h-full">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden h-full flex flex-col">
            <div className="p-5 border-b border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 flex items-center gap-3">
              <div className="p-2 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg">
                <Lock className="h-5 w-5" />
              </div>
              <h2 className="font-bold text-gray-900 dark:text-white">Seguridad y Acceso</h2>
            </div>
            <form onSubmit={handlePasswordSubmit} className="p-6 space-y-6 flex-1">
              <div className="p-4 bg-amber-50 dark:bg-amber-900/10 rounded-xl border border-amber-100 dark:border-amber-800/50 flex gap-3 items-start">
                <ShieldCheck className="h-5 w-5 text-amber-600 dark:text-amber-500 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-amber-800 dark:text-amber-400 leading-relaxed">
                  Para cambiar tu contraseña, debes introducir la clave actual por motivos de seguridad.
                </p>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label htmlFor="current" className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Contraseña Actual</label>
                  <input
                    type="password"
                    id="current"
                    value={passwords.current}
                    onChange={(e) => setPasswords({...passwords, current: e.target.value})}
                    className="block w-full sm:text-sm border-gray-300 dark:border-gray-600 rounded-xl dark:bg-gray-700 dark:text-white py-2.5 px-4 border focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                    required
                  />
                </div>
                <div className="pt-4 border-t border-gray-100 dark:border-gray-700/50">
                  <label htmlFor="new" className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Nueva Contraseña</label>
                  <input
                    type="password"
                    id="new"
                    value={passwords.new}
                    onChange={(e) => setPasswords({...passwords, new: e.target.value})}
                    className="block w-full sm:text-sm border-gray-300 dark:border-gray-600 rounded-xl dark:bg-gray-700 dark:text-white py-2.5 px-4 border focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="confirm" className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Confirmar Nueva Contraseña</label>
                  <input
                    type="password"
                    id="confirm"
                    value={passwords.confirm}
                    onChange={(e) => setPasswords({...passwords, confirm: e.target.value})}
                    className="block w-full sm:text-sm border-gray-300 dark:border-gray-600 rounded-xl dark:bg-gray-700 dark:text-white py-2.5 px-4 border focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                    required
                  />
                </div>
              </div>

              <div className="pt-4 mt-auto">
                <button
                  type="submit"
                  disabled={changingPassword}
                  className="w-full flex justify-center items-center gap-2 py-3 px-4 border border-transparent shadow-sm text-sm font-bold rounded-xl text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none transition-colors disabled:opacity-50"
                >
                  <ShieldCheck className="h-4 w-4" />
                  {changingPassword ? 'Actualizando...' : 'Actualizar Contraseña'}
                </button>
              </div>
            </form>
          </div>
        </section>

      </div>
    </div>
  );
};

export default Atleta;
