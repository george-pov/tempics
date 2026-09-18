import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { CONFIG } from '../config/config-token';
import { CONFIG_FIXTURE } from '../config/config-fixture';
import { ImageRenderApi } from '../api/image-render/image-render-api';
import { AuthSession } from './auth-session';
import { bearerInterceptor } from './bearer-interceptor';

describe('bearerInterceptor', () => {
  const apiBaseUrl = 'https://api.example.test/prefix/api';
  let acquireApiToken: ReturnType<typeof vi.fn>;
  let http: HttpTestingController;

  beforeEach(() => {
    acquireApiToken = vi.fn().mockResolvedValue('fixture-access-token');
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([bearerInterceptor])),
        provideHttpClientTesting(),
        {
          provide: CONFIG,
          useValue: { ...CONFIG_FIXTURE, apiBaseUrl, functionKey: 'fixture-key' },
        },
        { provide: AuthSession, useValue: { acquireApiToken } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('sends a bearer token and preserves the Function key and PNG contract', async () => {
    const result = firstValueFrom(TestBed.inject(ImageRenderApi).renderSample());
    await Promise.resolve();
    const request = http.expectOne(`${apiBaseUrl}/renders/sample`);
    expect(request.request.headers.get('Authorization')).toBe('Bearer fixture-access-token');
    expect(request.request.headers.get('x-functions-key')).toBe('fixture-key');
    expect(request.request.urlWithParams).not.toContain('fixture');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toBeNull();
    expect(request.request.responseType).toBe('blob');
    const png = new Blob(['sample'], { type: 'image/png' });
    request.flush(png);
    expect(await result).toBe(png);
  });

  it.each([
    'https://api.example.test.evil.test/prefix/api/renders/sample',
    'https://api.example.test:444/prefix/api/renders/sample',
    'http://api.example.test/prefix/api/renders/sample',
    'https://api.example.test/prefix/api-extra',
    'https://api.example.test/elsewhere',
    'https://api.example.test/prefix/api/../../elsewhere',
    '/config.json',
  ])('does not send a token to %s', (url) => {
    TestBed.inject(HttpClient).get(url).subscribe();
    const request = http.expectOne(url);
    expect(request.request.headers.has('Authorization')).toBe(false);
    expect(acquireApiToken).not.toHaveBeenCalled();
    request.flush({});
  });

  it('does not send the render request when token acquisition fails', async () => {
    acquireApiToken.mockRejectedValue(new Error('sign-in required'));
    await expect(firstValueFrom(TestBed.inject(ImageRenderApi).renderSample())).rejects.toThrow(
      'sign-in required',
    );
    http.expectNone(() => true);
  });
});
