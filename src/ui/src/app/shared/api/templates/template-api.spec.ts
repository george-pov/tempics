import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { CONFIG } from '../../config/config-token';
import { CONFIG_FIXTURE } from '../../config/config-fixture';
import { TemplateApi } from './template-api';
import type { TemplateDetail } from './template-detail';
import type { TemplateListResponse } from './template-list-response';
import type { TemplateSummary } from './template-summary';

describe('TemplateApi', () => {
  const apiBaseUrl = 'https://api.example.test/prefix/api';
  let http: HttpTestingController;
  let api: TemplateApi;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: CONFIG, useValue: { ...CONFIG_FIXTURE, apiBaseUrl } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    api = TestBed.inject(TemplateApi);
  });

  afterEach(() => http.verify());

  it.each([
    {
      operation: 'list',
      send: (client: TemplateApi) => client.listTemplates().subscribe(),
      path: '/templates',
      response: { items: [] },
      status: 200,
      statusText: 'OK',
    },
    {
      operation: 'detail',
      send: (client: TemplateApi) => client.getTemplate('id').subscribe(),
      path: '/templates/id',
      response: { id: 'id', name: 'Name', template: '<Border />' },
      status: 200,
      statusText: 'OK',
    },
    {
      operation: 'create',
      send: (client: TemplateApi) =>
        client.createTemplate({ name: 'Name', template: '<Border />' }).subscribe(),
      path: '/templates',
      response: { id: 'id', name: 'Name' },
      status: 201,
      statusText: 'Created',
    },
    {
      operation: 'update',
      send: (client: TemplateApi) =>
        client.updateTemplate('id', { name: 'Name', template: '<Border />' }).subscribe(),
      path: '/templates/id',
      response: null,
      status: 204,
      statusText: 'No Content',
    },
    {
      operation: 'delete',
      send: (client: TemplateApi) => client.deleteTemplate('id').subscribe(),
      path: '/templates/id',
      response: null,
      status: 204,
      statusText: 'No Content',
    },
  ])(
    'keeps $operation requests free of browser credentials and shared keys',
    ({ send, path, response, status, statusText }) => {
      send(api);
      const request = http.expectOne(`${apiBaseUrl}${path}`);
      expect(request.request.withCredentials).toBe(false);
      expect(request.request.headers.has('x-functions-key')).toBe(false);
      expect(request.request.headers.has('Authorization')).toBe(false);
      request.flush(response, { status, statusText });
    },
  );

  it('gets every list item in API order from the configured path', () => {
    const receive = vi.fn();
    api.listTemplates().subscribe(receive);
    const request = http.expectOne(`${apiBaseUrl}/templates`);
    expect(request.request.method).toBe('GET');

    const response: TemplateListResponse = {
      items: [
        { id: '11111111-1111-1111-1111-111111111111', name: 'Shared name' },
        { id: '22222222-2222-2222-2222-222222222222', name: 'Other name' },
        { id: '33333333-3333-3333-3333-333333333333', name: 'Shared name' },
      ],
    };
    request.flush(response);
    expect(receive).toHaveBeenCalledExactlyOnceWith(response);
  });

  it('posts the exact create payload and returns a confirmed 201 body', () => {
    const receive = vi.fn();
    const detail: TemplateDetail = {
      id: null,
      name: 'Event invitation',
      template: '<Border>  exact text  </Border>',
    };
    api.createTemplate(detail).subscribe(receive);
    const request = http.expectOne(`${apiBaseUrl}/templates`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ name: detail.name, template: detail.template });
    expect(Object.keys(request.request.body)).toEqual(['name', 'template']);

    const response: TemplateSummary = {
      id: '11111111-1111-1111-1111-111111111111',
      name: 'Event invitation',
    };
    request.flush(response, { status: 201, statusText: 'Created' });
    expect(receive).toHaveBeenCalledExactlyOnceWith(response);
  });

  it.each([
    { description: 'a different successful status', status: 200, body: { id: 'id', name: 'Name' } },
    { description: 'an empty body', status: 201, body: null },
    { description: 'a body without an id', status: 201, body: { name: 'Name' } },
    { description: 'a body without a name', status: 201, body: { id: 'id' } },
  ])('rejects $description instead of confirming creation', ({ status, body }) => {
    const reject = vi.fn();
    api.createTemplate({ name: 'Name', template: '<Border />' }).subscribe({ error: reject });
    http.expectOne(`${apiBaseUrl}/templates`).flush(body, {
      status,
      statusText: status === 201 ? 'Created' : 'OK',
    });
    expect(reject).toHaveBeenCalledExactlyOnceWith(expect.any(Error));
  });

  it('gets one detail from the configured URL with the ID encoded as one segment', () => {
    const receive = vi.fn();
    const id = '11111111-1111-1111-1111-111111111111/?name=other#fragment';
    api.getTemplate(id).subscribe(receive);
    const request = http.expectOne(`${apiBaseUrl}/templates/${encodeURIComponent(id)}`);
    expect(request.request.method).toBe('GET');
    expect(request.request.body).toBeNull();

    const detail: TemplateDetail = {
      id,
      name: 'Event invitation',
      template: '<Border>  exact text  </Border>\n',
    };
    request.flush(detail);
    expect(receive).toHaveBeenCalledExactlyOnceWith(detail);
  });

  it('passes a failed detail response to the caller', () => {
    const reject = vi.fn();
    api.getTemplate('id').subscribe({ error: reject });
    http.expectOne(`${apiBaseUrl}/templates/id`).flush(null, {
      status: 404,
      statusText: 'Not Found',
    });
    expect(reject).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ status: 404 }));
  });

  it('puts both fields to one encoded ID and accepts a bodyless success', () => {
    const receive = vi.fn();
    const id = '11111111-1111-1111-1111-111111111111/?name=other#fragment';
    const detail: TemplateDetail = {
      id,
      name: 'Event invitation',
      template: '<Border>  exact text  </Border>\n',
    };
    api.updateTemplate(id, detail).subscribe(receive);
    const request = http.expectOne(`${apiBaseUrl}/templates/${encodeURIComponent(id)}`);
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual({ name: detail.name, template: detail.template });
    expect(Object.keys(request.request.body)).toEqual(['name', 'template']);
    expect(request.request.headers.has('If-Match')).toBe(false);
    request.flush(null, { status: 204, statusText: 'No Content' });
    expect(receive).toHaveBeenCalledExactlyOnceWith(undefined);
  });

  it('passes a failed update response to the caller', () => {
    const reject = vi.fn();
    api.updateTemplate('id', { name: 'Name', template: '<Border />' }).subscribe({ error: reject });
    http.expectOne(`${apiBaseUrl}/templates/id`).flush(null, {
      status: 503,
      statusText: 'Service Unavailable',
    });
    expect(reject).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ status: 503 }));
  });

  it('deletes the encoded ID with a bodyless request and accepts 204', () => {
    const receive = vi.fn();
    const id = '11111111-1111-1111-1111-111111111111/?name=other#fragment';
    api.deleteTemplate(id).subscribe(receive);
    const request = http.expectOne(`${apiBaseUrl}/templates/${encodeURIComponent(id)}`);
    expect(request.request.method).toBe('DELETE');
    expect(request.request.body).toBeNull();
    request.flush(null, { status: 204, statusText: 'No Content' });
    expect(receive).toHaveBeenCalledOnce();
  });

  it('accepts an HTTP 200 delete response', () => {
    const receive = vi.fn();
    const id = '11111111-1111-1111-1111-111111111111';
    api.deleteTemplate(id).subscribe(receive);
    http.expectOne(`${apiBaseUrl}/templates/${id}`).flush('deleted', {
      status: 200,
      statusText: 'OK',
    });
    expect(receive).toHaveBeenCalledOnce();
  });

  it('passes a failed delete response to the caller', () => {
    const reject = vi.fn();
    const id = '11111111-1111-1111-1111-111111111111';
    api.deleteTemplate(id).subscribe({ error: reject });
    http.expectOne(`${apiBaseUrl}/templates/${id}`).flush(null, {
      status: 503,
      statusText: 'Service Unavailable',
    });
    expect(reject).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ status: 503 }));
  });
});
