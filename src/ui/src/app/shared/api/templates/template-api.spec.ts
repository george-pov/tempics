import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { CONFIG } from '../../config/config-token';
import { CONFIG_FIXTURE } from '../../config/config-fixture';
import type { CreateTemplateRequest } from './create-template-request';
import type { CreateTemplateResponse } from './create-template-response';
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

  it('posts the exact create payload once and returns a confirmed 201 body', () => {
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
    const payload: CreateTemplateRequest = {
      name: 'Event invitation',
      template: '<Border>  exact text  </Border>',
    };

    TestBed.inject(TemplateApi).createTemplate(payload).subscribe(receive);

    const request = http.expectOne(`${apiBaseUrl}/templates`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual(payload);
    expect(request.request.params.keys()).toEqual([]);
    expect(request.request.withCredentials).toBe(false);
    expect(request.request.headers.has('x-functions-key')).toBe(false);
    expect(request.request.headers.has('Authorization')).toBe(false);

    const response: CreateTemplateResponse = {
      id: '11111111-1111-1111-1111-111111111111',
      name: 'Event invitation',
    };
    request.flush(response, { status: 201, statusText: 'Created' });
    expect(receive).toHaveBeenCalledExactlyOnceWith(response);
    http.verify();
  });

  it.each([
    { description: 'a different successful status', status: 200, body: { id: 'id', name: 'Name' } },
    { description: 'an empty body', status: 201, body: null },
    { description: 'a body without an id', status: 201, body: { name: 'Name' } },
    { description: 'a body without a name', status: 201, body: { id: 'id' } },
  ])('rejects $description instead of confirming creation', ({ status, body }) => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: CONFIG, useValue: CONFIG_FIXTURE },
      ],
    });
    const http = TestBed.inject(HttpTestingController);
    const receive = vi.fn();
    const reject = vi.fn();

    TestBed.inject(TemplateApi)
      .createTemplate({ name: 'Name', template: '<Border />' })
      .subscribe({ next: receive, error: reject });

    const request = http.expectOne(`${CONFIG_FIXTURE.apiBaseUrl}/templates`);
    request.flush(body, { status, statusText: status === 201 ? 'Created' : 'OK' });
    expect(receive).not.toHaveBeenCalled();
    expect(reject).toHaveBeenCalledExactlyOnceWith(expect.any(Error));
    http.verify();
  });
});
