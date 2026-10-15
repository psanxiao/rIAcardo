import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import NotificationsBell from './NotificationsBell';

const { api } = vi.hoisted(() => ({
  api: { get: vi.fn(), post: vi.fn() },
}));

vi.mock('../services/api', () => ({ default: api }));

const notifications = [
  {
    id: 1,
    type: 'report',
    title: 'Tu informe y plan están listos',
    message: 'Nuevo ciclo de entrenamiento disponible.',
    link: '/coach',
    is_read: false,
    created_at: '2026-10-14T06:00:00+00:00',
  },
  {
    id: 2,
    type: 'system',
    title: 'Bienvenido',
    message: null,
    link: null,
    is_read: true,
    created_at: '2026-10-13T06:00:00+00:00',
  },
];

const renderBell = () =>
  render(
    <MemoryRouter>
      <NotificationsBell />
    </MemoryRouter>
  );

const openPanel = async () => {
  await screen.findByText('1');
  fireEvent.click(screen.getByRole('button', { name: 'Notificaciones' }));
  await screen.findByText('Bienvenido');
};

describe('NotificationsBell', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    api.get.mockImplementation((url) => {
      if (url === '/api/notifications/unread-count') {
        return Promise.resolve({ data: { unread: 1 } });
      }
      if (url === '/api/notifications') {
        return Promise.resolve({ data: notifications });
      }
      return Promise.resolve({ data: {} });
    });
    api.post.mockResolvedValue({ data: {} });
  });

  it('shows the unread badge from the unread-count endpoint', async () => {
    renderBell();
    expect(await screen.findByText('1')).toBeInTheDocument();
    expect(api.get).toHaveBeenCalledWith('/api/notifications/unread-count');
  });

  it('opens the panel and lists notifications', async () => {
    renderBell();
    await openPanel();
    expect(screen.getByText('Tu informe y plan están listos')).toBeInTheDocument();
    expect(screen.getByText('Nuevo ciclo de entrenamiento disponible.')).toBeInTheDocument();
    expect(api.get).toHaveBeenCalledWith('/api/notifications');
  });

  it('marks a single notification as read when clicked', async () => {
    renderBell();
    await openPanel();
    fireEvent.click(screen.getByText('Tu informe y plan están listos'));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/notifications/1/read'));
  });

  it('marks all notifications as read and hides the badge', async () => {
    renderBell();
    await openPanel();
    fireEvent.click(screen.getByRole('button', { name: /Marcar todas/ }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/notifications/read-all'));
    await waitFor(() => expect(screen.queryByRole('button', { name: /Marcar todas/ })).toBeNull());
    expect(screen.queryByText('1')).toBeNull();
  });
});
