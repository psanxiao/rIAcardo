import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import WeeklySummary from './WeeklySummary';

const { api } = vi.hoisted(() => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn() },
}));

vi.mock('../services/api', () => ({ default: api }));

// Chart.js needs a canvas, which jsdom does not implement; stub the charts.
vi.mock('../components/weekly/PlannedVsActualChart', () => ({ default: () => <div data-testid="planned-chart" /> }));
vi.mock('../components/weekly/WeeklyLoadChart', () => ({ default: () => <div data-testid="load-chart" /> }));
vi.mock('../components/weekly/SportBreakdown', () => ({ default: () => <div data-testid="sport-breakdown" /> }));

const restDay = (date, weekday) => ({
  date,
  weekday,
  planned: [],
  actual: [],
  planned_tss: 0,
  actual_tss: 0,
  status: 'rest',
});

const summary = {
  start_date: '2026-10-12',
  end_date: '2026-10-18',
  planned_tss: 400,
  actual_tss: 360,
  compliance_pct: 90,
  totals: { sessions: 4, duration_min: 300, distance_km: 120.5, ascent_m: 1500 },
  sport_breakdown: { cycling: { sessions: 3, tss: 300, hours: 4, distance_km: 110 } },
  days: [
    {
      date: '2026-10-12',
      weekday: 'lunes',
      planned: [{ title: 'Rodaje suave', type: 'ride', duration_min: 60, tss: 60 }],
      actual: [{ activity_id: 1, sport: 'Ride', tss: 60, duration_min: 60, distance_km: 30 }],
      planned_tss: 60,
      actual_tss: 60,
      status: 'completed',
    },
    { ...restDay('2026-10-13', 'martes'), planned: [{ title: 'Series', type: 'run', duration_min: 45, tss: 70 }], planned_tss: 70, status: 'missed' },
    restDay('2026-10-14', 'miércoles'),
    restDay('2026-10-15', 'jueves'),
    restDay('2026-10-16', 'viernes'),
    restDay('2026-10-17', 'sábado'),
    restDay('2026-10-18', 'domingo'),
  ],
  activities: [
    { activity_id: 1, date: '2026-10-12', start_time: '2026-10-12T09:00:00', sport: 'Ride', tss: 60, distance_km: 30, duration_min: 60, ascent_m: 200 },
  ],
  balance: { rest_days: 6, monotony: 1.1 },
  load: { dates: ['2026-10-12'], ctl: [70], atl: [60], tsb: [-5], ctl_change: 0.5, tsb_end: -5 },
};

const renderPage = (path = '/semana') =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <WeeklySummary />
    </MemoryRouter>
  );

describe('WeeklySummary', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    api.get.mockResolvedValue({ data: summary });
  });

  it('requests the summary for the week in the URL and renders the KPIs', async () => {
    renderPage('/semana?date=2026-10-14');

    expect(await screen.findByRole('heading', { name: 'Resumen Semanal' })).toBeInTheDocument();
    expect(api.get).toHaveBeenCalledWith('/api/coach/weekly-summary?date=2026-10-14');
    expect(screen.getByText('360')).toBeInTheDocument();
    expect(screen.getByText('90%')).toBeInTheDocument();
    expect(screen.getByText('5h 0m')).toBeInTheDocument();
    expect(screen.getByText('120.5 km')).toBeInTheDocument();
  });

  it('renders the daily adherence list and links to activities', async () => {
    const { container } = renderPage('/semana?date=2026-10-14');

    expect(await screen.findByText('Completado')).toBeInTheDocument();
    expect(screen.getByText('No hecho')).toBeInTheDocument();

    const link = container.querySelector('a[href="/activity/1"]');
    expect(link).not.toBeNull();
  });

  it('navigates to the previous week through the URL', async () => {
    renderPage('/semana?date=2026-10-14');
    await screen.findByRole('heading', { name: 'Resumen Semanal' });

    fireEvent.click(screen.getByRole('button', { name: 'Semana anterior' }));

    await waitFor(() =>
      expect(api.get).toHaveBeenCalledWith('/api/coach/weekly-summary?date=2026-10-07')
    );
  });

  it('shows an error state when the request fails', async () => {
    api.get.mockRejectedValue(new Error('boom'));
    renderPage('/semana?date=2026-10-14');

    expect(await screen.findByText('No se pudo cargar el resumen semanal.')).toBeInTheDocument();
  });
});
