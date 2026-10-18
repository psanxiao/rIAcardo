import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Dashboard from './Dashboard';

const { api } = vi.hoisted(() => ({
  api: { get: vi.fn(), post: vi.fn() },
}));

vi.mock('../services/api', () => ({ default: api }));

const tssCalls = () =>
  api.get.mock.calls.filter(([url]) => url.startsWith('/api/coach/weekly-tss')).length;

const renderDashboard = () =>
  render(
    <MemoryRouter>
      <Dashboard />
    </MemoryRouter>
  );

describe('Dashboard sync completion', () => {
  beforeEach(() => {
    vi.resetAllMocks();

    let statusCall = 0;
    api.get.mockImplementation((url) => {
      if (url === '/api/garmin/status') {
        statusCall += 1;
        return Promise.resolve({
          data: { connected: true, sync_status: statusCall === 1 ? 'IDLE' : 'COMPLETED' },
        });
      }
      if (url.startsWith('/api/analysis/training-load')) return Promise.resolve({ data: { activities: [] } });
      if (url === '/api/coach/upcoming') return Promise.resolve({ data: [] });
      if (url.startsWith('/api/coach/weekly-tss')) {
        return Promise.resolve({
          data: {
            start_date: '2026-10-12',
            end_date: '2026-10-18',
            planned_tss: 400,
            actual_tss: 360,
            compliance_pct: 90,
          },
        });
      }
      return Promise.resolve({ data: {} });
    });
    api.post.mockResolvedValue({ data: {} });
  });

  it('refreshes the weekly compliance section when a sync finishes', async () => {
    renderDashboard();

    // Initial load fetches the compliance once.
    await screen.findByRole('button', { name: /Sincronizar/ });
    expect(tssCalls()).toBe(1);

    // Running the sync ends (status goes IDLE -> COMPLETED) and the compliance
    // must be fetched again, not just the KPI/activity sections.
    fireEvent.click(screen.getByRole('button', { name: /Sincronizar/ }));

    await waitFor(() => expect(tssCalls()).toBe(2));
    expect(api.get).toHaveBeenCalledWith(expect.stringContaining('/api/coach/weekly-tss?date='));
  });
});
