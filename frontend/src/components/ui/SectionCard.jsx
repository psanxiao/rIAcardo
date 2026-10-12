const SectionCard = ({ icon: Icon, title, subtitle, accentClass = '', children, className = '' }) => {
  return (
    <section className={`bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden ${className}`}>
      {title && (
        <div className={`p-4 border-b border-gray-100 dark:border-gray-700 flex items-center gap-2 ${accentClass}`}>
          {Icon && <Icon className="h-5 w-5" />}
          <h2 className="font-semibold text-gray-900 dark:text-white">{title}</h2>
          {subtitle && <span className="ml-auto text-[10px] text-gray-400">{subtitle}</span>}
        </div>
      )}
      {children}
    </section>
  );
};

export default SectionCard;