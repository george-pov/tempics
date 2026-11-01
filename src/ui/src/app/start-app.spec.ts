import { bootstrapApplication } from '@angular/platform-browser';
import { CONFIG } from './shared/config/config-token';
import { startApp } from './start-app';
import { CONFIG_FIXTURE } from './shared/config/config-fixture';

vi.mock('@angular/platform-browser', async (original) => ({
  ...(await original<typeof import('@angular/platform-browser')>()),
  bootstrapApplication: vi.fn(),
}));

describe('startApp', () => {
  const fixture = CONFIG_FIXTURE;

  beforeEach(() => {
    document.body.innerHTML =
      '<app-root><p id="startup-status" role="status">Loading the app...</p><button id="startup-reload" hidden>Reload</button></app-root>';
    vi.mocked(bootstrapApplication).mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.replaceChildren();
  });

  it('waits for configuration before bootstrapping', async () => {
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
    resolve!(Response.json(fixture));
    await pending;
    expect(bootstrapApplication).toHaveBeenCalledOnce();
  });

  it('bootstraps with the loaded configuration', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json(fixture)));
    await startApp();
    const providers = vi.mocked(bootstrapApplication).mock.calls[0][1]!.providers;
    expect(providers).toContainEqual({ provide: CONFIG, useValue: fixture });
  });

  it('does not bootstrap after invalid configuration', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('private', { status: 404 })));
    await startApp();
    expect(bootstrapApplication).not.toHaveBeenCalled();
  });

  it('shows safe reload feedback after invalid configuration', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('private', { status: 404 })));
    const reload = vi.fn();
    await startApp(reload);
    expect(document.querySelector('[role=status]')?.textContent).toMatch(/unable to start/i);
    const button = document.querySelector<HTMLButtonElement>('#startup-reload')!;
    expect(button.hidden).toBe(false);
    expect(document.body.textContent).not.toContain('private');
  });

  it('invokes Reload after startup fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 404 })));
    const reload = vi.fn();
    await startApp(reload);
    document.querySelector<HTMLButtonElement>('#startup-reload')!.click();
    expect(reload).toHaveBeenCalledOnce();
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
    expect(document.querySelector<HTMLButtonElement>('#startup-reload')?.hidden).toBe(false);
  });
});
