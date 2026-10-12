import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Cuenta from './Cuenta';

const { api, refreshProfileMock, user } = vi.hoisted(() => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn() },
  refreshProfileMock: vi.fn(),
  user: {
    email: 'atleta@test.dev',
    full_name: 'Test Atleta',
    garmin_connected: false,
    garmin_email: null,
    google_calendar_id: '',
  },
}));

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user,
    refreshProfile: refreshProfileMock,
    isLoading: false,
  }),
}));

vi.mock('../services/api', () => ({ default: api }));

const renderCuenta = () => render(<Cuenta />);

const garminSection = () => screen.getByText('Conexiones Externas').closest('section');

describe('Cuenta', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    refreshProfileMock.mockResolvedValue(undefined);
    api.get.mockImplementation(() => Promise.resolve({ data: { connected: false, sync_status: 'IDLE' } }));
  });

  it('shows the account heading and the identity data', async () => {
    renderCuenta();
    expect(await screen.findByRole('heading', { name: 'Cuenta' })).toBeInTheDocument();
    expect(screen.getByText('atleta@test.dev')).toBeInTheDocument();
    expect(screen.getByLabelText('Nombre Completo')).toHaveValue('Test Atleta');
  });

  it('updates the full name via PATCH', async () => {
    api.patch.mockResolvedValue({ data: {} });
    renderCuenta();
    await screen.findByRole('heading', { name: 'Cuenta' });

    fireEvent.change(screen.getByLabelText('Nombre Completo'), { target: { value: 'Nuevo Nombre' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar Cambios' }));

    await waitFor(() =>
      expect(api.patch).toHaveBeenCalledWith('/api/auth/profile', { full_name: 'Nuevo Nombre' })
    );
    expect(screen.getByText('Nombre actualizado correctamente.')).toBeInTheDocument();
  });

  it('rejects a password change when the new passwords differ', () => {
    renderCuenta();

    fireEvent.change(screen.getByLabelText('Contraseña Actual'), { target: { value: 'old-pass' } });
    fireEvent.change(screen.getByLabelText('Nueva Contraseña'), { target: { value: 'new-pass-1' } });
    fireEvent.change(screen.getByLabelText('Confirmar Nueva Contraseña'), { target: { value: 'new-pass-2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Actualizar Contraseña' }));

    expect(screen.getByText('Las nuevas contraseñas no coinciden.')).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();
  });

  it('connects Garmin and reflects the new status', async () => {
    api.post.mockResolvedValue({ data: {} });
    api.get
      .mockResolvedValueOnce({ data: { connected: false, sync_status: 'IDLE' } })
      .mockResolvedValueOnce({ data: { connected: true, sync_status: 'SYNCED' } });
    renderCuenta();
    await screen.findByRole('heading', { name: 'Cuenta' });

    const section = garminSection();
    fireEvent.change(section.querySelector('input[type="email"]'), { target: { value: 'garmin@test.dev' } });
    fireEvent.change(section.querySelector('input[type="password"]'), { target: { value: 'garmin-pass' } });
    fireEvent.click(screen.getByRole('button', { name: 'Conectar Garmin' }));

    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith('/api/garmin/connect', {
        email: 'garmin@test.dev',
        password: 'garmin-pass',
      })
    );
    expect(await screen.findByRole('button', { name: 'Desconectar Garmin' })).toBeInTheDocument();
  });

  it('disconnects Garmin after confirmation', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    api.post.mockResolvedValue({ data: {} });
    api.get.mockResolvedValueOnce({ data: { connected: true, sync_status: 'OK' } });
    renderCuenta();

    fireEvent.click(await screen.findByRole('button', { name: 'Desconectar Garmin' }));

    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/garmin/disconnect'));
    expect(screen.getByText('Garmin desconectado correctamente.')).toBeInTheDocument();
  });
});