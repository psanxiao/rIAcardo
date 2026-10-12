import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ZoneEditor from './ZoneEditor';

const zones = [
  { name: 'Z1', label: 'Recuperación Activa', min: 0, max: 100 },
  { name: 'Z2', label: 'Resistencia', min: 100, max: 150 },
];

describe('ZoneEditor', () => {
  it('renders power zones with W units', () => {
    render(
      <ZoneEditor zones={zones} zoneType="power" onZoneChange={vi.fn()} onAutoCalculate={vi.fn()} />
    );
    expect(screen.getByText('Zonas de Potencia')).toBeInTheDocument();
    expect(screen.getByText('Min (W)')).toBeInTheDocument();
    expect(screen.getByText('Max (W)')).toBeInTheDocument();
    expect(screen.getByText('Z1')).toBeInTheDocument();
  });

  it('renders heart rate zones with bpm units', () => {
    render(
      <ZoneEditor zones={zones} zoneType="hr" onZoneChange={vi.fn()} onAutoCalculate={vi.fn()} />
    );
    expect(screen.getByText('Zonas de Pulso')).toBeInTheDocument();
    expect(screen.getByText('Min (bpm)')).toBeInTheDocument();
  });

  it('propagates zone edits with the zone type, index and field', () => {
    const onZoneChange = vi.fn();
    render(
      <ZoneEditor zones={zones} zoneType="power" onZoneChange={onZoneChange} onAutoCalculate={vi.fn()} />
    );
    const inputs = screen.getAllByRole('spinbutton');
    fireEvent.change(inputs[0], { target: { value: '120' } });
    expect(onZoneChange).toHaveBeenCalledWith('power', 0, 'min', '120');
    fireEvent.change(inputs[1], { target: { value: '130' } });
    expect(onZoneChange).toHaveBeenCalledWith('power', 0, 'max', '130');
  });

  it('triggers auto-calculation', () => {
    const onAutoCalculate = vi.fn();
    render(
      <ZoneEditor zones={zones} zoneType="power" onZoneChange={vi.fn()} onAutoCalculate={onAutoCalculate} />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Auto-calcular' }));
    expect(onAutoCalculate).toHaveBeenCalled();
  });
});