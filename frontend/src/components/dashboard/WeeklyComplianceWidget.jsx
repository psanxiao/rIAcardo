import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { Link } from 'react-router-dom';
import { CheckCircle2, ChevronLeft, ChevronRight, RefreshCw, Sparkles, AlertCircle, ArrowRight } from 'lucide-react';

const WeeklyComplianceWidget = ({ complianceData, loadingCompliance, onPrevWeek, onNextWeek }) => {
  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <CheckCircle2 className="h-5 w-5 text-indigo-600" />
          <h2 className="font-bold text-gray-900 dark:text-white">Cumplimiento de Carga Semanal</h2>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={onPrevWeek} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors text-gray-500"><ChevronLeft className="h-5 w-5" /></button>
          <span className="text-xs font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
            {complianceData ? `${format(parseISO(complianceData.start_date), 'dd MMM', {locale: es})} - ${format(parseISO(complianceData.end_date), 'dd MMM', {locale: es})}` : 'Cargando...'}
          </span>
          <button onClick={onNextWeek} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors text-gray-500"><ChevronRight className="h-5 w-5" /></button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center relative">
        {loadingCompliance && (
          <div className="absolute inset-0 bg-white/50 dark:bg-gray-800/50 z-10 flex items-center justify-center backdrop-blur-[1px] rounded-xl">
            <RefreshCw className="h-6 w-6 text-indigo-600 animate-spin" />
          </div>
        )}
        <div className="space-y-4">
          <div className="flex justify-between items-end">
            <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-tighter">TSS Realizado / Planificado</span>
            <span className="text-2xl font-black text-indigo-600">{Math.round(complianceData?.actual_tss || 0)} <span className="text-sm font-normal text-gray-400">/ {Math.round(complianceData?.planned_tss || 0)}</span></span>
          </div>
          <div className="h-4 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden flex">
            <div className="h-full bg-indigo-600 transition-all duration-500" style={{ width: `${Math.min(complianceData?.compliance_pct || 0, 100)}%` }}></div>
            {(complianceData?.compliance_pct || 0) > 100 && <div className="h-full bg-indigo-400 animate-pulse" style={{ width: `${Math.min((complianceData?.compliance_pct || 0) - 100, 100)}%` }}></div>}
          </div>
        </div>
        <div className="flex justify-around text-center border-l border-gray-100 dark:border-gray-700">
          <div>
            <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase mb-1 tracking-tighter">Estado de la Semana</p>
            {complianceData?.compliance_pct >= 90 && complianceData?.compliance_pct <= 110 ? <div className="text-green-600 font-bold flex items-center gap-1 text-sm"><CheckCircle2 className="h-4 w-4"/> En objetivo</div> :
             complianceData?.compliance_pct > 110 ? <div className="text-orange-500 font-bold flex items-center gap-1 text-sm"><Sparkles className="h-4 w-4"/> Carga extra</div> :
             <div className="text-red-400 font-bold flex items-center gap-1 text-sm"><AlertCircle className="h-4 w-4"/> Bajo el plan</div>}
          </div>
          <div>
            <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase mb-1 tracking-tighter">Cumplimiento</p>
            <p className="text-2xl font-black text-gray-900 dark:text-white">{Math.round(complianceData?.compliance_pct || 0)}%</p>
          </div>
        </div>
      </div>

      {complianceData && (
        <div className="mt-6 pt-4 border-t border-gray-100 dark:border-gray-700 flex justify-end">
          <Link
            to={`/semana?date=${complianceData.start_date}`}
            className="text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
          >
            Ver resumen completo de la semana <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      )}
    </div>
  );
};

export default WeeklyComplianceWidget;