import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from './app.routes';
import { App } from './app';
import { createAppConfig } from './app.config';

describe('Home route', () => {
  it('generates a preview through the real app shell, route, and API client', async () => {
    const config = { environment: 'local' as const, apiBaseUrl: 'http://localhost:7159/api' };
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
      const button = Array.from(root.querySelectorAll('button')).find((entry) =>
        /generate sample image/i.test(entry.textContent ?? ''),
      );
      expect(button).toBeDefined();
      button!.click();
      const http = TestBed.inject(HttpTestingController);
      const request = http.expectOne(`${config.apiBaseUrl}/renders/sample`);
      const png = new Blob(['sample'], { type: 'image/png' });
      request.flush(png);
      await fixture.whenStable();
      expect(createUrl).toHaveBeenCalledWith(png);
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
  it('opens the button workbench directly without API providers', async () => {
    TestBed.configureTestingModule({ providers: [provideRouter(routes)] });
    const harness = await RouterTestingHarness.create('/component-lab');
    expect(harness.routeNativeElement?.querySelector('h1')?.textContent).toBe('Component Lab');
    expect(harness.routeNativeElement?.querySelector('h2')?.textContent).toBe('Button');
    expect(harness.routeNativeElement?.querySelector('app-button button')).not.toBeNull();
  });
});
