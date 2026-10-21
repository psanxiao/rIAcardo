import { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { formatDuration, formatDistance, formatSpeedKmh, formatPace, formatWatts, formatBpm, formatIF } from '../utils/format';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  LineController,
  BarController
} from 'chart.js';
import { Chart } from 'react-chartjs-2';
import { MapContainer, TileLayer, Polyline, useMap, CircleMarker } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import toast from 'react-hot-toast';
import api from '../services/api';
import { Spinner, SectionCard } from '../components/ui';
import CoachAnalysisReport from '../components/activity/CoachAnalysisReport';
import ThresholdsDetectedBanner from '../components/activity/ThresholdsDetectedBanner';
import LapsTable from '../components/activity/LapsTable';
import ZoneTimeChart from '../components/activity/ZoneTimeChart';
import RunningSplitsChart from '../components/activity/RunningSplitsChart';
import RunningInsights from '../components/activity/RunningInsights';
import ActivitySummary from '../components/activity/ActivitySummary';
import { movingAverage, computeGapPace, computeBestEfforts } from '../utils/running';
import {
  ArrowLeft,
  Calendar,
  Clock,
  MapPin,
  Zap,
  Activity,
  TrendingUp,
  Bot,
  Brain,
  Sparkles,
  RefreshCw,
  Trophy,
  Footprints
} from 'lucide-react';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  LineController,
  BarController,
  Title,
  Tooltip,
  Legend,
  Filler
);

const ChangeView = ({ bounds }) => {
  const map = useMap();
  const hasCentered = useRef(false);

  useEffect(() => {
    if (bounds && bounds.length > 0 && !hasCentered.current) {
      map.fitBounds(bounds, { padding: [20, 20] });
      hasCentered.current = true;
    }
  }, [bounds, map]);
  return null;
};

const ActivityDetail = () => {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [ignoringMmp, setIgnoringMmp] = useState(false);
  const [isUpdating, setIsIgnoringUpdate] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [showAnalysis, setShowAnalysis] = useState(false);
  
  const elevationChartRef = useRef(null);
  const mainChartRef = useRef(null);
  const hrChartRef = useRef(null);
  const cadenceChartRef = useRef(null);
  const markerRef = useRef(null);
  const mapRef = useRef(null);
  const lastSyncIndex = useRef(null);

  // formatDuration imported from utils/format

  // 1. Data Processing
  const { validRecords, path, hasMap, pathIndexByValidIndex, validIndexByPathIndex, isRunning, elevationData, chartData, cadenceData, powerZoneData, hrZoneData, wBalData, wPrimeEst, paceRange, gapPace, bestEfforts } = useMemo(() => {
    if (!data || !data.records) {
      return { validRecords: [], path: [], hasMap: false, pathIndexByValidIndex: [], validIndexByPathIndex: [], isRunning: false, elevationData: null, chartData: null, cadenceData: null, powerZoneData: null, hrZoneData: null, wBalData: null, wPrimeEst: null, paceRange: null, gapPace: null, bestEfforts: null };
    }
    const records = data.records;
    const valid = records.filter(r => r.distance !== null);
    const track = [];
    const pathIndexByValidIndex = [];
    const validIndexByPathIndex = [];
    valid.forEach((r, i) => {
      if (r.lat !== null && r.lng !== null) {
        pathIndexByValidIndex[i] = track.length;
        validIndexByPathIndex[track.length] = i;
        track.push([r.lat, r.lng]);
      }
    });

    // Zone colors
    const zoneColors = [
      'rgba(156, 163, 175, 0.8)', // Z1 Gray
      'rgba(59, 130, 246, 0.8)',  // Z2 Blue
      'rgba(34, 197, 94, 0.8)',   // Z3 Green
      'rgba(234, 179, 8, 0.8)',   // Z4 Yellow
      'rgba(249, 115, 22, 0.8)',  // Z5 Orange
      'rgba(239, 68, 68, 0.8)',   // Z6 Red
      'rgba(153, 27, 27, 0.8)',   // Z7 Dark Red
    ];

    const prepareZoneData = (zoneTimes, zoneRanges, label) => {
      if (!zoneTimes || Object.keys(zoneTimes).length === 0) return null;
      const sortedZones = Object.keys(zoneTimes).sort();
      return {
        labels: sortedZones.map(z => {
          const range = zoneRanges?.[z];
          return range ? `${z} (${range[0]}-${range[1] === 9999 ? '+' : range[1]})` : z;
        }),
        datasets: [{
          label: label,
          data: sortedZones.map(z => zoneTimes[z].min), 
          percentages: sortedZones.map(z => zoneTimes[z].pct), // Extra data for tooltip
          backgroundColor: zoneColors.slice(0, sortedZones.length),
          borderRadius: 4,
        }]
      };
    };
    
    const sport = (data.activity?.sport || data.sport || '').toLowerCase();
    const isRunning = sport.includes('run');
    const smoothedSpeed = isRunning ? movingAverage(valid.map(r => r.speed), 30) : [];
    const smoothedHr = isRunning ? movingAverage(valid.map(r => r.hr), 30) : [];
    const paces = smoothedSpeed.filter(Boolean).map(s => 60 / s).sort((a, b) => a - b);
    const paceRange = paces.length ? {
      min: paces[Math.floor(paces.length * 0.02)] - 0.3,
      max: paces[Math.min(paces.length - 1, Math.ceil(paces.length * 0.98))] + 0.3,
    } : null;

    return { 
      validRecords: valid, 
      path: track, 
      hasMap: track.length > 0,
      pathIndexByValidIndex,
      validIndexByPathIndex,
      isRunning,
      elevationData: {
        labels: valid.map(r => (r.distance / 1000).toFixed(1)),
        datasets: [{
          label: 'Altitud (m)',
          data: valid.map(r => r.altitude),
          borderColor: 'rgb(107, 114, 128)',
          backgroundColor: 'rgba(107, 114, 128, 0.1)',
          borderWidth: 1,
          pointRadius: 0,
          fill: true,
          tension: 0.1,
        }]
      },
      cadenceData: isRunning ? {
        labels: valid.map(r => (r.distance / 1000).toFixed(2)),
        datasets: [{
          label: 'Cadencia (spm)',
          data: movingAverage(valid.map(r => r.cadence), 30),
          borderColor: 'rgb(59, 130, 246)',
          borderWidth: 1.5,
          pointRadius: 0,
          tension: 0.3,
        }]
      } : null,
      chartData: isRunning ? {
        labels: valid.map(r => (r.distance / 1000).toFixed(2)),
        datasets: [
          {
            label: 'Ritmo (min/km)',
            data: smoothedSpeed.map(s => s ? 60 / s : null),
            borderColor: 'rgb(34, 197, 94)',
            borderWidth: 2,
            pointRadius: 0,
            fill: false,
            yAxisID: 'y',
            tension: 0.3,
          },
          {
            label: 'FC (bpm)',
            data: smoothedHr,
            borderColor: 'rgba(239, 68, 68, 0.8)',
            borderWidth: 1.5,
            pointRadius: 0,
            yAxisID: 'y1',
            tension: 0.3,
          }
        ]
      } : {
        labels: valid.map((_, i) => i),
        datasets: [
          {
            label: 'Potencia (W)',
            data: valid.map(r => r.power),
            borderColor: 'rgb(245, 158, 11)',
            backgroundColor: 'rgba(245, 158, 11, 0.1)',
            borderWidth: 1.5,
            pointRadius: 0,
            fill: true,
            yAxisID: 'y',
          },
          {
            label: 'FC (bpm)',
            data: valid.map(r => r.hr),
            borderColor: 'rgb(239, 68, 68)',
            borderWidth: 1.5,
            pointRadius: 0,
            yAxisID: 'y1',
          }
        ]
      },
      powerZoneData: prepareZoneData(data.time_in_power_zones, data.power_zone_ranges, 'Minutos en Zona Potencia'),
      hrZoneData: prepareZoneData(data.time_in_hr_zones, data.hr_zone_ranges, 'Minutos en Zona FC'),
      wBalData: data.w_bal_data && data.w_bal_data.length > 0 ? {
        labels: data.w_bal_data.map((_, i) => i),
        datasets: [{
          label: "W'bal",
          data: data.w_bal_data,
          borderColor: 'rgba(239, 68, 68, 0.8)',
          backgroundColor: (ctx) => {
            const { chart } = ctx;
            const { ctx: c, chartArea } = chart;
            if (!chartArea) return 'rgba(239, 68, 68, 0.1)';
            const gradient = c.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
            gradient.addColorStop(0, 'rgba(239, 68, 68, 0.25)');
            gradient.addColorStop(1, 'rgba(34, 197, 94, 0.05)');
            return gradient;
          },
          fill: true,
          pointRadius: 0,
          borderWidth: 1.5,
          tension: 0.3,
        }]
      } : null,
      wPrimeEst: data.w_prime_est,
      paceRange,
      gapPace: isRunning ? computeGapPace(records) : null,
      bestEfforts: isRunning ? computeBestEfforts(records) : null
    };
  }, [data]);

  // 2. High-Performance Sync Function
  const syncAll = (index) => {
    if (index === lastSyncIndex.current) return;
    lastSyncIndex.current = index;

    // Sync Charts
    [elevationChartRef.current, mainChartRef.current, hrChartRef.current, cadenceChartRef.current].forEach(chart => {
      if (!chart) return;
      if (index === null) {
        chart.setActiveElements([]);
        chart.tooltip.setActiveElements([], { x: 0, y: 0 });
      } else {
        chart.setActiveElements([{ datasetIndex: 0, index }]);
        chart.tooltip.setActiveElements([{ datasetIndex: 0, index }], { x: 0, y: 0 });
      }
      chart.update('none');
    });

    // Sync Map Marker
    if (markerRef.current) {
      const pos = index === null ? null : path[pathIndexByValidIndex[index]];
      if (!pos) {
        markerRef.current.setStyle({ opacity: 0, fillOpacity: 0 });
      } else {
        markerRef.current.setLatLng(pos);
        markerRef.current.setStyle({ opacity: 1, fillOpacity: 1 });
      }
    }
  };

  // 3. Handlers
  const findNearestIndex = (latlng) => {
    if (!path.length) return null;
    let minDistanceSq = Infinity;
    let nearestIndex = 0;
    for (let i = 0; i < path.length; i++) {
      const p = path[i];
      const dSq = Math.pow(p[0] - latlng.lat, 2) + Math.pow(p[1] - latlng.lng, 2);
      if (dSq < minDistanceSq) {
        minDistanceSq = dSq;
        nearestIndex = i;
      }
    }
    return nearestIndex;
  };

  const handleMapHover = (e) => {
    const pathIndex = findNearestIndex(e.latlng);
    syncAll(pathIndex === null ? null : validIndexByPathIndex[pathIndex]);
  };

  // 4. Effects
  useEffect(() => {
    const fetchDetail = async () => {
      try {
        setLoading(true);
        const res = await api.get(`/api/analysis/activity/${id}`);
        setData(res.data);
        setIgnoringMmp(res.data.activity.ignore_mmp || false);
        if (res.data.activity.coach_analysis) {
          setAnalysis(res.data.activity.coach_analysis);
        }
      } catch {
        setError('Error al cargar la actividad.');
      } finally {
        setLoading(false);
      }
    };
    fetchDetail();
  }, [id]);

  const handleToggleIgnoreMmp = async () => {
    try {
      setIsIgnoringUpdate(true);
      const newValue = !ignoringMmp;
      await api.patch(`/api/analysis/activity/${id}/mmp-settings?ignore_mmp=${newValue}`);
      setIgnoringMmp(newValue);
    } catch (err) {
      console.error('Error updating MMP settings:', err);
      toast.error('No se pudo actualizar la configuración de la actividad.');
    } finally {
      setIsIgnoringUpdate(false);
    }
  };

   const handleAnalyzeActivity = async () => {
    try {
      setAnalyzing(true);
      const res = await api.post(`/api/coach/analyze-activity/${id}`);
      setAnalysis(res.data.analysis);
      setShowAnalysis(true);
    } catch (err) {
      console.error('Error analyzing activity:', err);
      const errorMsg = err.response?.data?.detail || err.message || 'Error desconocido';
      toast.error(`Error en el análisis: ${errorMsg}`);
    } finally {
      setAnalyzing(false);
    }
  };

  const elevationOptions = {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    onHover: (event, elements) => {
      syncAll(elements.length > 0 ? elements[0].index : null);
    },
    interaction: { mode: 'index', intersect: false },
    plugins: { legend: { display: false }, tooltip: { mode: 'index', intersect: false } },
    scales: {
      x: { title: { display: true, text: 'Distancia (km)' }, ticks: { maxTicksLimit: 10 } },
      y: { title: { display: true, text: 'Altitud (m)' } }
    }
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    onHover: (event, elements) => {
      syncAll(elements.length > 0 ? elements[0].index : null);
    },
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { position: 'top' },
    },
    scales: {
      x: { display: false },
      y: { 
        type: 'linear', display: true, position: 'left', 
        reverse: isRunning,
        title: { display: true, text: isRunning ? 'Ritmo (min/km)' : 'Potencia (W)' } 
      },
      y1: { type: 'linear', display: true, position: 'right', grid: { drawOnChartArea: false }, title: { display: true, text: 'FC (bpm)' } },
    },
  };

  const syncOnHover = (event, elements) => {
    syncAll(elements.length > 0 ? elements[0].index : null);
  };

  const runningPanelOptions = (yScale, showX, formatValue) => ({
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    onHover: syncOnHover,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { position: 'top' },
      tooltip: {
        callbacks: {
          label: (ctx) => `${ctx.dataset.label}: ${formatValue(ctx.parsed.y)}`,
        },
      },
    },
    scales: {
      x: showX
        ? { ticks: { maxTicksLimit: 10 }, title: { display: true, text: 'Distancia (km)' } }
        : { display: false },
      y: { ...yScale, afterFit: (scale) => { scale.width = 60; } },
    },
  });

  const pacePanelOptions = runningPanelOptions({
    reverse: true,
    min: paceRange?.min,
    max: paceRange?.max,
    ticks: { callback: (v) => formatPace(1000 / (v * 60)) },
    title: { display: true, text: 'Ritmo (min/km)' },
  }, false, (v) => `${formatPace(1000 / (v * 60))} /km`);

  const hrPanelOptions = runningPanelOptions({
    ticks: { precision: 0 },
    title: { display: true, text: 'FC (bpm)' },
  }, false, (v) => `${Math.round(v)} bpm`);

  const cadencePanelOptions = runningPanelOptions({
    ticks: { precision: 0 },
    title: { display: true, text: 'Cadencia (spm)' },
  }, true, (v) => `${Math.round(v)} spm`);

  if (loading) return <Spinner className="h-64" />;
  if (error || !data) return <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg text-red-700 dark:text-red-400">{error || 'No encontrada'}</div>;

  const { activity, laps } = data;

  const garminCtx = data.enriched_context || {};
  const garminRows = [
    ...(garminCtx.temperature_avg_c != null
      ? [['Temp. media', `${Math.round(garminCtx.temperature_avg_c)} °C`]]
      : []),
    ...(isRunning && garminCtx.stride_length_m != null
      ? [['Zancada', `${Number(garminCtx.stride_length_m).toFixed(2)} m`]]
      : []),
    ...(isRunning && garminCtx.steps != null
      ? [['Pasos', Math.round(garminCtx.steps).toLocaleString('es-ES')]]
      : []),
  ];
  const pickGarmin = (labels) => garminRows.filter(([label]) => labels.includes(label));
  const movingTimeRows = activity.moving_time && activity.moving_time !== activity.duration_sec
    ? [['Tiempo Movimiento', formatDuration(activity.moving_time)]]
    : [];

  const volumeGroup = {
    title: 'Ruta',
    icon: MapPin,
    rows: [
      ['Distancia', `${formatDistance(activity.distance_km * 1000)} km`],
      ['Tiempo', formatDuration(activity.duration_sec)],
      ...movingTimeRows,
      ['Desnivel (+)', `${Math.round(activity.ascent_m || 0)} m`],
      ...pickGarmin(['Temp. media']),
    ],
  };

  const summaryGroups = isRunning ? [
    volumeGroup,
    {
      title: 'Ritmo y técnica',
      icon: Footprints,
      rows: [
        ['Ritmo Medio', `${formatPace(activity.avg_speed_ms || activity.avg_speed / 3.6)} /km`],
        ['FC Media', `${formatBpm(activity.avg_hr)} bpm`],
        ['Cadencia', `${Math.round(activity.avg_cadence || 0)} spm`],
        ...pickGarmin(['Zancada', 'Pasos']),
      ],
    },
    {
      title: 'Carga',
      icon: Activity,
      rows: [
        ['IF', formatIF(activity.if)],
        ['TSS', Math.round(activity.tss || 0)],
      ],
    },
  ] : [
    volumeGroup,
    {
      title: 'Potencia',
      icon: Zap,
      rows: [
        ['Potencia Media', `${formatWatts(activity.avg_power)} W`],
        ['P. Normalizada', `${formatWatts(activity.np)} W`],
        ['IF', formatIF(activity.if)],
        ['TSS', Math.round(activity.tss || 0)],
      ],
    },
    {
      title: 'Velocidad y FC',
      icon: Activity,
      rows: [
        ['Vel. Media', `${formatSpeedKmh(activity.avg_speed)} km/h`],
        ['Vel. Máxima', `${formatSpeedKmh(activity.max_speed)} km/h`],
        ['FC Media', `${formatBpm(activity.avg_hr)} bpm`],
        ['FC Máxima', `${formatBpm(activity.max_hr)} bpm`],
        ['Cadencia', `${Math.round(activity.avg_cadence || 0)} rpm`],
      ],
    },
  ];

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link to="/dashboard" className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors">
            <ArrowLeft className="h-6 w-6" />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white capitalize">
                {activity.raw_data?.name || activity.name || `Actividad ${activity.sport}`}
              </h1>
              {ignoringMmp && (
                <span className="px-2 py-0.5 text-[10px] font-bold bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 rounded uppercase tracking-wider">
                  Excluida de MMP
                </span>
              )}
            </div>
            <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400 mt-1">
              <span className="flex items-center gap-1.5"><Calendar className="h-4 w-4" />{new Date(activity.start_time).toLocaleString()}</span>
              <span className="flex items-center gap-1.5 capitalize"><Activity className="h-4 w-4" />{activity.sport}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleAnalyzeActivity}
            disabled={analyzing}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-semibold transition-all shadow-sm ${
              analyzing
                ? 'bg-indigo-100 text-indigo-400 cursor-wait'
                : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-200 dark:shadow-none'
            }`}
          >
            {analyzing ? (
              <>
                <Sparkles className="h-4 w-4 animate-spin" />
                Analizando...
              </>
            ) : analysis ? (
              <>
                <RefreshCw className="h-4 w-4" />
                Regenerar Análisis
              </>
            ) : (
              <>
                <Brain className="h-4 w-4" />
                Analizar con IA
              </>
            )}
          </button>

          <button
            onClick={handleToggleIgnoreMmp}
            disabled={isUpdating}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all shadow-sm ${
              ignoringMmp 
                ? 'bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800' 
                : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700 dark:hover:bg-gray-700'
            }`}
          >
            <Zap className={`h-4 w-4 ${ignoringMmp ? 'fill-current' : ''}`} />
            {isUpdating ? '...' : ignoringMmp ? 'Incluir' : 'Excluir'}
          </button>
        </div>
      </div>

      {ignoringMmp && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-lg flex items-start gap-3 dark:bg-amber-900/20 dark:border-amber-800 dark:text-amber-400">
          <Zap className="h-5 w-5 mt-0.5 flex-shrink-0" />
          <p className="text-sm">
            Esta actividad está siendo <strong>ignorada</strong> para los récords históricos de potencia (MMP). 
            Los valores de esta sesión no aparecerán en tu gráfica global de Analytics ni contarán para tus mejores marcas.
          </p>
        </div>
      )}

      <CoachAnalysisReport
        analyzing={analyzing}
        analysis={analysis}
        showAnalysis={showAnalysis}
        onToggleShow={() => setShowAnalysis(!showAnalysis)}
      />

      <ThresholdsDetectedBanner detectedMetrics={activity.detected_metrics} />

      <ActivitySummary groups={summaryGroups} />

      {isRunning && (
        <RunningInsights
          cardiacDriftPct={data.cardiac_drift_pct}
          bestEfforts={bestEfforts}
          gapPace={gapPace}
          avgPaceSec={activity.avg_speed_ms ? 1000 / activity.avg_speed_ms : null}
        />
      )}

      {hasMap && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden h-80 z-0">
          <MapContainer ref={mapRef} bounds={path} scrollWheelZoom={false} className="h-full w-full" preferCanvas={true}>
            <ChangeView bounds={path} />
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <Polyline positions={path} color="#4f46e5" weight={15} opacity={0} eventHandlers={{ mousemove: handleMapHover, mouseout: () => syncAll(null) }} />
            <Polyline positions={path} color="#4f46e5" weight={4} opacity={0.8} interactive={false} />
            <CircleMarker center={path[0]} radius={5} color="white" weight={2} fillColor="#22c55e" fillOpacity={1} />
            <CircleMarker center={path[path.length - 1]} radius={5} color="white" weight={2} fillColor="#ef4444" fillOpacity={1} />
            <CircleMarker ref={markerRef} center={path[0]} radius={8} color="white" weight={3} fillColor="#f59e0b" fillOpacity={0} opacity={0} zIndexOffset={1000} />
          </MapContainer>
        </div>
      )}

      {validRecords.length > 0 && (
        <div className="bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase mb-4 text-center">Perfil de Altimetría</h3>
          <div className="h-[200px]"><Chart ref={elevationChartRef} type="line" data={elevationData} options={elevationOptions} /></div>
        </div>
      )}

      {isRunning ? (
        <SectionCard
          title="Ritmo, FC y cadencia"
          subtitle={data.cadence_stats?.avg ? `Cadencia máx ${data.cadence_stats.max} · P95 ${data.cadence_stats.p95} spm` : null}
        >
          <div className="p-4 sm:p-6 space-y-2">
            <div className="h-[220px]"><Chart ref={mainChartRef} type="line" data={{ labels: chartData.labels, datasets: [chartData.datasets[0]] }} options={pacePanelOptions} /></div>
            <div className="h-[130px]"><Chart ref={hrChartRef} type="line" data={{ labels: chartData.labels, datasets: [chartData.datasets[1]] }} options={hrPanelOptions} /></div>
            <div className="h-[150px]"><Chart ref={cadenceChartRef} type="line" data={cadenceData} options={cadencePanelOptions} /></div>
          </div>
        </SectionCard>
      ) : (
        <div className="bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
          <div className="h-[400px]"><Chart ref={mainChartRef} type="line" data={chartData} options={chartOptions} /></div>
        </div>
      )}

      {isRunning && <RunningSplitsChart records={data.records} />}



      {/* W'bal Chart */}
      {wBalData && (
        <div className="bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase">W'bal (Reserva Anaeróbica)</h3>
            <span className="text-xs text-gray-400">W' estimado: {wPrimeEst ? `${(wPrimeEst/1000).toFixed(1)} kJ` : '—'}</span>
          </div>
          <div className="h-[200px]">
            <Chart type="line" data={wBalData} options={{
              responsive: true, maintainAspectRatio: false,
              plugins: { legend: { display: false }, tooltip: {
                callbacks: { label: (ctx) => `${(ctx.parsed.y/1000).toFixed(2)} kJ` }
              }},
              scales: {
                x: { display: false },
                y: {
                  beginAtZero: true,
                  max: wPrimeEst || undefined,
                  title: { display: true, text: "W'bal (kJ)", font: { size: 10 } },
                  ticks: { callback: (v) => `${(v/1000).toFixed(0)} kJ`, font: { size: 10 } },
                  grid: { color: 'rgba(156,163,175,0.1)' },
                }
              },
              interaction: { mode: 'index', intersect: false },
            }} />
          </div>
        </div>
      )}

      {/* Time in Zones Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {!isRunning && (
          <ZoneTimeChart zoneData={powerZoneData} title="Tiempo en Zonas de Potencia" emptyMessage="Datos de potencia no disponibles" />
        )}
        <div className={isRunning ? 'lg:col-span-2' : ''}>
          <ZoneTimeChart zoneData={hrZoneData} title="Tiempo en Zonas de FC" emptyMessage="Datos de FC no disponibles" />
        </div>
      </div>

      <LapsTable laps={laps} isRunning={isRunning} />
    </div>
  );
};

export default ActivityDetail;
