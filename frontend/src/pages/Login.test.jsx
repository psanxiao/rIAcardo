import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Login from './Login';

const { loginMock, api } = vi.hoisted(() => ({
  loginMock: vi.fn(),
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn() },
}));

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ login: loginMock }),
}));

vi.mock('../services/api', () => ({ default: api }));

const renderLogin = (state) =>
  render(
    <MemoryRouter initialEntries={[{ pathname: '/login', state }]}>
      <Login />
    </MemoryRouter>
  );

describe('Login', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('logs in with credentials and stores the token via auth context', async () => {
    api.post.mockResolvedValue({ data: { access_token: 'tok-123' } });
    renderLogin();

    fireEvent.change(screen.getByPlaceholderText('Correo Electrónico'), { target: { value: 'a@b.dev' } });
    fireEvent.change(screen.getByPlaceholderText('Contraseña'), { target: { value: 'secret' } });
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar sesión' }));

    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith('/api/auth/login', { email: 'a@b.dev', password: 'secret' })
    );
    expect(loginMock).toHaveBeenCalledWith('tok-123');
  });

  it('shows the success message passed via navigation state', () => {
    renderLogin({ message: 'Registro exitoso. Por favor inicia sesión.' });
    expect(screen.getByText('Registro exitoso. Por favor inicia sesión.')).toBeInTheDocument();
  });

  it('shows an error message when login fails', async () => {
    api.post.mockRejectedValue({ response: { status: 401 } });
    renderLogin();

    fireEvent.change(screen.getByPlaceholderText('Correo Electrónico'), { target: { value: 'a@b.dev' } });
    fireEvent.change(screen.getByPlaceholderText('Contraseña'), { target: { value: 'wrong' } });
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar sesión' }));

    expect(
      await screen.findByText('Credenciales incorrectas o error en el servidor.')
    ).toBeInTheDocument();
    expect(loginMock).not.toHaveBeenCalled();
  });
});