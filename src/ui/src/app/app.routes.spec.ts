import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
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
  it('signs in, generates a preview, and returns to the home page on sign out', async () => {
    const config = CONFIG_FIXTURE;
    TestBed.configureTestingModule({
      imports: [App],
      providers: [...createAppConfig(config).providers, provideHttpClientTesting()],
    });
    const originalCreate = Object.getOwnPropertyDescriptor(URL, 'createObjectURL');
    const originalRevoke = Object.getOwnPropertyDescriptor(URL, 'revokeObjectURL');
    const createUrl = vi.fn().mockReturnValue('blob:sample');
    const revokeUrl = vi.fn();
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createUrl });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revokeUrl });
    const fixture = TestBed.createComponent(App);
    try {
      await fixture.whenStable();
      await TestBed.inject(Router).navigateByUrl('/');
      await fixture.whenStable();
      const root: HTMLElement = fixture.nativeElement;
      const http = TestBed.inject(HttpTestingController);
      expect(root.querySelectorAll('button')).toHaveLength(1);
      expect(root.querySelector('button')?.textContent?.trim()).toBe('Sign in');
      expect(root.querySelector('nav')).toBeNull();
      expect(root.querySelector('app-image-generator')).toBeNull();
      http.expectNone(() => true);
      root.querySelector<HTMLButtonElement>('button')!.click();
      await fixture.whenStable();
      expect(TestBed.inject(Router).url).toBe('/');
      http.expectNone(() => true);
      const button = Array.from(root.querySelectorAll('button')).find((entry) =>
        /generate sample image/i.test(entry.textContent ?? ''),
      );
      expect(button).toBeDefined();
      button!.click();
      await fixture.whenStable();
      const request = http.expectOne(`${config.apiBaseUrl}/renders/sample`);
      expect(request.request.headers.get('Authorization')).toBe('Bearer fixture-access-token');
      const png = new Blob(['sample'], { type: 'image/png' });
      request.flush(png);
      await fixture.whenStable();
      expect(createUrl).toHaveBeenCalledWith(png);
      expect(root.querySelector('img')?.getAttribute('src')).toBe('blob:sample');
      http.verify();

      Array.from(root.querySelectorAll('button'))
        .find((entry) => entry.textContent?.trim() === 'Sign out')!
        .click();
      await fixture.whenStable();
      expect(TestBed.inject(Router).url).toBe('/');
      expect(root.querySelector('button')?.textContent?.trim()).toBe('Sign in');
      expect(root.querySelector('nav')).toBeNull();
      expect(root.querySelector('img')).toBeNull();
      expect(revokeUrl).toHaveBeenCalledExactlyOnceWith('blob:sample');
      await TestBed.inject(Router).navigateByUrl('/image-generator');
      await fixture.whenStable();
      expect(TestBed.inject(Router).url).toBe('/');

      root.querySelector<HTMLButtonElement>('button')!.click();
      await fixture.whenStable();
      expect(TestBed.inject(Router).url).toBe('/');
      expect(root.querySelector('img')).toBeNull();
      http.expectNone(() => true);
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
  it('opens and selects each shared-control example without API providers', async () => {
    TestBed.configureTestingModule({ providers: [provideRouter(routes)] });
    const harness = await RouterTestingHarness.create('/component-lab');
    expect(harness.routeNativeElement?.querySelector('h1')?.textContent).toBe('Component Lab');
    expect(harness.routeNativeElement?.querySelector('h2')?.textContent).toBe('Button');
    expect(harness.routeNativeElement?.querySelector('app-button button')).not.toBeNull();
    const examples = [
      ['Button Link', 'app-button-link a'],
      ['Icon', 'app-icon'],
      ['Input', 'app-input input'],
      ['Alert', 'app-alert[role="status"]'],
      ['Progress Bar', 'app-progress-bar [role="progressbar"]'],
    ] as const;
    for (const [label, selector] of examples) {
      const item = Array.from(
        harness.routeNativeElement!.querySelectorAll<HTMLButtonElement>('nav[aria-label="Components"] button'),
      ).find((button) => button.textContent?.trim() === label);
      expect(item, `Lab entry ${label}`).toBeDefined();
      item!.click();
      harness.detectChanges();
      expect(harness.routeNativeElement?.querySelector('h2')?.textContent).toBe(label);
      expect(harness.routeNativeElement?.querySelector(selector)).not.toBeNull();
    }
    expect(TestBed.inject(Router).url).toBe('/component-lab');
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
      const shell = root.querySelector('app-layout');
      const navLink = root.querySelector<HTMLAnchorElement>(
        'nav[aria-label="Primary navigation"] a[href="/templates"]',
      );
      expect(navLink).not.toBeNull();

      navLink!.click();
      await fixture.whenStable();
      expect(router.url).toBe('/templates');
      expect(root.querySelector('app-layout')).toBe(shell);
      expect(root.querySelectorAll('main')).toHaveLength(1);
      expect(main.querySelector('h1')?.textContent?.trim()).toBe('Templates');
      expect(navLink!.getAttribute('aria-current')).toBe('page');
      expect(document.title).toBe('Templates | Tempics');
      expect(document.activeElement).toBe(main);

      const http = TestBed.inject(HttpTestingController);
      const request = http.expectOne(`${config.apiBaseUrl}/templates`);
      expect(request.request.method).toBe('GET');
      expect(request.request.headers.get('Authorization')).toBe('Bearer fixture-access-token');
      request.flush({
        items: [
          { id: '11111111-1111-1111-1111-111111111111', name: 'Spring sale' },
          { id: '22222222-2222-2222-2222-222222222222', name: 'Summer launch' },
        ],
      });
      await fixture.whenStable();
      expect(main.textContent).toContain('Spring sale');
      expect(main.textContent).toContain('Summer launch');
      expect(main.textContent).toMatch(/2\s+templates/i);
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
      expect(request.cancelled).toBe(false);

      await router.navigateByUrl('/component-lab');
      await fixture.whenStable();
      expect(request.cancelled).toBe(true);
      expect(fixture.nativeElement.querySelector('app-templates')).toBeNull();
      expect(fixture.nativeElement.querySelector('app-component-lab')).not.toBeNull();
      http.verify({ ignoreCancelled: true });
    } finally {
      fixture.destroy();
    }
  });

  it('opens the guarded create page from Add and reloads the list after a confirmed create', async () => {
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
      expect(addLink?.textContent).toContain('Add Template');
      addLink!.click();
      await fixture.whenStable();
      expect(router.url).toBe('/templates/new');
      expect(document.title).toBe('Create Template | Tempics');
      expect(main.querySelector('app-template-create')).not.toBeNull();
      expect(document.activeElement).toBe(main);
      const templatesNav = root.querySelector<HTMLAnchorElement>(
        'nav[aria-label="Primary navigation"] a[href="/templates"]',
      );
      expect(templatesNav?.getAttribute('aria-current')).toBe('page');
      http.expectNone(() => true);

      const name = main.querySelector<HTMLInputElement>('app-template-create app-input input')!;
      const template = main.querySelector<HTMLTextAreaElement>('app-template-create app-input textarea')!;
      expect(name.value).toBe('Event invitation');
      expect(template.value).toContain('You are invited');
      name.value = '  Launch invitation  ';
      name.dispatchEvent(new Event('input', { bubbles: true }));
      await fixture.whenStable();
      const save = Array.from(main.querySelectorAll<HTMLButtonElement>('button')).find(
        (button) => button.textContent?.trim() === 'Save template',
      );
      expect(save?.disabled).toBe(false);
      save!.click();
      await fixture.whenStable();
      const create = http.expectOne(`${config.apiBaseUrl}/templates`);
      expect(create.request.method).toBe('POST');
      expect(create.request.headers.get('Authorization')).toBe('Bearer fixture-access-token');
      expect(create.request.body).toEqual({ name: 'Launch invitation', template: template.value });
      create.flush(
        { id: '33333333-3333-3333-3333-333333333333', name: 'Launch invitation' },
        { status: 201, statusText: 'Created' },
      );
      await fixture.whenStable();
      expect(router.url).toBe('/templates');
      const list = http.expectOne(`${config.apiBaseUrl}/templates`);
      expect(list.request.method).toBe('GET');
      expect(list.request.headers.get('Authorization')).toBe('Bearer fixture-access-token');
      list.flush({
        items: [{ id: '33333333-3333-3333-3333-333333333333', name: 'Launch invitation' }],
      });
      await fixture.whenStable();
      expect(main.querySelector('app-templates')?.textContent).toContain('Launch invitation');
      expect(templatesNav?.getAttribute('aria-current')).toBe('page');
      http.verify();
    } finally {
      fixture.destroy();
    }
  });
});

describe('Home route', () => {
  it.each(['/', '/image-generator', '/templates', '/templates/new'])(
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
      expect(harness.routeNativeElement?.querySelector('app-image-generator')).toBeNull();
      expect(harness.routeNativeElement?.querySelector('app-templates')).toBeNull();
      expect(harness.routeNativeElement?.querySelector('app-template-create')).toBeNull();
      expect(harness.routeNativeElement?.querySelector('nav')).toBeNull();
      expect(document.title).toBe('Home | Tempics');
      TestBed.inject(HttpTestingController).expectNone(() => true);
    },
  );
});

describe('Application layout', () => {
  it('keeps the shell across pages, marks the current link, and moves focus into new content', async () => {
    const config = CONFIG_FIXTURE;
    TestBed.configureTestingModule({
      imports: [App],
      providers: [...createAppConfig(config).providers, provideHttpClientTesting()],
    });
    await TestBed.inject(AuthSession).signIn();
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/component-lab');
    await fixture.whenStable();
    const root: HTMLElement = fixture.nativeElement;
    const shell = root.querySelector('app-layout');
    const main = root.querySelector('main')!;
    const currentLink = () =>
      root.querySelector('nav[aria-label="Primary navigation"] [aria-current="page"]');

    expect(root.querySelectorAll('main')).toHaveLength(1);
    expect(currentLink()?.textContent?.trim()).toBe('Component Lab');
    expect(document.title).toBe('Component Lab | Tempics');

    root.querySelector<HTMLAnchorElement>('nav a[href="/image-generator"]')!.click();
    await fixture.whenStable();
    expect(router.url).toBe('/image-generator');
    expect(root.querySelector('app-layout')).toBe(shell);
    expect(root.querySelectorAll('main')).toHaveLength(1);
    expect(main.querySelector('h1')?.textContent).toBe('Image Generator');
    expect(currentLink()?.textContent?.trim()).toBe('Image Generator');
    expect(document.title).toBe('Image Generator | Tempics');
    expect(document.activeElement).toBe(main);

    await router.navigateByUrl('/');
    await fixture.whenStable();
    expect(router.url).toBe('/');
    expect(root.querySelector('app-image-generator')).not.toBeNull();

    await router.navigateByUrl('/component-lab?example=button');
    await fixture.whenStable();
    expect(currentLink()?.textContent?.trim()).toBe('Component Lab');
    expect(main.querySelector('h1')?.textContent).toBe('Component Lab');
    expect(document.activeElement).toBe(main);

    const skipLink = root.querySelector<HTMLAnchorElement>('a[href="#main-content"]')!;
    skipLink.focus();
    skipLink.click();
    expect(document.activeElement).toBe(main);
    expect(router.url).toBe('/component-lab?example=button');
    TestBed.inject(HttpTestingController).expectNone(() => true);
  });
});
