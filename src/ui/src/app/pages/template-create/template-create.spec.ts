import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { Subject } from 'rxjs';
import { TemplateApi } from '../../shared/api/templates/template-api';
import type { CreateTemplateResponse } from '../../shared/api/templates/create-template-response';
import { INITIAL_TEMPLATE_DRAFT } from './template-create-draft';
import { TemplateCreate } from './template-create';

describe('TemplateCreate', () => {
  let fixture: ComponentFixture<TemplateCreate>;
  let response: Subject<CreateTemplateResponse>;
  let createTemplate: ReturnType<typeof vi.fn>;
  let navigateByUrl: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    response = new Subject<CreateTemplateResponse>();
    createTemplate = vi.fn(() => response.asObservable());
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: TemplateApi, useValue: { createTemplate } },
      ],
    });
    navigateByUrl = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    fixture = TestBed.createComponent(TemplateCreate);
    await fixture.whenStable();
  });

  afterEach(() => fixture.destroy());

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

  it('opens the page with the default draft, a back link, and no active actions or preview', () => {
    expect(fixture.nativeElement.querySelector('h1')?.textContent).toContain('Create template');
    expect(fixture.nativeElement.querySelector('a[href="/templates"]')?.textContent).toContain('Templates');
    expect(nameField().value).toBe('Event invitation');
    expect(templateField().value).toBe(INITIAL_TEMPLATE_DRAFT.template);
    expect(templateField().classList.contains('is-monospace')).toBe(true);
    expect(button(/cancel/i).disabled).toBe(true);
    expect(button(/save template/i).disabled).toBe(true);
    expect(fixture.nativeElement.textContent).not.toMatch(/preview/i);
    expect(fixture.nativeElement.querySelector('img')).toBeNull();
  });

  it('reacts to literal name-only and AXAML-only changes and disables actions after reversion', async () => {
    await edit(nameField(), 'Event invitation ');
    expect(button(/cancel/i).disabled).toBe(false);
    expect(button(/save template/i).disabled).toBe(false);
    await edit(nameField(), INITIAL_TEMPLATE_DRAFT.name);
    expect(button(/cancel/i).disabled).toBe(true);
    expect(button(/save template/i).disabled).toBe(true);

    await edit(templateField(), `${INITIAL_TEMPLATE_DRAFT.template}\n`);
    expect(button(/cancel/i).disabled).toBe(false);
    expect(button(/save template/i).disabled).toBe(false);
    await edit(templateField(), INITIAL_TEMPLATE_DRAFT.template);
    expect(button(/cancel/i).disabled).toBe(true);
    expect(button(/save template/i).disabled).toBe(true);
  });

  it('keeps Cancel available for invalid fields while showing associated errors', async () => {
    await edit(nameField(), '   ');
    expect(button(/cancel/i).disabled).toBe(false);
    expect(button(/save template/i).disabled).toBe(true);
    expect(nameField().getAttribute('aria-invalid')).toBe('true');
    expect(nameField().getAttribute('aria-describedby')).toContain('description');
    expect(fixture.nativeElement.textContent).toContain('Enter a template name.');

    await edit(nameField(), ` ${'x'.repeat(101)} `);
    expect(button(/save template/i).disabled).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('Max 100 characters.');
    await edit(nameField(), ` ${'x'.repeat(100)} `);
    expect(button(/save template/i).disabled).toBe(false);

    await edit(templateField(), '\n  ');
    expect(button(/cancel/i).disabled).toBe(false);
    expect(button(/save template/i).disabled).toBe(true);
    expect(templateField().getAttribute('aria-invalid')).toBe('true');
    expect(fixture.nativeElement.textContent).toContain('Enter template markup.');

    await edit(templateField(), 'x'.repeat(16_385));
    expect(button(/save template/i).disabled).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('Max 16,384 characters.');
    await edit(templateField(), 'x'.repeat(16_384));
    expect(button(/save template/i).disabled).toBe(false);
  });

  it('resets both controls and validation feedback without leaving the page', async () => {
    await edit(nameField(), '  ');
    await edit(templateField(), '  ');
    button(/cancel/i).click();
    await fixture.whenStable();
    expect(nameField().value).toBe(INITIAL_TEMPLATE_DRAFT.name);
    expect(templateField().value).toBe(INITIAL_TEMPLATE_DRAFT.template);
    expect(fixture.nativeElement.querySelector('[role="alert"]')).toBeNull();
    expect(button(/cancel/i).disabled).toBe(true);
    expect(button(/save template/i).disabled).toBe(true);
    expect(navigateByUrl).not.toHaveBeenCalled();
    expect(createTemplate).not.toHaveBeenCalled();
  });

  it('submits trimmed name and exact AXAML once, locks actions, and navigates on confirmation', async () => {
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
    expect(button(/cancel/i).disabled).toBe(true);
    expect(button(/saving/i).disabled).toBe(true);
    expect(fixture.nativeElement.querySelector('[role="progressbar"]')).not.toBeNull();
    expect(navigateByUrl).not.toHaveBeenCalled();

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
    expect(templateField().value).toBe(INITIAL_TEMPLATE_DRAFT.template);
    expect(button(/cancel/i).disabled).toBe(false);
    expect(button(/save template/i).disabled).toBe(false);
    expect(fixture.nativeElement.querySelector('[role="alert"]')?.textContent).toMatch(/check templates before retrying/i);
    expect(fixture.nativeElement.textContent).not.toContain('private backend details');
    expect(navigateByUrl).not.toHaveBeenCalled();
    expect(createTemplate).toHaveBeenCalledTimes(1);

    button(/cancel/i).click();
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('[role="alert"]')).toBeNull();
    expect(nameField().value).toBe(INITIAL_TEMPLATE_DRAFT.name);
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
    expect(response.observed).toBe(true);
    fixture.destroy();
    expect(response.observed).toBe(false);
    response.next({ id: 'late', name: 'Changed' });
    expect(navigateByUrl).not.toHaveBeenCalled();
  });
});
