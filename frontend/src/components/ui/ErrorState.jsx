import { AlertCircle } from 'lucide-react';

const ErrorState = ({ message = 'Ha ocurrido un error', onRetry }) => {
  return (
    <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg text-red-700 dark:text-red-400 flex items-center gap-3">
      <AlertCircle className="h-5 w-5 flex-shrink-0" />
      <div className="flex-1">
        <p className="text-sm font-medium">{message}</p>
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="text-xs font-bold underline hover:text-red-800 dark:hover:text-red-300"
        >
          Reintentar
        </button>
      )}
    </div>
  );
};

export default ErrorState;