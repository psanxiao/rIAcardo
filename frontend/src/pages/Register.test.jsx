import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import Register from './Register';

const { api } = vi.hoisted(() => ({
  api: { get: vi.fn(), post: vi.fn() },
}));

vi.mock('../services/api', () => ({ default: api }));

const renderRegister = () =>
  render(
    <MemoryRouter initialEntries={['/register']}>
      <Routes>
        <Route path="/register" element={<Register />} />
        <Route path="/login" element={<div>LoginPage</div>} />
      </Routes>
    </MemoryRouter>
  );

const fillForm = ({ password = 'pass1', confirm = 'pass1' } = {}) => {
  fireEvent.change(screen.getByPlaceholderText('Correo Electrónico'), { target: { value: 'a@b.dev' } });
  fireEvent.change(screen.getByPlaceholderText('Contraseña'), { target: { value: password } });
  fireEvent.change(screen.getByPlaceholderText('Confirmar Contraseña'), { target: { value: confirm } });
};

describe('Register', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('rejects mismatched passwords without calling the API', () => {
    renderRegister();
    fillForm({ password: 'pass1', confirm: 'pass2' });
    fireEvent.click(screen.getByRole('button', { name: 'Registrarse' }));

    expect(screen.getByText('Las contraseñas no coinciden')).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();
  });

  it('registers successfully and navigates to the login page', async () => {
    api.post.mockResolvedValue({ data: { user_id: 'u1' } });
    renderRegister();
    fillForm();
    fireEvent.click(screen.getByRole('button', { name: 'Registrarse' }));

    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith('/api/auth/register', { email: 'a@b.dev', password: 'pass1' })
    );
    expect(await screen.findByText('LoginPage')).toBeInTheDocument();
  });

  it('shows the backend error detail when registration fails', async () => {
    api.post.mockRejectedValue({ response: { data: { detail: 'El email ya está registrado.' } } });
    renderRegister();
    fillForm();
    fireEvent.click(screen.getByRole('button', { name: 'Registrarse' }));

    expect(await screen.findByText('El email ya está registrado.')).toBeInTheDocument();
  });
});