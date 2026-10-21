import { SectionCard } from '../ui';

const ActivitySummary = ({ groups }) => (
  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
    {groups.filter(({ rows }) => rows.length > 0).map(({ title, icon, rows }) => (
      <SectionCard key={title} title={title} icon={icon}>
        <dl className="px-5 py-1">
          {rows.map(([label, value]) => (
            <div
              key={label}
              className="flex items-baseline justify-between gap-3 py-2.5 border-b border-gray-100 dark:border-gray-700 last:border-0"
            >
              <dt className="text-sm text-gray-500 dark:text-gray-400">{label}</dt>
              <dd className="text-sm font-semibold text-gray-900 dark:text-white text-right">{value}</dd>
            </div>
          ))}
        </dl>
      </SectionCard>
    ))}
  </div>
);

export default ActivitySummary;
