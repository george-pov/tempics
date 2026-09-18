import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ImageRenderApi } from './image-render-api';
import { CONFIG } from '../../config/config-token';

describe('ImageRenderApi', () => {
  it('posts a PNG request without a shared Function key', () => {
    const config = {
      environment: 'dev',
      apiBaseUrl: 'https://dev.example.test/api',
    };
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: CONFIG, useValue: config },
      ],
    });
    const http = TestBed.inject(HttpTestingController);
    TestBed.inject(ImageRenderApi).renderSample().subscribe();

    const request = http.expectOne(`${config.apiBaseUrl}/renders/sample`);
    expect(request.request.method).toBe('POST');
    expect(request.request.headers.has('x-functions-key')).toBe(false);
    expect(request.request.headers.has('Authorization')).toBe(false);
    expect(request.request.body).toBeNull();
    expect(request.request.responseType).toBe('blob');
    request.flush(new Blob(['sample'], { type: 'image/png' }));
    http.verify();
  });

  it('posts to the configured path prefix and returns the PNG without credentials', () => {
    const config = { environment: 'prod', apiBaseUrl: 'https://prod.example.test/prefix/api' };
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
    TestBed.inject(ImageRenderApi).renderSample().subscribe(receive);

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
