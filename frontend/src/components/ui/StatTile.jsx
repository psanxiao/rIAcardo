const StatTile = ({ label, value, subValue, accent = 'text-gray-900 dark:text-white', className = '' }) => {
  return (
    <div className={`bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 ${className}`}>
      <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-tighter mb-1">{label}</p>
      <p className={`text-xl font-black ${accent}`}>{value}</p>
      {subValue && <p className="text-[10px] text-gray-400 mt-1">{subValue}</p>}
    </div>
  );
};

export default StatTile;