import { Sparkles, TrendingUp } from 'lucide-react';

const ThresholdsDetectedBanner = ({ detectedMetrics }) => {
  if (!detectedMetrics || (!detectedMetrics.new_ftp && !detectedMetrics.new_lthr)) return null;

  return (
    <div className="bg-gradient-to-r from-indigo-600 to-violet-600 text-white p-6 rounded-2xl shadow-lg relative overflow-hidden mb-8">
      <div className="absolute top-0 right-0 p-4 opacity-20">
        <TrendingUp className="h-24 w-24" />
      </div>
      <div className="relative z-10">
        <div className="flex items-center gap-3 mb-2">
          <Sparkles className="h-6 w-6 text-yellow-300" />
          <h2 className="text-xl font-bold">¡Nuevos Umbrales Detectados!</h2>
        </div>
        <p className="text-indigo-100 text-sm mb-4">
          Tu rendimiento en esta sesión sugiere que tu condición física ha mejorado. Aquí están los valores estimados:
        </p>
        <div className="flex flex-wrap gap-10">
          {detectedMetrics.new_ftp && (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-indigo-200 font-bold mb-1">Nuevo FTP Estimado</p>
              <p className="text-3xl font-black">
                {detectedMetrics.new_ftp}W
                <span className="text-sm font-normal text-indigo-200 ml-2">(era {detectedMetrics.old_ftp}W)</span>
              </p>
              <p className="text-[9px] text-indigo-200 italic mt-1">Basado en modelo de {detectedMetrics.ftp_method}</p>
            </div>
          )}
          {detectedMetrics.new_lthr && (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-indigo-200 font-bold mb-1">Nuevo LTHR Estimado</p>
              <p className="text-3xl font-black">
                {detectedMetrics.new_lthr} bpm
                <span className="text-sm font-normal text-indigo-200 ml-2">(era {detectedMetrics.old_lthr} bpm)</span>
              </p>
              <p className="text-[9px] text-indigo-200 italic mt-1">Basado en modelo de {detectedMetrics.lthr_method}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ThresholdsDetectedBanner;