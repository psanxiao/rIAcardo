import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import toast from 'react-hot-toast';
import api from '../services/api';
import { 
  Bot, RefreshCw, Calendar as CalendarIcon, AlertCircle, History, 
  ChevronLeft, Sparkles, MessageSquare, Plus, Clock, ArrowLeft
} from 'lucide-react';

const Coach = () => {
  const { user } = useAuth();
  const [report, setReport] = useState(null);
  const [date, setDate] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const MarkdownComponents = {
    h1: ({ children }) => <h1 className="text-2xl font-black text-gray-900 dark:text-white mb-6 mt-2 tracking-tight">{children}</h1>,
    h2: ({ children }) => (
      <h2 className="text-lg font-extrabold text-indigo-600 dark:text-indigo-400 mt-10 mb-4 uppercase tracking-widest flex items-center gap-2">
        {children}<div className="h-px bg-gray-200 dark:bg-gray-700 flex-1 ml-2"></div>
      </h2>
    ),
    h3: ({ children }) => <h3 className="text-md font-bold text-gray-800 dark:text-gray-200 mt-6 mb-3">{children}</h3>,
    p: ({ children }) => <p className="text-gray-600 dark:text-gray-400 leading-relaxed mb-4 text-base">{children}</p>,
    ul: ({ children }) => <ul className="space-y-3 mb-6 ml-1">{children}</ul>,
    li: ({ children }) => (
      <li className="flex items-start gap-3">
        <div className="mt-2 w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0"></div>
        <span className="text-gray-700 dark:text-gray-300 text-sm leading-snug">{children}</span>
      </li>
    ),
    strong: ({ children }) => <strong className="font-bold text-gray-900 dark:text-white">{children}</strong>,
    blockquote: ({ children }) => <div className="my-8 p-6 bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl border-l-4 border-indigo-600 text-indigo-900 dark:text-indigo-300 italic">{children}</div>
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const [latestRes, historyRes] = await Promise.all([
        api.get('/api/coach/latest-report'),
        api.get('/api/coach/history').catch(() => ({ data: [] }))
      ]);
      if (latestRes.data.report) {
        setReport(latestRes.data.report);
        setDate(new Date(latestRes.data.date).toLocaleString());
      }
      setHistory(historyRes.data);
    } catch (err) { console.error('Error coach data:', err); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  const loadReport = async (reportId) => {
    try {
      setLoading(true);
      const res = await api.get(`/api/coach/report/${reportId}`);
      setReport(res.data.report);
      setDate(new Date(res.data.date).toLocaleString());
      if (window.innerWidth < 1024) setSidebarOpen(false);
    } catch (err) { console.error('Error:', err); toast.error('Error al cargar el informe'); }
    finally { setLoading(false); }
  };

  const handleGenerateReport = async () => {
    try {
      setGenerating(true);
      const res = await api.post('/api/coach/generate-report');
      if (res.data.report) {
        setReport(res.data.report);
        setDate(new Date().toLocaleString());
        const historyRes = await api.get('/api/coach/history');
        setHistory(historyRes.data);
      }
    } catch (err) { console.error('Error:', err); toast.error('Error al generar el informe'); }
    finally { setGenerating(false); }
  };

  const getReportTitle = (content) => {
    if (!content) return "Informe";
    const match = content.match(/^# (.*)/m);
    return match ? match[1] : "Análisis Semanal";
  };

  return (
    <div className="flex h-[calc(100vh-120px)] -mt-2 -mx-4 sm:-mx-6 lg:-mx-8 overflow-hidden bg-white dark:bg-gray-900">
      {/* Sidebar Historial */}
      <div className={`${sidebarOpen ? 'w-80' : 'w-0'} bg-gray-50 dark:bg-gray-800/50 border-r border-gray-200 dark:border-gray-700 flex flex-col transition-all duration-300 relative z-20`}>
        <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex flex-col gap-4 bg-white dark:bg-gray-800">
          <div className="flex items-center justify-between">
            <h2 className="font-black text-gray-900 dark:text-white uppercase tracking-tighter text-lg flex items-center gap-2"><History className="h-5 w-5 text-indigo-600" /> Historial</h2>
            <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-gray-400"><ChevronLeft size={20}/></button>
          </div>
          <button onClick={handleGenerateReport} disabled={generating} className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-xl font-bold shadow-lg shadow-indigo-500/20 transition-all disabled:opacity-50 active:scale-95 text-sm">
            {generating ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Nuevo Informe
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          {history.map((item) => {
            const dateObj = new Date(item.date);
            // Get a snippet of the report (skipping the main title #)
            const snippet = item.report ? item.report.replace(/^# .*\n?/, '').slice(0, 60).replace(/\n/g, ' ') + '...' : '';
            
            return (
              <button key={item.id} onClick={() => loadReport(item.id)} className="w-full text-left p-4 rounded-xl hover:bg-white dark:hover:bg-gray-800 transition-all group border border-transparent hover:border-gray-200 dark:hover:border-gray-700 shadow-sm hover:shadow-md">
                <p className="text-xs font-black text-gray-900 dark:text-white mb-1 group-hover:text-indigo-600 capitalize">
                  {format(dateObj, "eeee, d 'de' MMMM", { locale: es })}
                </p>
                <p className="text-[10px] text-gray-500 line-clamp-2 leading-relaxed">
                  {snippet}
                </p>
                <div className="mt-2 text-[9px] text-gray-400 font-bold uppercase tracking-tighter">
                  {format(dateObj, "HH:mm")}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Area Principal */}
      <div className="flex-1 flex flex-col relative overflow-hidden bg-white dark:bg-gray-900">
        {!sidebarOpen && <button onClick={() => setSidebarOpen(true)} className="absolute left-4 top-4 z-10 p-2.5 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 text-indigo-600"><History className="h-5 w-5" /></button>}
        <div className="flex-1 overflow-y-auto">
          {loading && !generating ? (
            <div className="h-full flex flex-col items-center justify-center p-20"><RefreshCw className="h-10 w-10 text-indigo-600 animate-spin mb-4" /><p className="text-sm font-bold text-gray-400 uppercase tracking-widest">Cargando Análisis...</p></div>
          ) : report ? (
            <div className="max-w-4xl mx-auto w-full px-6 sm:px-10 py-12 lg:py-20 text-gray-900 dark:text-white">
              <div className="mb-12 flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-8 border-b border-gray-100 dark:border-gray-800">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-indigo-600 rounded-2xl text-white shadow-lg"><Bot className="h-6 w-6" /></div>
                  <div><h2 className="text-sm font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400">Coach Virtual rIAcardo</h2><p className="text-xs text-gray-400 font-bold flex items-center gap-1.5 mt-0.5"><Clock className="h-3 w-3" /> Generado el {date}</p></div>
                </div>
                {generating && <div className="flex items-center gap-2 px-4 py-2 bg-indigo-50 dark:bg-indigo-900/30 rounded-full border border-indigo-100 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 animate-pulse text-xs font-bold"><RefreshCw className="h-3 w-3 animate-spin" /> Analizando nuevos datos...</div>}
              </div>
              <article className="prose dark:prose-invert max-w-none antialiased"><ReactMarkdown remarkPlugins={[remarkGfm]} components={MarkdownComponents}>{report}</ReactMarkdown></article>
              <div className="mt-20 pt-10 border-t text-center"><div className="inline-flex items-center gap-2 px-4 py-2 bg-gray-50 dark:bg-gray-800 rounded-full border text-gray-400 text-[10px] font-bold uppercase tracking-widest"><Sparkles className="h-3 w-3 text-yellow-500" /> Inteligencia Artificial</div></div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center p-20 text-center"><div className="p-6 bg-gray-50 dark:bg-gray-800 rounded-[2.5rem] border border-dashed border-gray-200 dark:border-gray-700 mb-6"><Bot className="h-16 w-16 text-gray-200 mx-auto" /></div><h3 className="text-xl font-black mb-2">Coach rIAcardo</h3><p className="text-sm text-gray-400 font-medium">Pulsa "Nueva Consulta" para recibir un análisis.</p></div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Coach;
