import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from './app.routes';
import { App } from './app';
import { createAppConfig } from './app.config';
import { DemoSession } from './shared/session/demo-session';

describe('Image Generator route', () => {
  it('signs in, generates a preview, and returns to the home page on sign out', async () => {
    const config = { environment: 'local' as const, apiBaseUrl: 'http://localhost:7159/api' };
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
      expect(TestBed.inject(Router).url).toBe('/image-generator');
      expect(document.activeElement).toBe(root.querySelector('main'));
      http.expectNone(() => true);
      const button = Array.from(root.querySelectorAll('button')).find((entry) =>
        /generate sample image/i.test(entry.textContent ?? ''),
      );
      expect(button).toBeDefined();
      button!.click();
      const request = http.expectOne(`${config.apiBaseUrl}/renders/sample`);
      const png = new Blob(['sample'], { type: 'image/png' });
      request.flush(png);
      await fixture.whenStable();
      expect(createUrl).toHaveBeenCalledWith(png);
      expect(root.querySelector('img')?.getAttribute('src')).toBe('blob:sample');
      http.verify();

      Array.from(root.querySelectorAll('button')).find((entry) =>
        entry.textContent?.trim() === 'Sign out',
      )!.click();
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
      expect(TestBed.inject(Router).url).toBe('/image-generator');
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
  it('opens the button workbench directly without API providers', async () => {
    TestBed.configureTestingModule({ providers: [provideRouter(routes)] });
    const harness = await RouterTestingHarness.create('/component-lab');
    expect(harness.routeNativeElement?.querySelector('h1')?.textContent).toBe('Component Lab');
    expect(harness.routeNativeElement?.querySelector('h2')?.textContent).toBe('Button');
    expect(harness.routeNativeElement?.querySelector('app-button button')).not.toBeNull();
  });
});

describe('Home route', () => {
  it.each(['/', '/image-generator'])('starts a fresh app at the sign-in page when opening %s', async (url) => {
    TestBed.configureTestingModule({ providers: [provideRouter(routes)] });
    const harness = await RouterTestingHarness.create(url);
    expect(TestBed.inject(Router).url).toBe('/');
    expect(harness.routeNativeElement?.querySelector('button')?.textContent?.trim()).toBe('Sign in');
    expect(harness.routeNativeElement?.querySelector('app-image-generator')).toBeNull();
    expect(harness.routeNativeElement?.querySelector('nav')).toBeNull();
    expect(document.title).toBe('Home | Tempics');
  });
});

describe('Application layout', () => {
  it('keeps the shell across pages, marks the current link, and moves focus into new content', async () => {
    const config = { environment: 'local' as const, apiBaseUrl: 'http://localhost:7159/api' };
    TestBed.configureTestingModule({
      imports: [App],
      providers: [...createAppConfig(config).providers, provideHttpClientTesting()],
    });
    TestBed.inject(DemoSession).signIn();
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/component-lab');
    await fixture.whenStable();
    const root: HTMLElement = fixture.nativeElement;
    const shell = root.querySelector('app-layout');
    const main = root.querySelector('main')!;
    const currentLink = () => root.querySelector('nav[aria-label="Primary navigation"] [aria-current="page"]');

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
    expect(router.url).toBe('/image-generator');

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
