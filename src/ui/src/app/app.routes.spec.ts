import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from './app.routes';
import { App } from './app';
import { createAppConfig } from './app.config';
import { AuthSession } from './shared/auth/auth-session';
import { CONFIG_FIXTURE } from './shared/config/config-fixture';

beforeEach(() => {
  const isSignedIn = signal(false);
  TestBed.configureTestingModule({
    providers: [
      {
        provide: AuthSession,
        useValue: {
          isSignedIn,
          isBusy: () => false,
          errorMessage: () => '',
          initialize: vi.fn().mockResolvedValue(undefined),
          signIn: vi.fn(async () => isSignedIn.set(true)),
          signOut: vi.fn(async () => {
            isSignedIn.set(false);
            await TestBed.inject(Router).navigateByUrl('/');
          }),
          acquireApiToken: vi.fn().mockResolvedValue('fixture-access-token'),
        },
      },
    ],
  });
});

describe('Image Generator route', () => {
  it('signs in and renders a sample through the authenticated route', async () => {
    const config = CONFIG_FIXTURE;
    TestBed.configureTestingModule({
      imports: [App],
      providers: [...createAppConfig(config).providers, provideHttpClientTesting()],
    });
    const originalCreate = Object.getOwnPropertyDescriptor(URL, 'createObjectURL');
    const originalRevoke = Object.getOwnPropertyDescriptor(URL, 'revokeObjectURL');
    const createUrl = vi.fn().mockReturnValue('blob:sample');
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createUrl });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() });
    const fixture = TestBed.createComponent(App);
    try {
      await fixture.whenStable();
      await TestBed.inject(Router).navigateByUrl('/');
      await fixture.whenStable();
      const root: HTMLElement = fixture.nativeElement;
      const http = TestBed.inject(HttpTestingController);
      root.querySelector<HTMLButtonElement>('button')!.click();
      await fixture.whenStable();
      const button = Array.from(root.querySelectorAll('button')).find((entry) =>
        /generate sample image/i.test(entry.textContent ?? ''),
      );
      button!.click();
      await fixture.whenStable();
      const request = http.expectOne(`${config.apiBaseUrl}/renders/sample`);
      expect(request.request.headers.get('Authorization')).toBe('Bearer fixture-access-token');
      const png = new Blob(['sample'], { type: 'image/png' });
      request.flush(png);
      await fixture.whenStable();
      expect(root.querySelector('img')?.getAttribute('src')).toBe('blob:sample');
      http.verify();
    } finally {
      fixture.destroy();
      if (originalCreate) Object.defineProperty(URL, 'createObjectURL', originalCreate);
      else Reflect.deleteProperty(URL, 'createObjectURL');
      if (originalRevoke) Object.defineProperty(URL, 'revokeObjectURL', originalRevoke);
      else Reflect.deleteProperty(URL, 'revokeObjectURL');
    }
  });
});

describe('Component Lab route', () => {
  it('opens the public Component Lab route', async () => {
    TestBed.configureTestingModule({ providers: [provideRouter(routes)] });
    const harness = await RouterTestingHarness.create('/component-lab');
    expect(harness.routeNativeElement?.querySelector('h1')?.textContent).toBe('Component Lab');
  });

  it('shows the Button example on first load', async () => {
    TestBed.configureTestingModule({ providers: [provideRouter(routes)] });
    const harness = await RouterTestingHarness.create('/component-lab');
    expect(harness.routeNativeElement?.querySelector('app-button button')).not.toBeNull();
  });

  it.each([
    ['Button Link', 'app-button-link a'],
    ['Icon', 'app-icon'],
    ['Input', 'app-input input'],
    ['Alert', 'app-alert[role="status"]'],
    ['Progress Bar', 'app-progress-bar [role="progressbar"]'],
    ['Confirm Dialog', 'app-confirm-dialog-lab app-button button'],
  ] as const)('selects the %s example', async (label, selector) => {
    TestBed.configureTestingModule({ providers: [provideRouter(routes)] });
    const harness = await RouterTestingHarness.create('/component-lab');
    const item = Array.from(
      harness.routeNativeElement!.querySelectorAll<HTMLButtonElement>(
        'nav[aria-label="Components"] button',
      ),
    ).find((button) => button.textContent?.trim() === label);
    if (!item) throw new Error(`Missing Lab entry ${label}`);
    item.click();
    harness.detectChanges();
    expect(harness.routeNativeElement?.querySelector(selector)).not.toBeNull();
  });
});

describe('Templates route', () => {
  it('loads the owner list through the signed-in navigation and bearer interceptor', async () => {
    const config = CONFIG_FIXTURE;
    TestBed.configureTestingModule({
      imports: [App],
      providers: [...createAppConfig(config).providers, provideHttpClientTesting()],
    });
    await TestBed.inject(AuthSession).signIn();
    const fixture = TestBed.createComponent(App);
    try {
      await fixture.whenStable();
      const router = TestBed.inject(Router);
      await router.navigateByUrl('/component-lab');
      await fixture.whenStable();
      const root: HTMLElement = fixture.nativeElement;
      const main = root.querySelector('main')!;
      const navLink = root.querySelector<HTMLAnchorElement>(
        'nav[aria-label="Primary navigation"] a[href="/templates"]',
      );
      navLink!.click();
      await fixture.whenStable();
      const http = TestBed.inject(HttpTestingController);
      const request = http.expectOne(`${config.apiBaseUrl}/templates`);
      expect(request.request.headers.get('Authorization')).toBe('Bearer fixture-access-token');
      request.flush({
        items: [
          { id: '11111111-1111-1111-1111-111111111111', name: 'Spring sale' },
          { id: '22222222-2222-2222-2222-222222222222', name: 'Summer launch' },
        ],
      });
      await fixture.whenStable();
      expect(main.textContent).toContain('Spring sale');
      http.verify();
    } finally {
      fixture.destroy();
    }
  });

  it('cancels a pending list read when leaving the page', async () => {
    const config = CONFIG_FIXTURE;
    TestBed.configureTestingModule({
      imports: [App],
      providers: [...createAppConfig(config).providers, provideHttpClientTesting()],
    });
    await TestBed.inject(AuthSession).signIn();
    const fixture = TestBed.createComponent(App);
    try {
      await fixture.whenStable();
      const router = TestBed.inject(Router);
      await router.navigateByUrl('/templates');
      await fixture.whenStable();
      const http = TestBed.inject(HttpTestingController);
      const request = http.expectOne(`${config.apiBaseUrl}/templates`);

      await router.navigateByUrl('/component-lab');
      await fixture.whenStable();
      expect(request.cancelled).toBe(true);
      http.verify({ ignoreCancelled: true });
    } finally {
      fixture.destroy();
    }
  });

  it('reloads the list after creating a template through Add', async () => {
    const config = CONFIG_FIXTURE;
    TestBed.configureTestingModule({
      imports: [App],
      providers: [...createAppConfig(config).providers, provideHttpClientTesting()],
    });
    await TestBed.inject(AuthSession).signIn();
    const fixture = TestBed.createComponent(App);
    try {
      await fixture.whenStable();
      const router = TestBed.inject(Router);
      await router.navigateByUrl('/templates');
      await fixture.whenStable();
      const root: HTMLElement = fixture.nativeElement;
      const main = root.querySelector('main')!;
      const http = TestBed.inject(HttpTestingController);
      http.expectOne(`${config.apiBaseUrl}/templates`).flush({ items: [] });
      await fixture.whenStable();

      const addLink = main.querySelector<HTMLAnchorElement>('a[href="/templates/new"]');
      addLink!.click();
      await fixture.whenStable();

      const name = main.querySelector<HTMLInputElement>('app-template-editor app-input input')!;
      name.value = '  Launch invitation  ';
      name.dispatchEvent(new Event('input', { bubbles: true }));
      await fixture.whenStable();
      const save = Array.from(main.querySelectorAll<HTMLButtonElement>('button')).find(
        (button) => button.textContent?.trim() === 'Save template',
      );
      save!.click();
      await fixture.whenStable();
      const create = http.expectOne(`${config.apiBaseUrl}/templates`);
      create.flush(
        { id: '33333333-3333-3333-3333-333333333333', name: 'Launch invitation' },
        { status: 201, statusText: 'Created' },
      );
      await fixture.whenStable();
      const list = http.expectOne(`${config.apiBaseUrl}/templates`);
      list.flush({
        items: [{ id: '33333333-3333-3333-3333-333333333333', name: 'Launch invitation' }],
      });
      await fixture.whenStable();
      expect(main.querySelector('app-templates')?.textContent).toContain('Launch invitation');
      http.verify();
    } finally {
      fixture.destroy();
    }
  });

  it('loads and updates one template through Edit, then refreshes the list', async () => {
    const config = CONFIG_FIXTURE;
    TestBed.configureTestingModule({
      imports: [App],
      providers: [...createAppConfig(config).providers, provideHttpClientTesting()],
    });
    await TestBed.inject(AuthSession).signIn();
    const fixture = TestBed.createComponent(App);
    try {
      await fixture.whenStable();
      await TestBed.inject(Router).navigateByUrl('/templates');
      await fixture.whenStable();
      const root: HTMLElement = fixture.nativeElement;
      const http = TestBed.inject(HttpTestingController);
      const id = '22222222-2222-2222-2222-222222222222';
      http.expectOne(`${config.apiBaseUrl}/templates`).flush({
        items: [{ id, name: 'Event invitation' }],
      });
      await fixture.whenStable();

      root
        .querySelector<HTMLAnchorElement>(`app-templates a[href="/templates/${id}/edit"]`)!
        .click();
      await fixture.whenStable();
      const detail = http.expectOne(`${config.apiBaseUrl}/templates/${id}`);
      expect(detail.request.method).toBe('GET');
      expect(detail.request.headers.get('Authorization')).toBe('Bearer fixture-access-token');
      detail.flush({ id, name: 'Event invitation', template: '<Border />\n' });
      await fixture.whenStable();

      const name = root.querySelector<HTMLInputElement>('app-template-editor app-input input')!;
      const markup = root.querySelector<HTMLTextAreaElement>(
        'app-template-editor app-input textarea',
      )!;
      expect(name.value).toBe('Event invitation');
      expect(markup.value).toBe('<Border />\n');
      name.value = '  Updated invitation  ';
      name.dispatchEvent(new Event('input', { bubbles: true }));
      markup.value = '<Grid />\n  ';
      markup.dispatchEvent(new Event('input', { bubbles: true }));
      await fixture.whenStable();
      const save = Array.from(
        root.querySelectorAll<HTMLButtonElement>('app-template-editor button'),
      ).find((button) => button.textContent?.trim() === 'Save template');
      save!.click();
      await fixture.whenStable();

      const update = http.expectOne(`${config.apiBaseUrl}/templates/${id}`);
      expect(update.request.method).toBe('PUT');
      expect(update.request.headers.get('Authorization')).toBe('Bearer fixture-access-token');
      expect(update.request.body).toEqual({
        name: 'Updated invitation',
        template: '<Grid />\n  ',
      });
      update.flush(null, { status: 204, statusText: 'No Content' });
      await fixture.whenStable();

      const refreshed = http.expectOne(`${config.apiBaseUrl}/templates`);
      expect(refreshed.request.headers.get('Authorization')).toBe('Bearer fixture-access-token');
      refreshed.flush({ items: [{ id, name: 'Updated invitation' }] });
      await fixture.whenStable();
      expect(root.querySelector('app-templates')?.textContent).toContain('Updated invitation');
      http.verify();
    } finally {
      fixture.destroy();
    }
  });

  it('sends an authenticated delete for the selected row only after confirmation', async () => {
    const config = CONFIG_FIXTURE;
    TestBed.configureTestingModule({
      imports: [App],
      providers: [...createAppConfig(config).providers, provideHttpClientTesting()],
    });
    await TestBed.inject(AuthSession).signIn();
    const fixture = TestBed.createComponent(App);
    try {
      await fixture.whenStable();
      await TestBed.inject(Router).navigateByUrl('/templates');
      await fixture.whenStable();
      const root: HTMLElement = fixture.nativeElement;
      const http = TestBed.inject(HttpTestingController);
      const firstId = '11111111-1111-1111-1111-111111111111';
      const selectedId = '22222222-2222-2222-2222-222222222222';
      http.expectOne(`${config.apiBaseUrl}/templates`).flush({
        items: [
          { id: firstId, name: 'Same name' },
          { id: selectedId, name: 'Same name' },
        ],
      });
      await fixture.whenStable();

      const actions = root.querySelectorAll<HTMLButtonElement>(
        'app-templates li button[aria-label="Delete Same name"]',
      );
      actions[1].click();
      await fixture.whenStable();
      http.expectNone((request) => request.method === 'DELETE');

      const confirm = Array.from(
        document.querySelectorAll<HTMLButtonElement>('mat-dialog-container button'),
      ).find((button) => button.textContent?.trim() === 'Delete template');
      confirm!.click();
      await fixture.whenStable();
      const deletion = await vi.waitFor(() =>
        http.expectOne(`${config.apiBaseUrl}/templates/${selectedId}`),
      );
      expect(deletion.request.headers.get('Authorization')).toBe('Bearer fixture-access-token');
      deletion.flush(null, { status: 204, statusText: 'No Content' });
      http.verify();
    } finally {
      fixture.destroy();
    }
  });
});

describe('Home route', () => {
  it.each(['/', '/image-generator', '/templates', '/templates/new', '/templates/one/edit'])(
    'starts a fresh app at the sign-in page when opening %s',
    async (url) => {
      TestBed.configureTestingModule({
        providers: [provideRouter(routes), provideHttpClient(), provideHttpClientTesting()],
      });
      const harness = await RouterTestingHarness.create(url);
      expect(TestBed.inject(Router).url).toBe('/');
      expect(harness.routeNativeElement?.querySelector('button')?.textContent?.trim()).toBe(
        'Sign in',
      );
    },
  );
});

describe('Application layout', () => {
  let fixture: ComponentFixture<App> | undefined;

  afterEach(() => {
    fixture?.destroy();
    fixture = undefined;
  });

  async function openSignedInApp(): Promise<{ root: HTMLElement; router: Router }> {
    TestBed.configureTestingModule({
      imports: [App],
      providers: [...createAppConfig(CONFIG_FIXTURE).providers, provideHttpClientTesting()],
    });
    await TestBed.inject(AuthSession).signIn();
    fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/component-lab');
    await fixture.whenStable();
    return { root: fixture.nativeElement as HTMLElement, router };
  }

  it('keeps the application shell when navigating between pages', async () => {
    const { root } = await openSignedInApp();
    const shell = root.querySelector('app-layout');
    root.querySelector<HTMLAnchorElement>('nav a[href="/image-generator"]')!.click();
    await fixture!.whenStable();
    expect(root.querySelector('app-layout')).toBe(shell);
  });

  it('marks the active navigation link after a route change', async () => {
    const { root, router } = await openSignedInApp();
    await router.navigateByUrl('/image-generator');
    await fixture!.whenStable();
    expect(
      root
        .querySelector('nav[aria-label="Primary navigation"] [aria-current="page"]')
        ?.textContent?.trim(),
    ).toBe('Image Generator');
  });

  it('updates the document title after a route change', async () => {
    const { router } = await openSignedInApp();
    await router.navigateByUrl('/image-generator');
    await fixture!.whenStable();
    expect(document.title).toBe('Image Generator | Tempics');
  });

  it('moves focus into the main landmark after a route change', async () => {
    const { root, router } = await openSignedInApp();
    await router.navigateByUrl('/image-generator');
    await fixture!.whenStable();
    const main = root.querySelector('main')!;
    expect(document.activeElement).toBe(main);
  });

  it('moves focus to main through the skip link', async () => {
    const { root } = await openSignedInApp();
    const main = root.querySelector('main')!;
    const skipLink = root.querySelector<HTMLAnchorElement>('a[href="#main-content"]')!;
    skipLink.focus();
    skipLink.click();
    expect(document.activeElement).toBe(main);
  });

  it('returns to the sign-in view after sign-out', async () => {
    const { root } = await openSignedInApp();
    Array.from(root.querySelectorAll('button'))
      .find((entry) => entry.textContent?.trim() === 'Sign out')!
      .click();
    await fixture!.whenStable();
    expect(root.querySelector('button')?.textContent?.trim()).toBe('Sign in');
  });
});
