import { loadConfig } from './load-config';

describe('loadConfig', () => {
  const fixture = { environment: 'local', apiBaseUrl: 'http://localhost:7159/api' };

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it.each(['https://ui.example.test/', 'https://ui.example.test/nested/'])(
    'loads JSON relative to %s without caching or redirects',
    async (base) => {
      vi.spyOn(document, 'baseURI', 'get').mockReturnValue(base);
      const fetchMock = vi.fn().mockResolvedValue(Response.json(fixture));
      vi.stubGlobal('fetch', fetchMock);
      expect(await loadConfig()).toEqual(fixture);
      expect(fetchMock).toHaveBeenCalledWith(new URL('config.json', base), {
        cache: 'no-store',
        redirect: 'error',
        signal: expect.any(AbortSignal),
      });
    },
  );

  it.each([
    () => new Response('', { status: 404 }),
    () => new Response('<html></html>', { headers: { 'content-type': 'text/html' } }),
    () => new Response('{', { headers: { 'content-type': 'application/json' } }),
    () => Response.json({ environment: 'local' }),
    () => new Response('{}'),
  ])('rejects missing, HTML, malformed and invalid responses', async (response) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response()));
    await expect(loadConfig()).rejects.toThrow('Configuration loading failed');
  });

  it('aborts a stalled request at ten seconds and clears its timer', async () => {
    vi.useFakeTimers();
    let signal: AbortSignal;
    vi.stubGlobal(
      'fetch',
      vi.fn((_url, options: RequestInit) => {
        signal = options.signal as AbortSignal;
        return new Promise((_resolve, reject) =>
          signal.addEventListener('abort', () => reject('private')),
        );
      }),
    );
    const pending = expect(loadConfig()).rejects.toThrow('Configuration loading failed');
    await vi.advanceTimersByTimeAsync(10_000);
    await pending;
    expect(signal!.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('clears the timeout after success and hides network errors', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json(fixture)));
    await loadConfig();
    expect(vi.getTimerCount()).toBe(0);
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('private URL')));
    await expect(loadConfig()).rejects.toThrow('Configuration loading failed');
    expect(vi.getTimerCount()).toBe(0);
  });
});
