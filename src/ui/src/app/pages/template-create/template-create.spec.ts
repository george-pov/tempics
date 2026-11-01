import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { Subject } from 'rxjs';
import { ImageRenderApi } from '../../shared/api/image-render/image-render-api';
import { TemplateApi } from '../../shared/api/templates/template-api';
import type { CreateTemplateResponse } from '../../shared/api/templates/create-template-response';
import { INITIAL_TEMPLATE_DRAFT } from './template-create-draft';
import { TemplateCreate } from './template-create';

describe('TemplateCreate', () => {
  let fixture: ComponentFixture<TemplateCreate>;
  let response: Subject<CreateTemplateResponse>;
  let previewResponse: Subject<Blob>;
  let createTemplate: ReturnType<typeof vi.fn>;
  let renderPreview: ReturnType<typeof vi.fn>;
  let navigateByUrl: ReturnType<typeof vi.spyOn>;
  let createUrl: ReturnType<typeof vi.fn>;
  let revokeUrl: ReturnType<typeof vi.fn>;
  const png = new Blob(['preview'], { type: 'image/png' });
  const originalCreate = Object.getOwnPropertyDescriptor(URL, 'createObjectURL');
  const originalRevoke = Object.getOwnPropertyDescriptor(URL, 'revokeObjectURL');

  beforeEach(async () => {
    response = new Subject<CreateTemplateResponse>();
    previewResponse = new Subject<Blob>();
    createTemplate = vi.fn(() => response.asObservable());
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
        { provide: TemplateApi, useValue: { createTemplate } },
        { provide: ImageRenderApi, useValue: { renderPreview } },
      ],
    });
    navigateByUrl = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    fixture = TestBed.createComponent(TemplateCreate);
    await fixture.whenStable();
  });

  afterEach(() => {
    fixture.destroy();
    if (originalCreate) Object.defineProperty(URL, 'createObjectURL', originalCreate);
    else Reflect.deleteProperty(URL, 'createObjectURL');
    if (originalRevoke) Object.defineProperty(URL, 'revokeObjectURL', originalRevoke);
    else Reflect.deleteProperty(URL, 'revokeObjectURL');
  });

  function nameField(): HTMLInputElement {
    return fixture.nativeElement.querySelector('app-input input');
  }

  function templateField(): HTMLTextAreaElement {
    return fixture.nativeElement.querySelector('app-input textarea');
  }

  function button(label: RegExp): HTMLButtonElement {
    const match = Array.from(fixture.nativeElement.querySelectorAll('button')).find((entry) =>
      label.test((entry as HTMLButtonElement).textContent ?? ''),
    );
    if (!match) throw new Error(`Missing button ${label}`);
    return match as HTMLButtonElement;
  }

  async function edit(field: HTMLInputElement | HTMLTextAreaElement, value: string): Promise<void> {
    field.value = value;
    field.dispatchEvent(new Event('input', { bubbles: true }));
    await fixture.whenStable();
  }

  it('opens with the default draft', () => {
    expect(nameField().value).toBe('Event invitation');
    expect(templateField().value).toBe(INITIAL_TEMPLATE_DRAFT.template);
  });

  it('disables Cancel and Save for the unchanged draft', () => {
    expect(button(/cancel/i).disabled).toBe(true);
    expect(button(/save template/i).disabled).toBe(true);
  });

  it('leaves manual Preview available without requesting it automatically', () => {
    expect(button(/preview/i).disabled).toBe(false);
    expect(renderPreview).not.toHaveBeenCalled();
  });

  it('requests a preview for the exact current unsaved AXAML', async () => {
    const currentMarkup = `${INITIAL_TEMPLATE_DRAFT.template}\n`;
    await edit(templateField(), currentMarkup);
    button(/preview/i).click();
    await fixture.whenStable();
    expect(renderPreview).toHaveBeenCalledExactlyOnceWith(currentMarkup);
  });

  it('displays a valid preview PNG as an accessible image', async () => {
    button(/preview/i).click();
    previewResponse.next(png);
    previewResponse.complete();
    await fixture.whenStable();
    const image = fixture.nativeElement.querySelector('img') as HTMLImageElement;
    expect(image.getAttribute('src')).toBe('blob:first');
    expect(image.alt).toMatch(/current template markup/i);
  });

  it('keeps Preview independent of the template name', async () => {
    await edit(nameField(), '  ');
    expect(button(/preview/i).disabled).toBe(false);
    expect(button(/save template/i).disabled).toBe(true);
  });

  it('disables Preview for blank markup', async () => {
    await edit(templateField(), ' \n ');
    expect(button(/preview/i).disabled).toBe(true);
    button(/preview/i).click();
    expect(renderPreview).not.toHaveBeenCalled();
  });

  it('honors the 2 KB encoded preview body cap', async () => {
    const maxAsciiLength = 2_048 - JSON.stringify({ template: '' }).length;
    await edit(templateField(), 'x'.repeat(maxAsciiLength));
    expect(button(/preview/i).disabled).toBe(false);

    await edit(templateField(), 'x'.repeat(maxAsciiLength + 1));
    expect(button(/preview/i).disabled).toBe(true);
    button(/preview/i).click();
    expect(renderPreview).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('Preview request: max 2 KB');
  });

  it('counts UTF-8 bytes when limiting Preview', async () => {
    const maxAsciiLength = 2_048 - JSON.stringify({ template: '' }).length;
    await edit(templateField(), '\u00e9'.repeat(maxAsciiLength));
    expect(button(/preview/i).disabled).toBe(true);
  });

  it('keeps Save available for drafts above the Preview limit', async () => {
    await edit(templateField(), 'x'.repeat(2_048));
    expect(button(/preview/i).disabled).toBe(true);
    expect(button(/save template/i).disabled).toBe(false);
  });

  it('keeps the draft and valid Save state after a failed preview', async () => {
    await edit(templateField(), '<Unsupported />');
    button(/preview/i).click();
    previewResponse.error(new Error('private API problem details'));
    await fixture.whenStable();
    expect(templateField().value).toBe('<Unsupported />');
    expect(button(/save template/i).disabled).toBe(false);
    expect(fixture.nativeElement.querySelector('[role="alert"]')?.textContent).toMatch(
      /could not preview.*try again/i,
    );
    expect(fixture.nativeElement.textContent).not.toContain('private API problem details');
  });

  it('rejects a non-PNG preview without creating an object URL', async () => {
    button(/preview/i).click();
    previewResponse.next(new Blob(['bad'], { type: 'application/problem+json' }));
    previewResponse.complete();
    await fixture.whenStable();
    expect(createUrl).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('[role="alert"]')?.textContent).toMatch(
      /could not preview.*try again/i,
    );
  });

  it('supersedes a pending request and accepts only its newest response', async () => {
    const first = previewResponse;
    button(/preview/i).click();
    previewResponse = new Subject<Blob>();
    button(/preview/i).click();
    first.next(png);
    expect(createUrl).not.toHaveBeenCalled();
    previewResponse.next(png);
    previewResponse.complete();
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('img')?.getAttribute('src')).toBe('blob:first');
  });

  it('revokes a completed preview when a newer Preview replaces it', async () => {
    button(/preview/i).click();
    previewResponse.next(png);
    previewResponse.complete();
    await fixture.whenStable();
    previewResponse = new Subject<Blob>();
    button(/preview/i).click();
    expect(revokeUrl).toHaveBeenCalledExactlyOnceWith('blob:first');
    previewResponse.next(png);
    previewResponse.complete();
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('img')?.getAttribute('src')).toBe('blob:second');
  });

  it('clears a stale preview when AXAML changes', async () => {
    button(/preview/i).click();
    previewResponse.next(png);
    previewResponse.complete();
    await fixture.whenStable();
    await edit(templateField(), '<Unsupported />');
    expect(fixture.nativeElement.querySelector('img')).toBeNull();
    expect(revokeUrl).toHaveBeenCalledExactlyOnceWith('blob:first');
  });

  it('clears a preview and resets the draft on Cancel', async () => {
    button(/preview/i).click();
    previewResponse.next(png);
    previewResponse.complete();
    await fixture.whenStable();
    await edit(nameField(), 'Changed');
    button(/cancel/i).click();
    await fixture.whenStable();
    expect(nameField().value).toBe(INITIAL_TEMPLATE_DRAFT.name);
    expect(fixture.nativeElement.querySelector('img')).toBeNull();
    expect(revokeUrl).toHaveBeenCalledExactlyOnceWith('blob:first');
  });

  it('keeps Cancel disabled for Preview alone', async () => {
    button(/preview/i).click();
    previewResponse.next(png);
    previewResponse.complete();
    await fixture.whenStable();
    expect(button(/cancel/i).disabled).toBe(true);
  });

  it('revokes its preview URL on destruction', async () => {
    button(/preview/i).click();
    previewResponse.next(png);
    previewResponse.complete();
    await fixture.whenStable();
    fixture.destroy();
    expect(revokeUrl).toHaveBeenCalledExactlyOnceWith('blob:first');
  });

  it('ignores a pending preview after AXAML edit', async () => {
    const first = previewResponse;
    button(/preview/i).click();
    await edit(templateField(), `${INITIAL_TEMPLATE_DRAFT.template}\n`);
    first.next(png);
    expect(createUrl).not.toHaveBeenCalled();
  });

  it('ignores a pending preview after destruction', () => {
    button(/preview/i).click();
    fixture.destroy();
    previewResponse.next(png);
    expect(createUrl).not.toHaveBeenCalled();
  });

  it('recognizes and reverts a literal name-only change', async () => {
    await edit(nameField(), 'Event invitation ');
    expect(button(/cancel/i).disabled).toBe(false);
    expect(button(/save template/i).disabled).toBe(false);
    await edit(nameField(), INITIAL_TEMPLATE_DRAFT.name);
    expect(button(/cancel/i).disabled).toBe(true);
    expect(button(/save template/i).disabled).toBe(true);
  });

  it('recognizes and reverts an AXAML-only change', async () => {
    await edit(templateField(), `${INITIAL_TEMPLATE_DRAFT.template}\n`);
    expect(button(/cancel/i).disabled).toBe(false);
    expect(button(/save template/i).disabled).toBe(false);
    await edit(templateField(), INITIAL_TEMPLATE_DRAFT.template);
    expect(button(/cancel/i).disabled).toBe(true);
    expect(button(/save template/i).disabled).toBe(true);
  });

  it('shows a required-name error', async () => {
    await edit(nameField(), '   ');
    expect(button(/save template/i).disabled).toBe(true);
    expect(nameField().getAttribute('aria-invalid')).toBe('true');
    expect(nameField().getAttribute('aria-describedby')).toContain('description');
    expect(fixture.nativeElement.textContent).toContain('Enter a template name.');
  });

  it('enforces the 100-character trimmed name limit', async () => {
    await edit(nameField(), ` ${'x'.repeat(101)} `);
    expect(button(/save template/i).disabled).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('Max 100 characters.');
    await edit(nameField(), ` ${'x'.repeat(100)} `);
    expect(button(/save template/i).disabled).toBe(false);
  });

  it('shows a required-markup error', async () => {
    await edit(templateField(), '\n  ');
    expect(button(/save template/i).disabled).toBe(true);
    expect(templateField().getAttribute('aria-invalid')).toBe('true');
    expect(fixture.nativeElement.textContent).toContain('Enter template markup.');
  });

  it('keeps Cancel available when a changed field is invalid', async () => {
    await edit(nameField(), '   ');
    expect(button(/cancel/i).disabled).toBe(false);
  });

  it('enforces the 16,384-character AXAML limit', async () => {
    await edit(templateField(), 'x'.repeat(16_385));
    expect(button(/save template/i).disabled).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('Max 16,384 characters.');
    await edit(templateField(), 'x'.repeat(16_384));
    expect(button(/save template/i).disabled).toBe(false);
  });

  it('resets both controls and their validation state on Cancel', async () => {
    await edit(nameField(), '  ');
    await edit(templateField(), '  ');
    button(/cancel/i).click();
    await fixture.whenStable();
    expect(nameField().value).toBe(INITIAL_TEMPLATE_DRAFT.name);
    expect(templateField().value).toBe(INITIAL_TEMPLATE_DRAFT.template);
    expect(fixture.nativeElement.querySelector('[role="alert"]')).toBeNull();
    expect(button(/cancel/i).disabled).toBe(true);
    expect(button(/save template/i).disabled).toBe(true);
  });

  it('submits the trimmed name and exact AXAML once', async () => {
    const axaml = `${INITIAL_TEMPLATE_DRAFT.template}\n  `;
    await edit(nameField(), '  Invitation updated  ');
    await edit(templateField(), axaml);
    button(/save template/i).click();
    fixture.nativeElement.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await fixture.whenStable();
    expect(createTemplate).toHaveBeenCalledExactlyOnceWith({
      name: 'Invitation updated',
      template: axaml,
    });
  });

  it('locks actions while a save is pending', async () => {
    await edit(nameField(), 'Changed');
    button(/save template/i).click();
    await fixture.whenStable();
    expect(button(/cancel/i).disabled).toBe(true);
    expect(button(/saving/i).disabled).toBe(true);
    expect(fixture.nativeElement.querySelector('[role="progressbar"]')).not.toBeNull();
  });

  it('navigates to the list after a confirmed save', async () => {
    await edit(nameField(), 'Changed');
    button(/save template/i).click();
    response.next({ id: 'f72bb88f-1df2-48bc-b65b-1074d6e5d400', name: 'Invitation updated' });
    response.complete();
    await fixture.whenStable();
    expect(navigateByUrl).toHaveBeenCalledExactlyOnceWith('/templates');
  });

  it('retains the draft and gives a safe ambiguous-save warning on failure', async () => {
    await edit(nameField(), 'Changed');
    button(/save template/i).click();
    response.error(new Error('private backend details'));
    await fixture.whenStable();
    expect(nameField().value).toBe('Changed');
    expect(fixture.nativeElement.querySelector('[role="alert"]')?.textContent).toMatch(/check templates before retrying/i);
    expect(fixture.nativeElement.textContent).not.toContain('private backend details');
    expect(navigateByUrl).not.toHaveBeenCalled();
  });

  it('keeps the confirmed create locked through delayed or failed navigation', async () => {
    let finishNavigation: (navigated: boolean) => void = () => {};
    navigateByUrl.mockImplementation(
      () => new Promise<boolean>((resolve) => (finishNavigation = resolve)),
    );
    await edit(nameField(), 'Changed');
    button(/save template/i).click();
    response.next({ id: 'f72bb88f-1df2-48bc-b65b-1074d6e5d400', name: 'Changed' });
    response.complete();
    await fixture.whenStable();
    expect(button(/cancel/i).disabled).toBe(true);
    expect(button(/saving/i).disabled).toBe(true);

    finishNavigation(false);
    await Promise.resolve();
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('[role="alert"]')?.textContent).toMatch(
      /template was saved.*use the templates link/i,
    );
    expect(button(/cancel/i).disabled).toBe(true);
    expect(button(/save template/i).disabled).toBe(true);
    fixture.nativeElement.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    expect(createTemplate).toHaveBeenCalledTimes(1);
  });

  it('shows the confirmed-save warning when navigation rejects', async () => {
    navigateByUrl.mockRejectedValue(new Error('private router details'));
    await edit(nameField(), 'Changed');
    button(/save template/i).click();
    response.next({ id: 'f72bb88f-1df2-48bc-b65b-1074d6e5d400', name: 'Changed' });
    response.complete();
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('[role="alert"]')?.textContent).toMatch(
      /template was saved.*use the templates link/i,
    );
    expect(fixture.nativeElement.textContent).not.toContain('private router details');
    expect(button(/save template/i).disabled).toBe(true);
  });

  it('cancels the owned create subscription when leaving the page', async () => {
    await edit(nameField(), 'Changed');
    button(/save template/i).click();
    fixture.destroy();
    response.next({ id: 'late', name: 'Changed' });
    expect(navigateByUrl).not.toHaveBeenCalled();
  });
});
