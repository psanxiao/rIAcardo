import { Calculator, Zap, Activity } from 'lucide-react';
import { SectionCard } from '../ui';

const ZoneEditor = ({ zones, zoneType, onZoneChange, onAutoCalculate }) => {
  const isPower = zoneType === 'power';
  const accentClass = isPower
    ? 'bg-orange-50 dark:bg-orange-900/10'
    : 'bg-red-50 dark:bg-red-900/10';
  const title = isPower ? 'Zonas de Potencia' : 'Zonas de Pulso';
  const unit = isPower ? 'W' : 'bpm';
  const btnClass = isPower
    ? 'text-orange-700 bg-orange-100 hover:bg-orange-200 dark:bg-orange-900/30 dark:text-orange-400'
    : 'text-red-700 bg-red-100 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400';
  const IconComp = isPower ? Zap : Activity;

  return (
    <SectionCard icon={IconComp} title={title} accentClass={accentClass} className="border-gray-200 dark:border-gray-700">
      <div className="p-4 overflow-x-auto">
        <div className="flex justify-end mb-3">
          <button
            type="button"
            onClick={onAutoCalculate}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-md transition-colors uppercase tracking-wider ${btnClass}`}
          >
            <Calculator className="h-3.5 w-3.5" />
            Auto-calcular
          </button>
        </div>
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 dark:text-gray-400 border-b dark:border-gray-700">
              <th className="pb-2 font-medium uppercase text-[10px]">Zona</th>
              <th className="pb-2 font-medium uppercase text-[10px]">Min ({unit})</th>
              <th className="pb-2 font-medium uppercase text-[10px]">Max ({unit})</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {zones.map((zone, i) => (
              <tr key={zone.name}>
                <td className="py-3 pr-4">
                  <span className="font-bold text-gray-900 dark:text-white">{zone.name}</span>
                  <div className="text-[10px] text-gray-500 dark:text-gray-400 leading-tight">{zone.label}</div>
                </td>
                <td className="py-2 pr-4">
                  <input
                    type="number"
                    value={zone.min}
                    onChange={(e) => onZoneChange(zoneType, i, 'min', e.target.value)}
                    className="w-20 text-sm border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white py-1 px-2 border"
                  />
                </td>
                <td className="py-2">
                  <input
                    type="number"
                    value={zone.max}
                    onChange={(e) => onZoneChange(zoneType, i, 'max', e.target.value)}
                    className="w-20 text-sm border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white py-1 px-2 border"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SectionCard>
  );
};

export default ZoneEditor;