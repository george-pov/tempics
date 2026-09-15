import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from './app.routes';
import { CONFIG } from './shared/config/config-token';

describe('Home route', () => {
  it('opens the home page at the root URL', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter(routes),
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: CONFIG,
          useValue: { environment: 'local', apiBaseUrl: 'http://localhost:7159/api' },
        },
      ],
    });
    const harness = await RouterTestingHarness.create('/');
    expect(harness.routeNativeElement?.querySelector('button')?.textContent?.trim()).toBe(
      'Generate sample image',
    );
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
