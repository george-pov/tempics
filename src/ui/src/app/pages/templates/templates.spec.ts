import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { TemplateApi } from '../../shared/api/templates/template-api';
import { type TemplateListResponse } from '../../shared/api/templates/template-list-response';
import { Templates } from './templates';

describe('Templates', () => {
  let fixture: ComponentFixture<Templates>;
  let responses: Subject<TemplateListResponse>[];
  let listTemplates: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    responses = [];
    listTemplates = vi.fn(() => {
      const response = new Subject<TemplateListResponse>();
      responses.push(response);
      return response.asObservable();
    });
    TestBed.configureTestingModule({
      providers: [{ provide: TemplateApi, useValue: { listTemplates } }],
    });
    fixture = TestBed.createComponent(Templates);
    fixture.detectChanges();
  });

  afterEach(() => fixture.destroy());

  function page(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function buttons(): HTMLButtonElement[] {
    return Array.from(page().querySelectorAll('button'));
  }

  function button(label: string): HTMLButtonElement | undefined {
    return buttons().find((candidate) => candidate.textContent?.includes(label));
  }

  function names(): string[] {
    return Array.from(page().querySelectorAll('.template-name')).map(
      (element) => element.textContent?.trim() ?? '',
    );
  }

  it('starts one read on activation and distinguishes pending from an empty list', () => {
    expect(listTemplates).toHaveBeenCalledOnce();
    expect(page().querySelector('h1')?.textContent).toBe('Templates');
    expect(page().querySelector('h2')?.textContent).toBe('Your templates');
    expect(page().querySelector('[role="progressbar"]')?.getAttribute('aria-label')).toContain(
      'Loading your templates',
    );
    expect(page().textContent).not.toContain('no saved templates');
    expect(page().querySelector('.count')).toBeNull();
    expect(button('Add Template')?.disabled).toBe(true);
    expect(page().textContent).toContain('Adding templates is not available yet.');
    expect(page().querySelectorAll('a')).toHaveLength(0);
    expect(buttons()).toHaveLength(1);
  });

  it('shows every returned name in order as text, including duplicates, with the loaded count', () => {
    const unsafeName = '<img src=x onerror="private details">';
    responses[0].next({
      items: [
        { id: 'first', name: 'Sample announcement' },
        { id: 'second', name: 'Sample announcement' },
        { id: 'third', name: unsafeName },
      ],
    });
    responses[0].complete();
    fixture.detectChanges();

    expect(page().querySelector('[role="progressbar"]')).toBeNull();
    expect(page().querySelector('.count')?.textContent?.trim()).toBe('3 templates');
    expect(names()).toEqual(['Sample announcement', 'Sample announcement', unsafeName]);
    expect(page().querySelectorAll('ul li')).toHaveLength(3);
    expect(page().querySelectorAll('li app-icon[name="image"][aria-hidden="true"]')).toHaveLength(3);
    expect(page().querySelector('img')).toBeNull();
    expect(page().querySelector('li a, li button')).toBeNull();
    expect(buttons()).toHaveLength(1);
  });

  it('shows a useful empty state only after a successful empty response', () => {
    responses[0].next({ items: [] });
    responses[0].complete();
    fixture.detectChanges();

    expect(page().querySelector('.count')?.textContent?.trim()).toBe('0 templates');
    expect(page().querySelector('[role="status"]')?.textContent).toContain(
      'You have no saved templates yet.',
    );
    expect(page().querySelector('ul')).toBeNull();
  });

  it('uses singular count wording for one returned item', () => {
    responses[0].next({ items: [{ id: 'only', name: 'Only template' }] });
    fixture.detectChanges();
    expect(page().querySelector('.count')?.textContent?.trim()).toBe('1 template');
  });

  it('shows safe failure feedback, clears it on retry, and recovers', () => {
    responses[0].error(new Error('private backend details'));
    fixture.detectChanges();

    expect(page().querySelector('[role="alert"]')?.textContent).toContain(
      'Could not load your templates. Try again.',
    );
    expect(page().textContent).not.toContain('private backend details');
    expect(page().querySelector('.count')).toBeNull();
    expect(page().textContent).not.toContain('no saved templates');

    button('Retry')?.click();
    fixture.detectChanges();
    expect(listTemplates).toHaveBeenCalledTimes(2);
    expect(page().querySelector('[role="alert"]')).toBeNull();
    expect(page().querySelector('[role="progressbar"]')).not.toBeNull();

    responses[1].next({ items: [{ id: 'recovered', name: 'Recovered template' }] });
    fixture.detectChanges();
    expect(page().querySelector('[role="alert"]')).toBeNull();
    expect(page().querySelector('[role="progressbar"]')).toBeNull();
    expect(names()).toEqual(['Recovered template']);
    expect(page().querySelector('.count')?.textContent?.trim()).toBe('1 template');
  });
});
