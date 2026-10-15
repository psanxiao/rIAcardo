import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import PlanningSchedule from './PlanningSchedule';

const { api } = vi.hoisted(() => ({
  api: { get: vi.fn(), post: vi.fn() },
}));

vi.mock('../../services/api', () => ({ default: api }));

describe('PlanningSchedule', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    api.get.mockResolvedValue({
      data: {
        enabled: true,
        cadence: 'biweekly',
        day: 4,
        day_name: 'Viernes',
        hour: 6,
        last_run: null,
        next_run: '2026-10-16',
      },
    });
    api.post.mockResolvedValue({
      data: { enabled: true, cadence: 'biweekly', day: 4, next_run: '2026-10-30' },
    });
  });

  it('loads and displays the saved schedule', async () => {
    render(<PlanningSchedule />);

    const toggle = await screen.findByLabelText('Activar planificación automática');
    expect(toggle).toBeChecked();
    expect(screen.getByLabelText('Frecuencia')).toHaveValue('biweekly');
    expect(screen.getByLabelText('Día de la semana')).toHaveValue('4');
    expect(screen.getByText(/Próxima generación/)).toBeInTheDocument();
  });

  it('saves the selected schedule', async () => {
    render(<PlanningSchedule />);
    await screen.findByLabelText('Activar planificación automática');

    fireEvent.change(screen.getByLabelText('Día de la semana'), { target: { value: '2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar planificación' }));

    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith('/api/settings/plan', {
        enabled: true,
        cadence: 'biweekly',
        day: 2,
      })
    );
    expect(await screen.findByText('Planificación automática guardada.')).toBeInTheDocument();
  });

  it('sends enabled=false when the toggle is switched off', async () => {
    render(<PlanningSchedule />);
    const toggle = await screen.findByLabelText('Activar planificación automática');

    fireEvent.click(toggle);
    fireEvent.click(screen.getByRole('button', { name: 'Guardar planificación' }));

    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith('/api/settings/plan', {
        enabled: false,
        cadence: 'biweekly',
        day: 4,
      })
    );
  });
});
