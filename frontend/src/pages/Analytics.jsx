import { useState, useEffect } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  LineController,
  BarController,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Line, Bar, Doughnut, Chart } from 'react-chartjs-2';
import api from '../services/api';
import { Spinner } from '../components/ui';
import { Activity, Zap, TrendingUp, CheckCircle2, HelpCircle, Wind, Clock, BarChart3, Heart } from 'lucide-react';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  LineController,
  BarController,
  Title,
  Tooltip,
  Legend,
  Filler
);

const Analytics = () => {
  const [period, setPeriod] = useState(() => parseInt(localStorage.getItem('analytics_period') || '6'));
  const [grouping, setGrouping] = useState('week');
  const [trainingLoad, setTrainingLoad] = useState(null);
  const [mmpData, setMmpData] = useState(null);
  const [intensityDist, setIntensityDist] = useState(null);
  const [vo2maxData, setVo2maxData] = useState(null);
  const [volumeData, setVolumeData] = useState(null);
  const [efData, setEfData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingVolume, setLoadingVolume] = useState(false);
  const [, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setLoadingVolume(true);
      
      const loadData = async (url, setter) => {
        try { const res = await api.get(url); setter(res.data); } 
        catch (err) { console.error(`Error loading ${url}:`, err); }
      };

      try {
        await Promise.all([
          loadData(`/api/analysis/training-load?months=${period}`, setTrainingLoad),
          loadData(`/api/analysis/mmp-curve?months=${period}`, setMmpData),
          loadData(`/api/analysis/intensity-distribution?months=${period}`, setIntensityDist),
          loadData(`/api/analysis/vo2max-history?months=${period}`, setVo2maxData),
          loadData(`/api/analysis/efficiency-factor?months=${period}`, setEfData),
          loadData(`/api/analysis/volume?months=${period}&grouping=${grouping}`, (data) => {
            setVolumeData(data);
            setLoadingVolume(false);
          })
        ]);
        setError(null);
      } catch {
        setError('Error al cargar algunos datos de análisis.');
      } finally {
        setLoading(false);
        setLoadingVolume(false);
      }
    };
    fetchData();
  }, [period, grouping]);

  if (loading && !trainingLoad) return <Spinner className="h-64" />;

  const zoneColors = [
    'rgba(156, 163, 175, 0.8)', 'rgba(59, 130, 246, 0.8)', 'rgba(34, 197, 94, 0.8)', 
    'rgba(234, 179, 8, 0.8)', 'rgba(249, 115, 22, 0.8)', 'rgba(239, 68, 68, 0.8)', 'rgba(153, 27, 27, 0.8)'
  ];

  const commonOptions = {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { position: 'top', align: 'end', labels: { boxWidth: 10, font: { size: 10 } } } },
    scales: { x: { grid: { display: false }, ticks: { font: { size: 9 } } }, y: { grid: { color: 'rgba(156, 163, 175, 0.1)' }, ticks: { font: { size: 9 } } } }
  };

  const pmcData = {
    labels: trainingLoad?.dates || [],
    datasets: [
      { label: 'CTL (Fitness)', data: trainingLoad?.ctl || [], borderColor: 'rgb(59, 130, 246)', backgroundColor: 'rgba(59, 130, 246, 0.1)', borderWidth: 2, pointRadius: 0, fill: true, tension: 0.4, yAxisID: 'y' },
      { label: 'ATL (Fatiga)', data: trainingLoad?.atl || [], borderColor: 'rgb(236, 72, 153)', borderWidth: 1.5, pointRadius: 0, tension: 0.4, yAxisID: 'y' },
      { label: 'TSB (Forma)', data: trainingLoad?.tsb || [], borderColor: 'rgb(249, 115, 22)', borderWidth: 1, pointRadius: 0, fill: false, tension: 0.4, yAxisID: 'y1' }
    ]
  };

  const pmcOptions = {
    ...commonOptions,
    interaction: { mode: 'index', intersect: false },
    scales: {
      ...commonOptions.scales,
      y1: { type: 'linear', position: 'right', grid: { drawOnChartArea: false }, title: { display: true, text: 'TSB', font: { size: 10 } } },
      y: { ...commonOptions.scales.y, title: { display: true, text: 'Carga', font: { size: 10 } } }
    }
  };

  const efChartData = {
    labels: efData?.dates || [],
    datasets: [
      {
        label: 'EF Diario',
        data: efData?.values || [],
        borderColor: 'rgba(139, 92, 246, 0.3)',
        backgroundColor: 'transparent',
        borderWidth: 1,
        pointRadius: 2,
        tension: 0.3
      },
      {
        label: 'Tendencia',
        data: efData?.trend || [],
        borderColor: 'rgb(139, 92, 246)',
        backgroundColor: 'rgba(139, 92, 246, 0.1)',
        borderWidth: 3,
        pointRadius: 0,
        fill: true,
        tension: 0.4
      }
    ]
  };

  const tssVolumeData = {
    labels: volumeData?.labels || [],
    datasets: [{ label: 'TSS Total', data: volumeData?.tss || [], backgroundColor: 'rgba(249, 115, 22, 0.7)', borderRadius: 4 }]
  };

  const hoursVolumeData = {
    labels: volumeData?.labels || [],
    datasets: [{ label: 'Horas Totales', data: volumeData?.hours || [], backgroundColor: 'rgba(59, 130, 246, 0.7)', borderRadius: 4 }]
  };

  const createDonutData = (dist, label) => {
    if (!dist) return null;
    const labels = Object.keys(dist);
    return {
      labels: labels,
      datasets: [{ label: label, data: labels.map(z => dist[z].pct), backgroundColor: zoneColors.slice(0, labels.length), borderWidth: 0, hoverOffset: 4 }]
    };
  };

  const donutOptions = (title) => ({
    responsive: true, maintainAspectRatio: false,
    plugins: {
      legend: { position: 'right', labels: { boxWidth: 10, font: { size: 10 } } },
      title: { display: true, text: title, font: { size: 12, weight: 'bold' } },
      tooltip: { callbacks: { label: (context) => ` ${context.label}: ${context.raw}%` } }
    },
    cutout: '65%'
  });

  const getRiderProfile = () => {
    if (!mmpData?.mmp_curve || !mmpData?.weight) return null;
    const weight = mmpData.weight;
    const p1s = (mmpData.mmp_curve['1s'] || 0) / weight;
    const p1m = (mmpData.mmp_curve['1min'] || 0) / weight;
    const p5m = (mmpData.mmp_curve['5min'] || 0) / weight;
    const p20m = (mmpData.mmp_curve['20min'] || 0) / weight;
    const scores = { sprinter: p1s/14, puncheur: p1m/8, allrounder: p5m/5, tt: p20m/4 };
    const maxType = Object.keys(scores).reduce((a, b) => scores[a] > scores[b] ? a : b);
    const profiles = {
      sprinter: { title: "Sprinter", color: "text-orange-500", desc: "Destacas por tu explosividad y esfuerzos máximos de muy corta duración." },
      puncheur: { title: "Puncheur", color: "text-pink-500", desc: "Especialista en ataques explosivos de 1-2 minutos y muros cortos." },
      allrounder: { title: "Todoterreno", color: "text-green-500", desc: "Perfil equilibrado, capaz de defenderte bien en todos los terrenos." },
      tt: { title: "Rodador / Escalador", color: "text-blue-500", desc: "Sobresales en esfuerzos largos y sostenidos. Motor aeróbico fuerte." }
    };
    const profile = profiles[maxType];
    const wRel = (mmpData.w_prime_joules || 0) / weight;
    if (wRel > 0) {
      if (wRel < 150) profile.anaerobicNote = `Capacidad anaeróbica discreta (${Math.round(wRel)} J/kg). Perfil diésel.`;
      else if (wRel < 250) profile.anaerobicNote = `Reserva anaeróbica equilibrada (${Math.round(wRel)} J/kg).`;
      else if (wRel < 350) profile.anaerobicNote = `Punch sobresaliente (${Math.round(wRel)} J/kg). Capacidad explosiva.`;
      else profile.anaerobicNote = `Capacidad excepcional (${Math.round(wRel)} J/kg). Perfil de sprinter.`;
    }
    return profile;
  };

  const riderProfile = getRiderProfile();

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Análisis de Rendimiento</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">Estado de forma, potencia y volumen</p>
        </div>
        <div className="flex items-center gap-2 bg-white dark:bg-gray-800 p-1 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
          {[3, 6, 12, 24].map((m) => (
            <button key={m} onClick={() => { setPeriod(m); localStorage.setItem('analytics_period', m.toString()); }}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${period === m ? 'bg-indigo-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700'}`}
            >
              {m >= 12 ? `${m / 12} Año${m > 12 ? 's' : ''}` : `${m} Meses`}
            </button>
          ))}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: 'Fitness (CTL)', val: Math.round(trainingLoad?.current_ctl || 0), icon: TrendingUp, color: 'text-blue-600', bg: 'bg-blue-100' },
          { label: 'Fatiga (ATL)', val: Math.round(trainingLoad?.current_atl || 0), icon: Activity, color: 'text-pink-600', bg: 'bg-pink-100' },
          { label: 'Forma (TSB)', val: Math.round(trainingLoad?.current_tsb || 0), icon: Zap, color: (trainingLoad?.current_tsb >= 0 ? 'text-green-600' : 'text-red-600'), bg: 'bg-orange-100' },
          { label: 'VO2 Máx (Est.)', val: vo2maxData?.current || 0, icon: Wind, color: 'text-green-600', bg: 'bg-green-100', unit: 'mL/kg' }
        ].map((kpi, i) => (
          <div key={i} className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
            <div className="flex items-center gap-3 mb-2">
              <div className={`p-2 ${kpi.bg} dark:bg-opacity-20 rounded-lg ${kpi.color}`}><kpi.icon className="h-5 w-5" /></div>
              <h3 className="font-semibold text-gray-700 dark:text-gray-300 text-xs uppercase tracking-wider">{kpi.label}</h3>
            </div>
            <p className={`text-3xl font-black ${kpi.color}`}>{kpi.val} <span className="text-xs font-normal text-gray-400">{kpi.unit || ''}</span></p>
          </div>
        ))}
      </div>

      {/* Row 1: PMC - Full Width */}
      <div className="bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
        <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-4 tracking-wider flex items-center gap-2"><TrendingUp className="h-4 w-4"/> Performance Management Chart (PMC)</h3>
        <div className="h-[400px]"><Chart type="line" data={pmcData} options={pmcOptions} /></div>
      </div>

      {/* Row 2: Volume & Grouping */}
      <div className="space-y-4">
        <div className="flex justify-between items-center px-1">
          <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider flex items-center gap-2"><Zap className="h-4 w-4"/> Carga y Volumen</h3>
          <div className="flex items-center gap-2 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg border border-gray-200 dark:border-gray-700">
            <button onClick={() => { if (!loadingVolume) setGrouping('week'); }} disabled={loadingVolume} className={`px-3 py-1 text-[9px] font-bold uppercase rounded-md transition-all ${grouping === 'week' ? 'bg-white dark:bg-gray-700 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-gray-500'}`}>Semanal</button>
            <button onClick={() => { if (!loadingVolume) setGrouping('month'); }} disabled={loadingVolume} className={`px-3 py-1 text-[9px] font-bold uppercase rounded-md transition-all ${grouping === 'month' ? 'bg-white dark:bg-gray-700 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-gray-500'}`}>Mensual</button>
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 relative">
          {loadingVolume && <div className="absolute inset-0 bg-white/40 dark:bg-gray-900/40 z-10 flex items-center justify-center backdrop-blur-[1px] rounded-xl"><Spinner size="h-8 w-8" /></div>}
          <div className="bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700"><div className="h-[300px]"><Bar data={tssVolumeData} options={commonOptions} /></div></div>
          <div className="bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700"><div className="h-[300px]"><Bar data={hoursVolumeData} options={commonOptions} /></div></div>
        </div>
      </div>

      {/* Row 3: Intensity Distribution */}
      <div className="bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
        <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-6 tracking-wider flex items-center gap-2"><Activity className="h-4 w-4"/> Distribución de Intensidad del Periodo</h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="h-[280px]">{intensityDist?.power ? <Doughnut data={createDonutData(intensityDist.power, 'Potencia')} options={donutOptions('Zonas de Potencia')} /> : null}</div>
          <div className="h-[280px]">{intensityDist?.hr ? <Doughnut data={createDonutData(intensityDist.hr, 'FC')} options={donutOptions('Zonas de FC')} /> : null}</div>
        </div>
      </div>

      {/* Row 4: MMP & Profile */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
          <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-4 tracking-wider flex items-center gap-2"><BarChart3 className="h-4 w-4"/> Curva de Potencia (MMP)</h3>
          <div className="h-[350px]"><Line data={{
            labels: Object.keys(mmpData?.mmp_curve || {}),
            datasets: [
              { label: 'Histórica', data: Object.values(mmpData?.all_time_curve || {}), borderColor: 'rgba(156, 163, 175, 0.4)', borderDash: [5,5], pointRadius: 0, fill: false, order: 2 },
              { label: 'Actual', data: Object.values(mmpData?.mmp_curve || {}), borderColor: 'rgb(245, 158, 11)', backgroundColor: 'rgba(245, 158, 11, 0.1)', borderWidth: 2.5, fill: true, tension: 0.4, pointRadius: 2, order: 1 }
            ]
          }} options={{...commonOptions, plugins:{...commonOptions.plugins, tooltip:{...commonOptions.plugins.tooltip, mode:'index', intersect:false, callbacks:{
            label: (ctx) => {
              let label = ctx.dataset.label + ': ' + ctx.raw + 'W';
              if (ctx.dataset.label.includes('Histórica') && mmpData?.all_time_sources?.[ctx.label]) {
                const s = mmpData.all_time_sources[ctx.label];
                if (s.date) label += ` (${s.date})`;
              }
              return label;
            },
            afterLabel: (ctx) => (ctx.dataset.label.includes('Histórica') && mmpData?.all_time_sources?.[ctx.label]?.name !== "Actividad") ? `Actividad: ${mmpData.all_time_sources[ctx.label].name}` : ""
          }}}}} /></div>
        </div>
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
          <h3 className="text-lg font-bold mb-4">Perfil de Potencia</h3>
          {riderProfile && (
            <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-100 dark:border-gray-800 text-xs">
              <p className={`font-black uppercase tracking-widest ${riderProfile.color}`}>{riderProfile.title}</p>
              <p className="text-gray-500 mt-1">{riderProfile.desc}</p>
              {riderProfile.anaerobicNote && <p className="text-gray-400 italic mt-3 pt-3 border-t border-gray-200 dark:border-gray-800">{riderProfile.anaerobicNote}</p>}
            </div>
          )}
          <div className="space-y-3 text-sm">
            <div className="flex justify-between border-b border-gray-50 dark:border-gray-700 pb-2 group relative">
              <div className="flex items-center gap-1.5"><span className="text-gray-500">W' (Cap. Anaeróbica)</span><div className="relative group/tooltip"><HelpCircle className="h-3 w-3 text-gray-300 cursor-help"/><div className="absolute bottom-full left-0 mb-2 hidden group-hover/tooltip:block w-48 p-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded shadow-xl z-50 text-[10px] text-gray-900 dark:text-white"><p className="font-bold mb-1 border-b pb-1 text-gray-900 dark:text-white">W' (J/kg)</p><div className="space-y-1"><div>Diésel: &lt;150</div><div>Equilibrado: 150-250</div><div>Puncher: 250-350</div><div>Explosivo: &gt;350</div></div></div></div></div>
              <div className="text-right"><p className="font-bold">{mmpData?.w_prime_kj || 0} kJ</p><p className="text-[9px] text-gray-400">{mmpData?.w_prime_joules && mmpData?.weight ? `${Math.round(mmpData.w_prime_joules / mmpData.weight)} J/kg` : ''}</p></div>
            </div>
            <div className="flex justify-between border-b border-gray-50 dark:border-gray-700 pb-2 group relative">
              <div className="flex items-center gap-1.5"><span className="text-gray-500">FTP Relativo</span><div className="relative group/tooltip"><HelpCircle className="h-3 w-3 text-gray-300 cursor-help"/><div className="absolute bottom-full left-0 mb-2 hidden group-hover/tooltip:block w-48 p-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded shadow-xl z-50 text-[10px] text-gray-900 dark:text-white"><p className="font-bold mb-1 border-b pb-1 text-gray-900 dark:text-white">Nivel Coggan (W/kg)</p><div className="space-y-1"><div>World Class: &gt;5.6</div><div>Cat 1 (Elite): 4.8-5.6</div><div>Cat 2: 4.0-4.8</div><div>Cat 3: 3.2-4.0</div><div>Cat 4: 2.4-3.2</div></div></div></div></div>
              <span className="font-bold text-indigo-600">{(mmpData?.ftp / mmpData?.weight).toFixed(2)} w/kg</span>
            </div>
            {['1s', '1min', '5min', '20min'].map(k => (<div key={k} className="flex justify-between border-b border-gray-50 dark:border-gray-700 pb-2"><span className="text-gray-500">{k} Relativo</span><span className="font-bold">{(mmpData?.mmp_curve[k] / mmpData?.weight).toFixed(2)} w/kg</span></div>))}
          </div>
        </div>
      </div>

      {/* Row 5: EF Evolution - At the end */}
      <div className="bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider flex items-center gap-2">
              <Heart className="h-4 w-4"/> Evolución Eficiencia Aeróbica (EF)
            </h3>
            <p className="text-[10px] text-gray-400 mt-1">Mide cuántos vatios produces por cada latido del corazón. Una tendencia alcista indica un motor aeróbico más económico.</p>
          </div>
        </div>
        <div className="h-[300px]"><Chart type="line" data={efChartData} options={{...commonOptions, plugins: {...commonOptions.plugins, tooltip: { callbacks: { label: (c) => ` ${c.dataset.label}: ${c.raw} (NP: ${efData?.np?.[c.dataIndex]}W / HR: ${efData?.hr?.[c.dataIndex]}bpm)` }}}}} /></div>
      </div>
    </div>
  );
};

export default Analytics;
