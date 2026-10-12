import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from './AuthContext';

const { api } = vi.hoisted(() => ({
  api: { get: vi.fn() },
}));

vi.mock('../services/api', () => ({ default: api }));

const Probe = () => {
  const { user, isLoading, login, logout } = useAuth();
  return (
    <div>
      <span data-testid="loading">{isLoading ? 'true' : 'false'}</span>
      <span data-testid="user">{user?.email || 'none'}</span>
      <button onClick={() => login('tok-1')}>login</button>
      <button onClick={logout}>logout</button>
    </div>
  );
};

const renderWithAuth = () =>
  render(
    <AuthProvider>
      <Probe />
    </AuthProvider>
  );

describe('AuthContext', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    localStorage.clear();
    api.get.mockResolvedValue({ data: { email: 'x@y.dev', full_name: 'X' } });
  });

  it('starts logged out and loads without a token', async () => {
    renderWithAuth();
    expect(await screen.findByTestId('loading')).toHaveTextContent('false');
    expect(screen.getByTestId('user')).toHaveTextContent('none');
  });

  it('fetches the profile after login and clears it on logout', async () => {
    renderWithAuth();
    await screen.findByTestId('loading');

    fireEvent.click(screen.getByRole('button', { name: 'login' }));
    await waitFor(() => expect(screen.getByTestId('user')).toHaveTextContent('x@y.dev'));
    expect(api.get).toHaveBeenCalledWith('/api/auth/profile');
    expect(localStorage.getItem('token')).toBe('tok-1');

    fireEvent.click(screen.getByRole('button', { name: 'logout' }));
    await waitFor(() => expect(screen.getByTestId('user')).toHaveTextContent('none'));
    expect(localStorage.getItem('token')).toBeNull();
  });
});