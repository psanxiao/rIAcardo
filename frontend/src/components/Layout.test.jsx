import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Layout from './Layout';

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: { full_name: 'Tester', email: 't@test.dev' }, logout: vi.fn() }),
}));

vi.mock('../context/ThemeContext', () => ({
  useTheme: () => ({ isDark: false, toggleTheme: vi.fn() }),
}));

const renderLayout = () =>
  render(
    <MemoryRouter initialEntries={['/dashboard']}>
      <Layout />
    </MemoryRouter>
  );

describe('Layout sidebar', () => {
  it('shows the main nav items in the expected order with Atleta last', () => {
    renderLayout();
    const nav = screen.getByRole('navigation');
    const links = within(nav).getAllByRole('link');
    const names = links.map((l) => l.textContent.trim());
    const hrefs = links.map((l) => l.getAttribute('href'));

    expect(names).toEqual(['Dashboard', 'Calendario', 'Analytics', 'Coach IA', 'Atleta']);
    expect(hrefs).toEqual(['/dashboard', '/calendar', '/analytics', '/coach', '/atleta']);
  });

  it('does not include Cuenta or Ajustes as main nav items', () => {
    renderLayout();
    const nav = screen.getByRole('navigation');
    expect(within(nav).queryByRole('link', { name: 'Cuenta' })).toBeNull();
    expect(screen.queryByText('Ajustes')).toBeNull();
  });

  it('links the user card to /cuenta with the user display name', () => {
    renderLayout();
    const userLink = screen.getByRole('link', { name: /Tester/ });
    expect(userLink.getAttribute('href')).toBe('/cuenta');
  });
});