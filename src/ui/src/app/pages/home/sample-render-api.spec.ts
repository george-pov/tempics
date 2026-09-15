import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { SampleRenderApi } from './sample-render-api';
import { CONFIG } from '../../shared/config/config-token';

describe('SampleRenderApi', () => {
  it.each([
    { environment: 'local', apiBaseUrl: 'http://localhost:7159/api' },
    { environment: 'dev', apiBaseUrl: 'https://dev.example.test/api' },
    { environment: 'prod', apiBaseUrl: 'https://prod.example.test/prefix/api' },
  ])('posts directly using $environment settings without credentials', (config) => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: CONFIG, useValue: config },
      ],
    });
    const http = TestBed.inject(HttpTestingController);
    const receive = vi.fn();
    const png = new Blob(['sample'], { type: 'image/png' });
    TestBed.inject(SampleRenderApi).renderSample().subscribe(receive);

    const request = http.expectOne(`${config.apiBaseUrl}/renders/sample`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toBeNull();
    expect(request.request.responseType).toBe('blob');
    expect(request.request.headers.has('x-functions-key')).toBe(false);
    expect(request.request.headers.has('Authorization')).toBe(false);
    expect(request.request.withCredentials).toBe(false);
    request.flush(png);
    expect(receive).toHaveBeenCalledWith(png);
    http.verify();
  });
});
