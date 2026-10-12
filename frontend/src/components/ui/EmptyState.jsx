const EmptyState = ({ icon: Icon, title, description, children }) => {
  return (
    <div className="flex flex-col items-center justify-center text-center p-12">
      {Icon && <Icon className="h-8 w-8 text-gray-300 dark:text-gray-600 mb-3" />}
      {title && <p className="text-sm text-gray-400 font-medium">{title}</p>}
      {description && (
        <p className="text-sm text-gray-400 max-w-[200px] mt-1">{description}</p>
      )}
      {children}
    </div>
  );
};

export default EmptyState;