import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { CONFIG } from '../../config/config-token';
import { CONFIG_FIXTURE } from '../../config/config-fixture';
import { TemplateApi } from './template-api';
import type { TemplateListResponse } from './template-list-response';

describe('TemplateApi', () => {
  it('gets every list item in API order from the configured path', () => {
    const apiBaseUrl = 'https://api.example.test/prefix/api';
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: CONFIG, useValue: { ...CONFIG_FIXTURE, apiBaseUrl } },
      ],
    });
    const http = TestBed.inject(HttpTestingController);
    const receive = vi.fn();
    TestBed.inject(TemplateApi).listTemplates().subscribe(receive);

    const request = http.expectOne(`${apiBaseUrl}/templates`);
    expect(request.request.method).toBe('GET');
    expect(request.request.body).toBeNull();
    expect(request.request.params.keys()).toEqual([]);
    expect(request.request.withCredentials).toBe(false);
    expect(request.request.headers.has('x-functions-key')).toBe(false);
    expect(request.request.headers.has('Authorization')).toBe(false);

    const response: TemplateListResponse = {
      items: [
        { id: '11111111-1111-1111-1111-111111111111', name: 'Shared name' },
        { id: '22222222-2222-2222-2222-222222222222', name: 'Other name' },
        { id: '33333333-3333-3333-3333-333333333333', name: 'Shared name' },
      ],
    };
    request.flush(response);
    expect(receive).toHaveBeenCalledExactlyOnceWith(response);
    http.verify();
  });
});
