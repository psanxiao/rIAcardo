import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Atleta from './Atleta';

const { api } = vi.hoisted(() => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn() },
}));

vi.mock('../services/api', () => ({ default: api }));

const settingsData = {
  ftp: 250,
  lthr: 160,
  weight: 70.5,
  age: 30,
  threshold_pace: 3.7, // m/s -> 4:30 min/km
  athlete_context: 'Ciclista amateur de 35 años.',
  athlete_goal: 'Mejorar potencia en subidas.',
  power_zones: [
    { name: 'Z1', label: 'Recuperación Activa', min: 0, max: 100 },
    { name: 'Z2', label: 'Resistencia', min: 100, max: 150 },
    { name: 'Z3', label: 'Tempo', min: 150, max: 190 },
    { name: 'Z4', label: 'Umbral Lactato', min: 190, max: 220 },
    { name: 'Z5', label: 'VO2 Máx', min: 220, max: 250 },
    { name: 'Z6', label: 'Capacidad Anaeróbica', min: 250, max: 300 },
    { name: 'Z7', label: 'Neuromuscular', min: 300, max: 9999 },
  ],
  hr_zones: [
    { name: 'Z1', label: 'Recuperación Activa', min: 0, max: 130 },
    { name: 'Z2', label: 'Aeróbico', min: 130, max: 142 },
    { name: 'Z3', label: 'Tempo', min: 142, max: 149 },
    { name: 'Z4', label: 'Sub-Umbral', min: 149, max: 158 },
    { name: 'Z5', label: 'Umbral / Anaeróbico', min: 158, max: 250 },
  ],
};

const renderAtleta = () => render(<Atleta />);

describe('Atleta', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    api.get.mockImplementation((url) => {
      if (url === '/api/settings') {
        return Promise.resolve({ data: settingsData });
      }
      // race predictions without results -> block is hidden
      return Promise.resolve({ data: { cycling: [], running: [] } });
    });
  });

  it('loads and displays the physical profile values', async () => {
    renderAtleta();
    expect(await screen.findByRole('heading', { name: 'Atleta' })).toBeInTheDocument();
    expect(screen.getByLabelText('FTP (W)')).toHaveValue(250);
    expect(screen.getByLabelText('Umbral HR (bpm)')).toHaveValue(160);
    expect(screen.getByLabelText('Peso (kg)')).toHaveValue(70.5);
    expect(screen.getByLabelText('Ritmo Umbral (min/km)')).toHaveValue('4:30');
  });

  it('auto-calculates power and heart rate zones from FTP / LTHR', async () => {
    renderAtleta();
    await screen.findByRole('heading', { name: 'Atleta' });

    const autoCalcButtons = screen.getAllByRole('button', { name: 'Auto-calcular' });
    fireEvent.click(autoCalcButtons[0]); // power: Z1 max = round(250 * 0.55) = 138
    expect(screen.getByDisplayValue('138')).toBeInTheDocument();

    fireEvent.click(autoCalcButtons[1]); // hr: Z3 min = round(160 * 0.90) = 144
    expect(screen.getByDisplayValue('144')).toBeInTheDocument();
  });

  it('saves the payload converting pace to m/s and serializing zones', async () => {
    api.post.mockResolvedValue({ data: {} });
    renderAtleta();
    await screen.findByRole('heading', { name: 'Atleta' });

    fireEvent.change(screen.getByLabelText('Ritmo Umbral (min/km)'), { target: { value: '4:30' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1));
    const [url, payload] = api.post.mock.calls[0];
    expect(url).toBe('/api/settings');
    expect(payload.threshold_pace).toBeCloseTo(1000 / 270, 2);
    expect(payload).toMatchObject({ ftp: 250, lthr: 160, weight: 70.5, age: 30 });

    expect(JSON.parse(payload.power_zones)[0].max).toBe(100);
    expect(JSON.parse(payload.hr_zones)[3].name).toBe('Z4');
    expect(screen.getByText('Datos del atleta guardados correctamente.')).toBeInTheDocument();
  });
});