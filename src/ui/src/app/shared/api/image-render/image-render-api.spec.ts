import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ImageRenderApi } from './image-render-api';
import { CONFIG } from '../../config/config-token';
import { CONFIG_FIXTURE } from '../../config/config-fixture';

describe('ImageRenderApi', () => {
  const apiBaseUrl = 'https://api.example.test/prefix/api';
  let http: HttpTestingController;
  let api: ImageRenderApi;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: CONFIG, useValue: { ...CONFIG_FIXTURE, apiBaseUrl } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    api = TestBed.inject(ImageRenderApi);
  });

  afterEach(() => http.verify());

  it.each([
    {
      operation: 'sample',
      send: (client: ImageRenderApi) => client.renderSample().subscribe(),
      path: '/renders/sample',
    },
    {
      operation: 'preview',
      send: (client: ImageRenderApi) => client.renderPreview('<Border />').subscribe(),
      path: '/renders/preview',
    },
  ])('keeps $operation requests free of browser credentials and shared keys',
    ({ send, path }) => {
      send(api);
      const request = http.expectOne(`${apiBaseUrl}${path}`);
      expect(request.request.withCredentials).toBe(false);
      expect(request.request.headers.has('x-functions-key')).toBe(false);
      expect(request.request.headers.has('Authorization')).toBe(false);
      request.flush(new Blob(['sample'], { type: 'image/png' }));
    },
  );

  it('posts an empty sample request and returns the PNG blob', () => {
    const receive = vi.fn();
    const png = new Blob(['sample'], { type: 'image/png' });
    api.renderSample().subscribe(receive);
    const request = http.expectOne(`${apiBaseUrl}/renders/sample`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toBeNull();
    expect(request.request.responseType).toBe('blob');
    request.flush(png);
    expect(receive).toHaveBeenCalledExactlyOnceWith(png);
  });

  it('posts the unsaved template to the preview route and returns a PNG blob', () => {
    const receive = vi.fn();
    const png = new Blob(['preview'], { type: 'image/png' });
    api.renderPreview('<Border />').subscribe(receive);
    const request = http.expectOne(`${apiBaseUrl}/renders/preview`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ template: '<Border />' });
    expect(request.request.responseType).toBe('blob');
    request.flush(png);
    expect(receive).toHaveBeenCalledExactlyOnceWith(png);
  });
});
