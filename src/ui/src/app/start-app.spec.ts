import { bootstrapApplication } from '@angular/platform-browser';
import { CONFIG } from './shared/config/config-token';
import { startApp } from './start-app';

vi.mock('@angular/platform-browser', async (original) => ({
  ...(await original<typeof import('@angular/platform-browser')>()),
  bootstrapApplication: vi.fn(),
}));

describe('startApp', () => {
  const fixture = { environment: 'local', apiBaseUrl: 'http://localhost:7159/api' };

  beforeEach(() => {
    document.body.innerHTML =
      '<app-root><p id="startup-status" role="status">Loading the app...</p><button id="startup-reload" hidden>Reload</button></app-root>';
    vi.mocked(bootstrapApplication).mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
    document.body.replaceChildren();
  });

  it('waits for configuration before bootstrapping with its frozen value', async () => {
    let resolve: (response: Response) => void;
    vi.stubGlobal(
      'fetch',
      vi.fn(
        () =>
          new Promise<Response>((done) => {
            resolve = done;
          }),
      ),
    );
    const pending = startApp();
    expect(bootstrapApplication).not.toHaveBeenCalled();
    expect(document.querySelector('[role=status]')?.textContent).toContain('Loading');
    resolve!(Response.json(fixture));
    await pending;
    const providers = vi.mocked(bootstrapApplication).mock.calls[0][1]!.providers;
    expect(providers).toContainEqual({ provide: CONFIG, useValue: fixture });
    const provider = providers.find((entry) => 'provide' in entry && entry.provide === CONFIG);
    expect(provider && 'useValue' in provider && Object.isFrozen(provider.useValue)).toBe(true);
  });

  it.each([
    () => new Response('', { status: 404 }),
    () => new Response('private', { headers: { 'content-type': 'application/json' } }),
    () => new Response('<html>private</html>', { headers: { 'content-type': 'text/html' } }),
    () => Response.json({}),
  ])('shows safe reload feedback and never bootstraps on bad configuration', async (response) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response()));
    const reload = vi.fn();
    await startApp(reload);
    expect(bootstrapApplication).not.toHaveBeenCalled();
    expect(document.querySelector('[role=status]')?.textContent).toBe(
      'Unable to start the app. Reload to try again.',
    );
    const button = document.querySelector<HTMLButtonElement>('#startup-reload')!;
    expect(button.hidden).toBe(false);
    button.click();
    expect(reload).toHaveBeenCalledOnce();
    expect(document.body.textContent).not.toContain('private');
  });

  it('shows recovery after the configuration request times out', async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_url, options: RequestInit) =>
          new Promise((_resolve, reject) => {
            options.signal!.addEventListener('abort', () => reject(new Error('private')));
          }),
      ),
    );
    const pending = startApp();
    await vi.advanceTimersByTimeAsync(10_000);
    await pending;
    expect(bootstrapApplication).not.toHaveBeenCalled();
    expect(document.querySelector<HTMLButtonElement>('#startup-reload')?.hidden).toBe(false);
  });

  it('recreates accessible recovery if bootstrap removed the loading markup', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json(fixture)));
    vi.mocked(bootstrapApplication).mockImplementation(async () => {
      document.querySelector('app-root')!.replaceChildren();
      throw new Error('private bootstrap details');
    });
    const reload = vi.fn();
    await startApp(reload);
    expect(document.querySelector('[role=status]')?.textContent).toContain('Unable to start');
    document.querySelector<HTMLButtonElement>('#startup-reload')!.click();
    expect(reload).toHaveBeenCalledOnce();
    expect(document.body.textContent).not.toContain('private');
  });
});
