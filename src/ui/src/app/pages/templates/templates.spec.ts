import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Subject } from 'rxjs';
import { TemplateApi } from '../../shared/api/templates/template-api';
import { type TemplateListItemResponse, type TemplateListResponse } from '../../shared/api/templates/template-list-response';
import { ConfirmDialogService } from '../../shared/components/confirm-dialog/confirm-dialog-service';
import { Templates } from './templates';

describe('Templates', () => {
  let fixture: ComponentFixture<Templates>;
  let responses: Subject<TemplateListResponse>[];
  let listTemplates: ReturnType<typeof vi.fn>;
  let confirmations: Subject<boolean>[];
  let confirm: ReturnType<typeof vi.fn>;
  let deletions: Subject<void>[];
  let deleteTemplate: ReturnType<typeof vi.fn>;

  const items: TemplateListItemResponse[] = [
    { id: 'first', name: 'Same name' },
    { id: 'second', name: 'Same name' },
  ];

  beforeEach(() => {
    responses = [];
    listTemplates = vi.fn(() => {
      const response = new Subject<TemplateListResponse>();
      responses.push(response);
      return response.asObservable();
    });
    confirmations = [];
    confirm = vi.fn(() => {
      const response = new Subject<boolean>();
      confirmations.push(response);
      return response.asObservable();
    });
    deletions = [];
    deleteTemplate = vi.fn(() => {
      const response = new Subject<void>();
      deletions.push(response);
      return response.asObservable();
    });
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: TemplateApi, useValue: { listTemplates, deleteTemplate } },
        { provide: ConfirmDialogService, useValue: { confirm } },
      ],
    });
    fixture = TestBed.createComponent(Templates);
    fixture.detectChanges();
  });

  afterEach(() => fixture.destroy());

  function page(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function names(): string[] {
    return Array.from(page().querySelectorAll('.template-name')).map(
      (element) => element.textContent?.trim() ?? '',
    );
  }

  function deleteButtons(): HTMLButtonElement[] {
    return Array.from(page().querySelectorAll<HTMLButtonElement>('li button[aria-label^="Delete "]'));
  }

  function load(itemsToShow: readonly TemplateListItemResponse[] = items): void {
    responses[0].next({ items: itemsToShow });
    fixture.detectChanges();
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
    const add = page().querySelector<HTMLAnchorElement>('app-button-link a');
    expect(add?.getAttribute('href')).toBe('/templates/new');
    expect(add?.textContent).toContain('Add Template');
    expect(add?.querySelector('app-icon[aria-hidden="true"]')).not.toBeNull();
    expect(page().querySelector('button')).toBeNull();
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
    expect(page().querySelector('li a')).toBeNull();
    expect(deleteButtons()).toHaveLength(3);
    expect(deleteButtons().map((item) => item.getAttribute('aria-label'))).toEqual([
      'Delete Sample announcement',
      'Delete Sample announcement',
      `Delete ${unsafeName}`,
    ]);
    expect(page().querySelectorAll('li app-icon[name="delete"][aria-hidden="true"]')).toHaveLength(3);
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

  it('shows only safe error feedback when the list load fails', () => {
    responses[0].error(new Error('private backend details'));
    fixture.detectChanges();

    expect(page().querySelector('[role="alert"]')?.textContent).toContain(
      'Could not load your templates.',
    );
    expect(page().textContent).not.toContain('private backend details');
    expect(page().querySelector('.count')).toBeNull();
    expect(page().textContent).not.toContain('no saved templates');
    expect(page().querySelector('[role="progressbar"]')).toBeNull();
    expect(page().querySelector('button')).toBeNull();
    expect(listTemplates).toHaveBeenCalledOnce();
  });

  it('passes plain selected-name copy to confirmation and sends no delete on cancellation', () => {
    const unsafeName = '<img src=x onerror="private details">';
    load([{ id: 'unsafe', name: unsafeName }, ...items]);
    deleteButtons()[0].click();
    fixture.detectChanges();

    expect(confirm).toHaveBeenCalledExactlyOnceWith({
      title: 'Delete template?',
      message: `Delete "${unsafeName}" permanently? This cannot be undone.`,
      confirmLabel: 'Delete template',
      cancelLabel: 'Cancel',
      intent: 'destructive',
    });
    expect(page().querySelector('img')).toBeNull();
    expect(deleteButtons().every((entry) => entry.disabled)).toBe(true);
    deleteButtons()[1].click();
    expect(confirm).toHaveBeenCalledTimes(1);

    confirmations[0].next(false);
    confirmations[0].complete();
    fixture.detectChanges();
    expect(deleteTemplate).not.toHaveBeenCalled();
    expect(deleteButtons().every((entry) => !entry.disabled)).toBe(true);
    expect(names()).toEqual([unsafeName, 'Same name', 'Same name']);
  });

  it('deletes exactly the selected ID once after confirmation, updates count, and moves focus', () => {
    load();
    const selected = deleteButtons()[1];
    selected.focus();
    selected.click();
    confirmations[0].next(true);
    fixture.detectChanges();

    expect(deleteTemplate).toHaveBeenCalledExactlyOnceWith('second');
    expect(deleteButtons().every((entry) => entry.disabled)).toBe(true);
    expect(page().querySelectorAll('li [role="status"]')).toHaveLength(1);
    expect(page().querySelector('li:nth-child(2) [role="status"]')?.textContent).toContain('Deleting...');
    deleteButtons()[0].click();
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(names()).toEqual(['Same name', 'Same name']);

    deletions[0].next(undefined);
    deletions[0].complete();
    fixture.detectChanges();
    expect(names()).toEqual(['Same name']);
    expect(page().querySelector('.count')?.textContent?.trim()).toBe('1 template');
    expect(page().querySelector('[role="status"]')?.textContent).toContain('Template deleted.');
    expect(document.activeElement).toBe(page().querySelector('#templates-title'));
    expect(responses[0].observers).toHaveLength(0);
    responses[0].next({ items });
    fixture.detectChanges();
    expect(names()).toEqual(['Same name']);
  });

  it('shows a generic error and keeps the row after a 404 without reloading', () => {
    load();
    deleteButtons()[1].focus();
    deleteButtons()[1].click();
    confirmations[0].next(true);
    deletions[0].error(new HttpErrorResponse({ status: 404 }));
    fixture.detectChanges();

    expect(listTemplates).toHaveBeenCalledOnce();
    expect(page().querySelector('[role="progressbar"]')).toBeNull();
    expect(names()).toEqual(['Same name', 'Same name']);
    expect(page().querySelector('.count')?.textContent?.trim()).toBe('2 templates');
    expect(deleteButtons().every((entry) => !entry.disabled)).toBe(true);
    expect(page().querySelector('[role="alert"]')?.textContent).toContain('Could not delete the template.');
    expect(page().textContent).not.toContain('no longer available');
  });

  it('keeps a row after a failed delete and allows a deliberate retry without refreshing', () => {
    load();
    deleteButtons()[0].click();
    confirmations[0].next(true);
    deletions[0].error(new HttpErrorResponse({ status: 0, statusText: 'Unknown Error' }));
    fixture.detectChanges();

    expect(names()).toEqual(['Same name', 'Same name']);
    expect(deleteButtons()[0].disabled).toBe(false);
    expect(deleteButtons()[1].disabled).toBe(false);
    expect(page().querySelector('[role="alert"]')?.textContent).toContain('Could not delete');
    expect(page().textContent).not.toContain('Refresh list');
    expect(listTemplates).toHaveBeenCalledTimes(1);

    deleteButtons()[0].click();
    expect(confirm).toHaveBeenCalledTimes(2);
    confirmations[1].next(true);
    fixture.detectChanges();
    expect(page().querySelector('[role="alert"]')).toBeNull();
    expect(deleteTemplate).toHaveBeenCalledTimes(2);
    expect(deleteTemplate).toHaveBeenLastCalledWith('first');
    deletions[1].next(undefined);
    deletions[1].complete();
    fixture.detectChanges();

    expect(names()).toEqual(['Same name']);
    expect(page().querySelector('.count')?.textContent?.trim()).toBe('1 template');
    expect(listTemplates).toHaveBeenCalledTimes(1);
  });
});
