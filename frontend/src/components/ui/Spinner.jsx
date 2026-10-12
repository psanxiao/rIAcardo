const Spinner = ({ size = 'h-12 w-12', className = '' }) => {
  return (
    <div className={`flex items-center justify-center ${className}`}>
      <div className={`animate-spin rounded-full ${size} border-b-2 border-indigo-600`}></div>
    </div>
  );
};

export default Spinner;