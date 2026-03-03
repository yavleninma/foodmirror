import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiClient } from './api';

describe('ApiClient headers', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('sends X-Init-Data when Telegram initData exists', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'ok', version: '2.0.0' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const client = new ApiClient();
    client.setInitData('telegram-init-data');
    client.setGuestToken('guest-token');

    await client.getHealth();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = options.headers as Record<string, string>;
    expect(headers['X-Init-Data']).toBe('telegram-init-data');
    expect(headers['X-Guest-Token']).toBeUndefined();
  });

  it('sends X-Guest-Token when initData is absent', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'ok', version: '2.0.0' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const client = new ApiClient();
    client.setGuestToken('guest-token');

    await client.getHealth();

    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = options.headers as Record<string, string>;
    expect(headers['X-Guest-Token']).toBe('guest-token');
    expect(headers['X-Init-Data']).toBeUndefined();
  });

  it('does not force Content-Type for FormData payloads', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: '1', verdict: 'ok', correction: 'ok', createdAt: new Date().toISOString() }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const client = new ApiClient();
    const file = new File([new Uint8Array([1, 2, 3])], 'food.jpg', { type: 'image/jpeg' });

    await client.getInsight(file);

    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = options.headers as Record<string, string>;
    expect(headers['Content-Type']).toBeUndefined();
  });

});
