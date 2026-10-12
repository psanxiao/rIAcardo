import ReactMarkdown from 'react-markdown';
import { Bot, ChevronRight } from 'lucide-react';

const CoachAnalysisReport = ({ analyzing, analysis, showAnalysis, onToggleShow }) => {
  if (analyzing) {
    return (
      <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800/50 p-8 rounded-2xl flex flex-col items-center justify-center gap-4 animate-pulse">
        <div className="p-3 bg-white dark:bg-gray-800 rounded-full shadow-lg">
          <Bot className="h-8 w-8 text-indigo-600 animate-bounce" />
        </div>
        <div className="text-center">
          <p className="font-bold text-indigo-900 dark:text-indigo-300">El Entrenador IA está revisando tus vatios...</p>
          <p className="text-xs text-indigo-600/70 dark:text-indigo-400/70 mt-1">Esto puede tardar unos segundos</p>
        </div>
      </div>
    );
  }

  if (!analysis) return null;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-indigo-100 dark:border-indigo-900/30 overflow-hidden transition-all duration-300">
      <button onClick={onToggleShow} className="w-full p-4 sm:px-6 flex items-center justify-between hover:bg-indigo-50/30 transition-colors">
        <div className="flex items-center gap-3">
          <Bot className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">Informe del Entrenador IA</h2>
        </div>
        <ChevronRight className={`h-5 w-5 text-gray-400 transition-transform duration-300 ${showAnalysis ? 'rotate-90' : ''}`} />
      </button>
      {showAnalysis && (
        <div className="p-6 sm:p-8 pt-0 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-5">
            <Bot className="h-32 w-32" />
          </div>
          <div className="prose dark:prose-invert max-w-none prose-sm sm:prose-base prose-indigo border-t border-indigo-50 dark:border-indigo-900/20 pt-6">
            <ReactMarkdown>{analysis}</ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  );
};

export default CoachAnalysisReport;