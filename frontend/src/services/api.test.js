import { describe, it, expect, beforeEach } from 'vitest';
import api from './api';

describe('api request interceptor', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('attaches the JWT when a token exists', () => {
    localStorage.setItem('token', 'abc.def.ghi');
    const handler = api.interceptors.request.handlers[0];
    const result = handler.fulfilled({ headers: {} });
    expect(result.headers.Authorization).toBe('Bearer abc.def.ghi');
  });

  it('does not attach auth headers without a token', () => {
    const handler = api.interceptors.request.handlers[0];
    const result = handler.fulfilled({ headers: {} });
    expect(result.headers.Authorization).toBeUndefined();
  });
});

describe('api response interceptor', () => {
  const handler = api.interceptors.response.handlers[0];

  it('passes through successful responses', () => {
    const response = { data: { ok: true } };
    expect(handler.fulfilled(response)).toBe(response);
  });

  it('clears the token and redirects to /login on 401', () => {
    const fakeLocation = { href: 'http://localhost/dashboard' };
    Object.defineProperty(window, 'location', { writable: true, value: fakeLocation });
    localStorage.setItem('token', 'abc');

    const error = { response: { status: 401 } };
    handler.rejected(error).catch(() => {});

    expect(localStorage.getItem('token')).toBeNull();
    expect(fakeLocation.href).toBe('/login');
  });

  it('rejects non-401 errors untouched', async () => {
    const error = { response: { status: 500 } };
    await expect(handler.rejected(error)).rejects.toBe(error);
  });
});