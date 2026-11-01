import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  ActivatedRoute,
  convertToParamMap,
  type ParamMap,
  provideRouter,
  Router,
} from '@angular/router';
import { BehaviorSubject, Subject } from 'rxjs';
import { ImageRenderApi } from '../../shared/api/image-render/image-render-api';
import { TemplateApi } from '../../shared/api/templates/template-api';
import type { TemplateDetail } from '../../shared/api/templates/template-detail';
import { TemplateEditor } from './template-editor';

describe('TemplateEditor edit mode', () => {
  const id = '11111111-1111-1111-1111-111111111111';
  const nextId = '22222222-2222-2222-2222-222222222222';
  const saved: TemplateDetail = {
    id,
    name: 'Event invitation',
    template: '<Border />\n  ',
  };

  let fixture: ComponentFixture<TemplateEditor>;
  let routeParams: BehaviorSubject<ParamMap>;
  let routeSnapshot: { paramMap: ParamMap };
  let detailResponse: Subject<TemplateDetail>;
  let detailResponses: Map<string, Subject<TemplateDetail>>;
  let updateResponse: Subject<void>;
  let updateResponses: Subject<void>[];
  let previewResponse: Subject<Blob>;
  let getTemplate: ReturnType<typeof vi.fn>;
  let updateTemplate: ReturnType<typeof vi.fn>;
  let createTemplate: ReturnType<typeof vi.fn>;
  let renderPreview: ReturnType<typeof vi.fn>;
  let navigateByUrl: ReturnType<typeof vi.spyOn>;
  let createUrl: ReturnType<typeof vi.fn>;
  let revokeUrl: ReturnType<typeof vi.fn>;
  const png = new Blob(['preview'], { type: 'image/png' });
  const originalCreate = Object.getOwnPropertyDescriptor(URL, 'createObjectURL');
  const originalRevoke = Object.getOwnPropertyDescriptor(URL, 'revokeObjectURL');

  beforeEach(async () => {
    routeParams = new BehaviorSubject<ParamMap>(convertToParamMap({ id }));
    routeSnapshot = { paramMap: routeParams.value };
    detailResponse = new Subject<TemplateDetail>();
    detailResponses = new Map([[id, detailResponse]]);
    updateResponse = new Subject<void>();
    updateResponses = [updateResponse];
    previewResponse = new Subject<Blob>();
    getTemplate = vi.fn((requestedId: string) => {
      let response = detailResponses.get(requestedId);
      if (!response) {
        response = new Subject<TemplateDetail>();
        detailResponses.set(requestedId, response);
      }
      return response.asObservable();
    });
    let nextUpdate = 0;
    updateTemplate = vi.fn(() => {
      const response = updateResponses[nextUpdate] ?? new Subject<void>();
      updateResponses[nextUpdate] = response;
      nextUpdate++;
      return response.asObservable();
    });
    createTemplate = vi.fn();
    renderPreview = vi.fn(() => previewResponse.asObservable());
    createUrl = vi.fn().mockReturnValueOnce('blob:first').mockReturnValueOnce('blob:second');
    revokeUrl = vi.fn();
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      writable: true,
      value: createUrl,
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      writable: true,
      value: revokeUrl,
    });
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: routeSnapshot, paramMap: routeParams.asObservable() },
        },
        { provide: TemplateApi, useValue: { createTemplate, getTemplate, updateTemplate } },
        { provide: ImageRenderApi, useValue: { renderPreview } },
      ],
    });
    navigateByUrl = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    fixture = TestBed.createComponent(TemplateEditor);
    await fixture.whenStable();
  });

  afterEach(() => {
    fixture.destroy();
    if (originalCreate) Object.defineProperty(URL, 'createObjectURL', originalCreate);
    else Reflect.deleteProperty(URL, 'createObjectURL');
    if (originalRevoke) Object.defineProperty(URL, 'revokeObjectURL', originalRevoke);
    else Reflect.deleteProperty(URL, 'revokeObjectURL');
  });

  function page(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function nameField(): HTMLInputElement {
    return page().querySelector('app-input input') as HTMLInputElement;
  }

  function templateField(): HTMLTextAreaElement {
    return page().querySelector('app-input textarea') as HTMLTextAreaElement;
  }

  function button(label: RegExp): HTMLButtonElement {
    const match = Array.from(page().querySelectorAll<HTMLButtonElement>('button')).find((entry) =>
      label.test(entry.textContent ?? ''),
    );
    if (!match) throw new Error(`Missing button ${label}`);
    return match;
  }

  async function edit(field: HTMLInputElement | HTMLTextAreaElement, value: string): Promise<void> {
    field.value = value;
    field.dispatchEvent(new Event('input', { bubbles: true }));
    await fixture.whenStable();
  }

  async function load(detail: TemplateDetail = saved): Promise<void> {
    detailResponse.next(detail);
    detailResponse.complete();
    await fixture.whenStable();
  }

  async function changeRouteId(nextId: string): Promise<void> {
    const nextParams = convertToParamMap({ id: nextId });
    routeSnapshot.paramMap = nextParams;
    routeParams.next(nextParams);
    await fixture.whenStable();
  }

  async function completePreview(): Promise<void> {
    button(/preview/i).click();
    previewResponse.next(png);
    previewResponse.complete();
    await fixture.whenStable();
  }

  it('loads only the selected detail before showing the form', async () => {
    expect(getTemplate).toHaveBeenCalledExactlyOnceWith(id);
    expect(page().querySelector('[role="progressbar"]')?.getAttribute('aria-label')).toContain(
      'Loading your template',
    );
    expect(page().querySelector('form')).toBeNull();

    await load();
    expect(nameField().value).toBe(saved.name);
    expect(templateField().value).toBe(saved.template);
    expect(page().querySelector('form')).not.toBeNull();
    expect(button(/save template/i).disabled).toBe(true);
    expect(getTemplate).toHaveBeenCalledOnce();
    expect(createTemplate).not.toHaveBeenCalled();
    expect(renderPreview).not.toHaveBeenCalled();
  });

  it('cancels a pending detail read and loads only the new route ID', async () => {
    expect(detailResponse.observed).toBe(true);
    await changeRouteId(nextId);
    expect(detailResponse.observed).toBe(false);
    expect(getTemplate).toHaveBeenCalledTimes(2);
    expect(getTemplate).toHaveBeenLastCalledWith(nextId);
    expect(page().querySelector('form')).toBeNull();
    expect(page().querySelector('[role="progressbar"]')).not.toBeNull();

    detailResponse.next(saved);
    await fixture.whenStable();
    expect(page().querySelector('form')).toBeNull();

    const nextDetail: TemplateDetail = {
      id: nextId,
      name: 'Second template',
      template: '<Grid />',
    };
    detailResponses.get(nextId)!.next(nextDetail);
    detailResponses.get(nextId)!.complete();
    await fixture.whenStable();
    expect(nameField().value).toBe(nextDetail.name);
    expect(templateField().value).toBe(nextDetail.template);
  });

  it.each([404, 503])(
    'shows one generic error and a Templates link after GET %i',
    async (status) => {
      detailResponse.error(new HttpErrorResponse({ status, error: 'private backend details' }));
      await fixture.whenStable();
      expect(page().querySelector('form')).toBeNull();
      expect(page().querySelector('[role="alert"]')?.textContent).toContain(
        'Could not load this template.',
      );
      expect(page().querySelector('a[href="/templates"]')).not.toBeNull();
      expect(page().textContent).not.toContain('private backend details');
    },
  );

  it('starts with an empty manual preview only after detail loads', async () => {
    expect(page().querySelector('form')).toBeNull();
    expect(page().querySelector('img')).toBeNull();
    expect(renderPreview).not.toHaveBeenCalled();
    await load();
    expect(button(/preview/i).disabled).toBe(false);
    expect(page().querySelector('img')).toBeNull();
    expect(renderPreview).not.toHaveBeenCalled();
  });

  it('previews the exact current edit text and displays a PNG image', async () => {
    await load();
    const currentMarkup = '<Grid />\n  ';
    await edit(templateField(), currentMarkup);
    await completePreview();
    expect(renderPreview).toHaveBeenCalledExactlyOnceWith(currentMarkup);
    const image = page().querySelector('img') as HTMLImageElement;
    expect(image.getAttribute('src')).toBe('blob:first');
    expect(image.alt).toMatch(/current template markup/i);
    expect(button(/save template/i).disabled).toBe(false);
  });

  it('limits edit Preview by nonblank text, UTF-16 units, and encoded JSON bytes', async () => {
    await load();
    await edit(templateField(), ' \n ');
    expect(button(/preview/i).disabled).toBe(true);
    await edit(templateField(), 'x'.repeat(2_049));
    expect(button(/preview/i).disabled).toBe(true);
    const maxAsciiLength = 2_048 - JSON.stringify({ template: '' }).length;
    await edit(templateField(), 'x'.repeat(maxAsciiLength));
    expect(button(/preview/i).disabled).toBe(false);
    await edit(templateField(), 'é'.repeat(maxAsciiLength));
    expect(button(/preview/i).disabled).toBe(true);
    expect(button(/save template/i).disabled).toBe(false);
    expect(renderPreview).not.toHaveBeenCalled();
  });

  it.each([
    ['non-PNG', new Blob(['bad'], { type: 'application/problem+json' })],
    ['empty PNG', new Blob([], { type: 'image/png' })],
  ] as const)(
    'rejects %s edit preview output without creating an object URL',
    async (_label, blob) => {
      await load();
      button(/preview/i).click();
      previewResponse.next(blob);
      previewResponse.complete();
      await fixture.whenStable();
      expect(createUrl).not.toHaveBeenCalled();
      expect(page().querySelector('img')).toBeNull();
      expect(page().querySelector('[role="alert"]')?.textContent).toMatch(
        /could not preview.*try again/i,
      );
    },
  );

  it('keeps the changed draft and valid Save after a failed preview', async () => {
    await load();
    await edit(templateField(), '<Unsupported />');
    button(/preview/i).click();
    previewResponse.error(new Error('private renderer details'));
    await fixture.whenStable();
    expect(templateField().value).toBe('<Unsupported />');
    expect(button(/save template/i).disabled).toBe(false);
    expect(page().querySelector('[role="alert"]')?.textContent).toMatch(
      /could not preview.*try again/i,
    );
    expect(page().textContent).not.toContain('private renderer details');
  });

  it('ignores a superseded or stale preview response', async () => {
    await load();
    const first = previewResponse;
    button(/preview/i).click();
    previewResponse = new Subject<Blob>();
    button(/preview/i).click();
    first.next(png);
    expect(createUrl).not.toHaveBeenCalled();
    previewResponse.next(png);
    previewResponse.complete();
    await fixture.whenStable();
    expect(page().querySelector('img')?.getAttribute('src')).toBe('blob:first');

    previewResponse = new Subject<Blob>();
    button(/preview/i).click();
    await edit(templateField(), '<Grid />');
    previewResponse.next(png);
    await fixture.whenStable();
    expect(page().querySelector('img')).toBeNull();
    expect(revokeUrl).toHaveBeenCalledExactlyOnceWith('blob:first');
  });

  it('clears a displayed preview when the edit markup changes', async () => {
    await load();
    await completePreview();
    expect(page().querySelector('img')?.getAttribute('src')).toBe('blob:first');
    await edit(templateField(), '<Grid />');
    expect(page().querySelector('img')).toBeNull();
    expect(revokeUrl).toHaveBeenCalledExactlyOnceWith('blob:first');
  });

  it('revokes the old preview when the route changes to another template', async () => {
    await load();
    await completePreview();
    expect(page().querySelector('img')?.getAttribute('src')).toBe('blob:first');

    await changeRouteId(nextId);
    expect(revokeUrl).toHaveBeenCalledExactlyOnceWith('blob:first');
    expect(page().querySelector('img')).toBeNull();
    expect(page().querySelector('form')).toBeNull();

    detailResponses.get(nextId)!.next({ id: nextId, name: 'Second', template: '<Grid />' });
    detailResponses.get(nextId)!.complete();
    await fixture.whenStable();
    expect(page().querySelector('img')).toBeNull();
    expect(renderPreview).toHaveBeenCalledOnce();
  });

  it('revokes edit preview URLs on replacement, Cancel, and destruction', async () => {
    await load();
    await edit(templateField(), '<Grid />');
    await completePreview();
    previewResponse = new Subject<Blob>();
    await completePreview();
    expect(revokeUrl).toHaveBeenCalledExactlyOnceWith('blob:first');
    expect(page().querySelector('img')?.getAttribute('src')).toBe('blob:second');

    button(/cancel/i).click();
    await fixture.whenStable();
    expect(page().querySelector('img')).toBeNull();
    expect(revokeUrl).toHaveBeenCalledWith('blob:second');

    previewResponse = new Subject<Blob>();
    createUrl.mockReturnValueOnce('blob:third');
    await completePreview();
    fixture.destroy();
    expect(revokeUrl).toHaveBeenCalledWith('blob:third');
  });

  it('restores both loaded values and clears a save error on Cancel', async () => {
    await load();
    await edit(nameField(), 'Changed');
    await edit(templateField(), '<Grid />');
    button(/save template/i).click();
    updateResponse.error(new Error('private backend details'));
    await fixture.whenStable();
    expect(page().querySelector('[role="alert"]')).not.toBeNull();

    button(/cancel/i).click();
    await fixture.whenStable();
    expect(nameField().value).toBe(saved.name);
    expect(templateField().value).toBe(saved.template);
    expect(button(/cancel/i).disabled).toBe(true);
    expect(button(/save template/i).disabled).toBe(true);
    expect(page().querySelector('[role="alert"]')).toBeNull();
    expect(navigateByUrl).not.toHaveBeenCalled();
  });

  it('enables Save for a name-only or AXAML-only change', async () => {
    await load();
    await edit(nameField(), 'Updated invitation');
    expect(button(/save template/i).disabled).toBe(false);
    await edit(nameField(), saved.name);
    expect(button(/save template/i).disabled).toBe(true);

    await edit(templateField(), `${saved.template}\n`);
    expect(button(/save template/i).disabled).toBe(false);
    await edit(templateField(), saved.template);
    expect(button(/save template/i).disabled).toBe(true);
  });

  it('disables Save for invalid names and markup at the published limits', async () => {
    await load();
    await edit(nameField(), '  ');
    expect(button(/save template/i).disabled).toBe(true);
    expect(nameField().getAttribute('aria-invalid')).toBe('true');
    await edit(nameField(), ` ${'x'.repeat(101)} `);
    expect(button(/save template/i).disabled).toBe(true);
    await edit(nameField(), ` ${'x'.repeat(100)} `);
    expect(button(/save template/i).disabled).toBe(false);

    await edit(templateField(), '\n  ');
    expect(button(/save template/i).disabled).toBe(true);
    expect(templateField().getAttribute('aria-invalid')).toBe('true');
    await edit(templateField(), 'x'.repeat(16_385));
    expect(button(/save template/i).disabled).toBe(true);
    await edit(templateField(), 'x'.repeat(16_384));
    expect(button(/save template/i).disabled).toBe(false);
    expect(updateTemplate).not.toHaveBeenCalled();
  });

  it('PUTs the trimmed name and exact full AXAML only once while pending', async () => {
    await load();
    await edit(nameField(), '  Updated invitation  ');
    await edit(templateField(), '<Grid />\n  ');
    button(/save template/i).click();
    page()
      .querySelector('form')!
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await fixture.whenStable();

    expect(updateTemplate).toHaveBeenCalledExactlyOnceWith(id, {
      name: 'Updated invitation',
      template: '<Grid />\n  ',
    });
    expect(createTemplate).not.toHaveBeenCalled();
    expect(button(/saving/i).disabled).toBe(true);
    expect(button(/cancel/i).disabled).toBe(true);
    expect(page().querySelector('[role="progressbar"]')).not.toBeNull();
  });

  it('returns to Templates after a successful PUT', async () => {
    await load();
    await edit(nameField(), 'Updated');
    button(/save template/i).click();
    updateResponse.next(undefined);
    updateResponse.complete();
    await fixture.whenStable();
    expect(navigateByUrl).toHaveBeenCalledExactlyOnceWith('/templates');
  });

  it('locks Save through pending navigation and a failed route change after PUT', async () => {
    let finishNavigation: (navigated: boolean) => void = () => {};
    navigateByUrl.mockImplementation(
      () => new Promise<boolean>((resolve) => (finishNavigation = resolve)),
    );
    await load();
    await edit(nameField(), 'Updated');
    button(/save template/i).click();
    updateResponse.next(undefined);
    updateResponse.complete();
    await fixture.whenStable();

    expect(navigateByUrl).toHaveBeenCalledExactlyOnceWith('/templates');
    expect(button(/saving/i).disabled).toBe(true);
    expect(button(/cancel/i).disabled).toBe(true);
    page()
      .querySelector('form')!
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    expect(updateTemplate).toHaveBeenCalledOnce();

    finishNavigation(false);
    await Promise.resolve();
    await fixture.whenStable();
    expect(page().querySelector('[role="alert"]')?.textContent).toMatch(
      /template was saved.*use the templates link/i,
    );
    expect(button(/save template/i).disabled).toBe(true);
    expect(button(/cancel/i).disabled).toBe(true);
  });

  it('keeps Save locked and shows safe feedback when navigation rejects after PUT', async () => {
    navigateByUrl.mockRejectedValue(new Error('private router details'));
    await load();
    await edit(nameField(), 'Updated');
    button(/save template/i).click();
    updateResponse.next(undefined);
    updateResponse.complete();
    await fixture.whenStable();

    expect(page().querySelector('[role="alert"]')?.textContent).toMatch(
      /template was saved.*use the templates link/i,
    );
    expect(page().textContent).not.toContain('private router details');
    expect(button(/save template/i).disabled).toBe(true);
    expect(updateTemplate).toHaveBeenCalledOnce();
  });

  it('ignores an old navigation rejection after the route changes A to B to A', async () => {
    let rejectNavigation: (reason: unknown) => void = () => {};
    navigateByUrl.mockImplementation(
      () => new Promise<boolean>((_resolve, reject) => (rejectNavigation = reject)),
    );
    await load();
    await edit(nameField(), 'Updated first');
    button(/save template/i).click();
    updateResponse.next(undefined);
    updateResponse.complete();
    await fixture.whenStable();
    expect(navigateByUrl).toHaveBeenCalledExactlyOnceWith('/templates');

    await changeRouteId(nextId);
    const returningDetail = new Subject<TemplateDetail>();
    detailResponses.set(id, returningDetail);
    await changeRouteId(id);
    returningDetail.next(saved);
    returningDetail.complete();
    await fixture.whenStable();
    expect(nameField().value).toBe(saved.name);

    rejectNavigation(new Error('stale router failure'));
    await Promise.resolve();
    await fixture.whenStable();
    expect(page().querySelector('[role="alert"]')).toBeNull();
    expect(button(/save template/i).disabled).toBe(true);
    expect(page().textContent).not.toContain('stale router failure');
  });

  it('keeps the draft and safe feedback after a failed PUT without retrying', async () => {
    await load();
    await edit(nameField(), 'Changed');
    await edit(templateField(), '<Grid />\n');
    button(/save template/i).click();
    updateResponse.error(new HttpErrorResponse({ status: 503, error: 'private backend details' }));
    await fixture.whenStable();

    expect(nameField().value).toBe('Changed');
    expect(templateField().value).toBe('<Grid />\n');
    expect(page().querySelector('[role="alert"]')?.textContent).toContain(
      'Could not save this template.',
    );
    expect(page().textContent).not.toContain('private backend details');
    expect(button(/save template/i).disabled).toBe(false);
    expect(updateTemplate).toHaveBeenCalledOnce();
    expect(navigateByUrl).not.toHaveBeenCalled();
  });

  it('cancels a pending PUT on route change and saves the new template ID', async () => {
    await load();
    await edit(nameField(), 'Updated first');
    button(/save template/i).click();
    expect(updateTemplate).toHaveBeenCalledExactlyOnceWith(id, {
      name: 'Updated first',
      template: saved.template,
    });
    expect(updateResponse.observed).toBe(true);

    await changeRouteId(nextId);
    expect(updateResponse.observed).toBe(false);
    expect(page().querySelector('form')).toBeNull();
    updateResponse.next(undefined);
    expect(navigateByUrl).not.toHaveBeenCalled();

    detailResponses.get(nextId)!.next({ id: nextId, name: 'Second', template: '<Grid />' });
    detailResponses.get(nextId)!.complete();
    await fixture.whenStable();
    await edit(nameField(), 'Updated second');
    button(/save template/i).click();
    expect(updateTemplate).toHaveBeenCalledTimes(2);
    expect(updateTemplate).toHaveBeenLastCalledWith(nextId, {
      name: 'Updated second',
      template: '<Grid />',
    });
    expect(updateResponses[1].observed).toBe(true);
    expect(createTemplate).not.toHaveBeenCalled();
  });

  it('cancels a pending detail read on destruction', () => {
    expect(detailResponse.observed).toBe(true);
    fixture.destroy();
    expect(detailResponse.observed).toBe(false);
  });

  it('does not navigate from a late save response after destruction', async () => {
    await load();
    await edit(nameField(), 'Updated');
    button(/save template/i).click();
    fixture.destroy();
    updateResponse.next(undefined);
    expect(navigateByUrl).not.toHaveBeenCalled();
  });

  it('cancels a pending edit preview on destruction', async () => {
    await load();
    button(/preview/i).click();
    expect(previewResponse.observed).toBe(true);
    fixture.destroy();
    expect(previewResponse.observed).toBe(false);
    previewResponse.next(png);
    expect(createUrl).not.toHaveBeenCalled();
  });
});
