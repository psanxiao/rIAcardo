import { 
  Info, 
  TrendingUp, 
  Activity, 
  Zap, 
  Target, 
  Battery, 
  Heart,
  BarChart3,
  BookOpen
} from 'lucide-react';

const Help = () => {
  const sections = [
    {
      id: 'load',
      title: 'Gestión de la Carga (Modelo Banister / Coggan)',
      icon: TrendingUp,
      content: (
        <div className="space-y-4">
          <p>
            La aplicación utiliza el modelo de <strong>Gestión del Rendimiento (PMC)</strong> desarrollado originalmente por el Dr. Eric Banister y popularizado por Andrew Coggan. Este modelo se basa en el seguimiento de tres métricas clave:
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
              <h4 className="font-bold text-blue-700 dark:text-blue-400 mb-1">CTL (Fitness)</h4>
              <p className="text-xs">Chronic Training Load. Es una media ponderada exponencial de los últimos 42 días. Representa tu estado de forma acumulado.</p>
            </div>
            <div className="bg-pink-50 dark:bg-pink-900/20 p-4 rounded-lg">
              <h4 className="font-bold text-pink-700 dark:text-pink-400 mb-1">ATL (Fatiga)</h4>
              <p className="text-xs">Acute Training Load. Media ponderada de los últimos 7 días. Representa la carga inmediata y el cansancio acumulado.</p>
            </div>
            <div className="bg-orange-50 dark:bg-orange-900/20 p-4 rounded-lg">
              <h4 className="font-bold text-orange-700 dark:text-orange-400 mb-1">TSB (Forma)</h4>
              <p className="text-xs">Training Stress Balance. La resta entre CTL y ATL. Valores positivos indican frescura; negativos, carga de entrenamiento.</p>
            </div>
          </div>
          <div className="mt-4 p-4 bg-gray-100 dark:bg-gray-800 rounded-lg">
            <p className="text-xs font-mono text-center">CTL_today = CTL_yesterday + (TSS_today - CTL_yesterday) / 42</p>
          </div>
        </div>
      )
    },
    {
      id: 'tss',
      title: 'Métricas de Intensidad (TSS, NP, IF)',
      icon: Zap,
      content: (
        <div className="space-y-4">
          <p>
            Estas métricas permiten cuantificar el estrés de una sesión basándose en la potencia y la fisiología humana:
          </p>
          <ul className="list-disc ml-6 space-y-2">
            <li>
              <strong>NP (Potencia Normalizada):</strong> Estimación de la potencia que el atleta podría haber mantenido si el esfuerzo hubiera sido constante. Penaliza las variaciones bruscas de intensidad elevando los valores a la cuarta potencia.
            </li>
            <li>
              <strong>IF (Intensity Factor):</strong> Relación entre la NP y tu FTP (Umbral de Potencia Funcional). Un IF de 1.0 indica un esfuerzo equivalente a tu máximo en una hora.
            </li>
            <li>
              <strong>TSS (Training Stress Score):</strong> Fórmula maestra que combina duración e intensidad para dar un valor numérico al estrés de la sesión.
            </li>
          </ul>
          <div className="mt-2 p-4 bg-gray-100 dark:bg-gray-800 rounded-lg">
            <p className="text-xs font-mono text-center">TSS = [(sec * NP * IF) / (FTP * 3600)] * 100</p>
          </div>
        </div>
      )
    },
    {
      id: 'wprime',
      title: 'Capacidad Anaeróbica (Modelo W\')',
      icon: Battery,
      content: (
        <div className="space-y-4">
          <p>
            El <strong>W\' (W-prime)</strong>, basado en el modelo de Potencia Crítica de <strong>Monod y Scherrer</strong>, representa la cantidad finita de energía (en Julios) disponible para realizar trabajo por encima del umbral (FTP).
          </p>
          <p>
            Es análogo a una batería: se descarga cuando superas tu FTP y se recarga cuando pedaleas por debajo de él. Valores altos (&gt;300 J/kg) indican un perfil de corredor muy explosivo o sprinter.
          </p>
          <div className="mt-2 p-4 bg-gray-100 dark:bg-gray-800 rounded-lg">
            <p className="text-xs font-mono text-center">W\' = (P_máx - FTP) * Tiempo</p>
          </div>
        </div>
      )
    },
    {
      id: 'efficiency',
      title: 'Eficiencia y Deriva Cardíaca',
      icon: Activity,
      content: (
        <div className="space-y-4">
          <p>
            Para evaluar la salud del sistema cardiovascular y la resistencia de base, utilizamos dos métricas avanzadas:
          </p>
          <ul className="list-disc ml-6 space-y-2">
            <li>
              <strong>EF (Efficiency Factor):</strong> Relación entre la NP y la frecuencia cardíaca media. Si el EF sube con el tiempo para el mismo tipo de entreno, tu motor aeróbico es más eficiente.
            </li>
            <li>
              <strong>Deriva Cardíaca (Pa:Hr):</strong> Compara la relación potencia/pulso de la primera mitad de la sesión con la segunda mitad. Una deriva &gt;5% en Zona 2 indica fatiga aeróbica o deshidratación.
            </li>
          </ul>
        </div>
      )
    }
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12">
      <div className="flex items-center gap-4 border-b border-gray-200 dark:border-gray-700 pb-6">
        <div className="p-3 bg-indigo-600 text-white rounded-xl">
          <BookOpen className="h-8 w-8" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Base de Conocimiento</h1>
          <p className="text-gray-600 dark:text-gray-400">Rigor científico y metodología de análisis en rIAcardo</p>
        </div>
      </div>

      <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/30 p-6 rounded-2xl">
        <div className="flex gap-4">
          <Info className="h-6 w-6 text-amber-600 shrink-0 mt-1" />
          <div>
            <h3 className="font-bold text-amber-900 dark:text-amber-400">Sobre nuestra metodología</h3>
            <p className="text-sm text-amber-800 dark:text-amber-500/80 leading-relaxed mt-1">
              Todos los cálculos realizados en esta plataforma se basan en modelos de fisiología del ejercicio validados por la comunidad científica internacional. Utilizamos estándares de la industria basados en las investigaciones de Andrew Coggan y el modelo de Potencia Crítica (Skiba/Monod).
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {sections.map((section) => {
          const Icon = section.icon;
          return (
            <div key={section.id} className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
              <div className="p-6 border-b border-gray-50 dark:border-gray-700/50 bg-gray-50/30 dark:bg-gray-800/50 flex items-center gap-3">
                <Icon className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">{section.title}</h2>
              </div>
              <div className="p-6 text-gray-700 dark:text-gray-300 leading-relaxed">
                {section.content}
              </div>
            </div>
          );
        })}
      </div>

      <div className="text-center pt-8 border-t border-gray-200 dark:border-gray-700">
        <p className="text-sm text-gray-500 italic">
          "In God we trust, all others must bring data." — W. Edwards Deming
        </p>
      </div>
    </div>
  );
};

export default Help;
