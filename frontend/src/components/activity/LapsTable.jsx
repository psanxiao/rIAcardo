import { formatDuration, formatDistanceKm, formatSpeedKmh, formatPace, formatBpm } from '../../utils/format';

const LapsTable = ({ laps, isRunning }) => {
  if (!laps || laps.length === 0) return null;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
      <div className="p-5 border-b border-gray-100 dark:border-gray-700">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white">Vueltas (Laps)</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead className="bg-gray-50 dark:bg-gray-700/50 text-xs uppercase text-gray-500 dark:text-gray-400">
            <tr>
              <th className="px-6 py-3">#</th>
              <th className="px-6 py-3">Tiempo</th>
              <th className="px-6 py-3">Distancia</th>
              <th className="px-6 py-3">{isRunning ? 'Ritmo' : 'Velocidad'}</th>
              <th className="px-6 py-3">FC Media</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700 text-sm">
            {laps.map((lap) => (
              <tr key={lap.number} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">{lap.number}</td>
                <td className="px-6 py-4">{formatDuration(lap.duration_min * 60)}</td>
                <td className="px-6 py-4">{formatDistanceKm(lap.distance_km)} km</td>
                <td className="px-6 py-4">{isRunning ? `${formatPace(lap.avg_speed / 3.6)} /km` : `${formatSpeedKmh(lap.avg_speed)} km/h`}</td>
                <td className="px-6 py-4">{formatBpm(lap.avg_hr)} bpm</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default LapsTable;