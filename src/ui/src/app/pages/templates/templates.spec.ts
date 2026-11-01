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

  it('starts one list read on activation', () => {
    expect(listTemplates).toHaveBeenCalledOnce();
  });

  it('shows loading feedback before a response', () => {
    expect(page().querySelector('[role="progressbar"]')?.getAttribute('aria-label')).toContain(
      'Loading your templates',
    );
    expect(page().textContent).not.toContain('no saved templates');
  });

  it('shows every returned name in order, including duplicates', () => {
    responses[0].next({
      items: [
        { id: 'first', name: 'Sample announcement' },
        { id: 'second', name: 'Sample announcement' },
        { id: 'third', name: 'Third name' },
      ],
    });
    responses[0].complete();
    fixture.detectChanges();

    expect(names()).toEqual(['Sample announcement', 'Sample announcement', 'Third name']);
  });

  it('renders an untrusted name as text', () => {
    const unsafeName = '<img src=x onerror="private details">';
    load([{ id: 'unsafe', name: unsafeName }]);
    expect(names()).toEqual([unsafeName]);
    expect(page().querySelector('img')).toBeNull();
  });

  it('gives each delete action the selected row name', () => {
    const unsafeName = '<img src=x onerror="private details">';
    load([{ id: 'unsafe', name: unsafeName }, ...items]);
    expect(deleteButtons().map((item) => item.getAttribute('aria-label'))).toEqual([
      `Delete ${unsafeName}`,
      'Delete Same name',
      'Delete Same name',
    ]);
  });

  it('shows a useful empty state only after a successful empty response', () => {
    responses[0].next({ items: [] });
    responses[0].complete();
    fixture.detectChanges();

    expect(page().querySelector('.count')?.textContent?.trim()).toBe('0 templates');
    expect(page().querySelector('[role="status"]')?.textContent).toContain(
      'You have no saved templates yet.',
    );
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
  });

  it('passes the selected name as plain confirmation copy', () => {
    const unsafeName = '<img src=x onerror="private details">';
    load([{ id: 'unsafe', name: unsafeName }, ...items]);
    deleteButtons()[0].click();
    expect(confirm).toHaveBeenCalledExactlyOnceWith({
      title: 'Delete template?',
      message: `Delete "${unsafeName}" permanently? This cannot be undone.`,
      confirmLabel: 'Delete template',
      cancelLabel: 'Cancel',
      intent: 'destructive',
    });
  });

  it('ignores another delete action while confirmation is pending', () => {
    load();
    deleteButtons()[0].click();
    fixture.detectChanges();
    expect(deleteButtons().every((entry) => entry.disabled)).toBe(true);
    deleteButtons()[1].click();
    expect(confirm).toHaveBeenCalledTimes(1);
  });

  it('sends no delete request after confirmation is cancelled', () => {
    load();
    deleteButtons()[0].click();
    confirmations[0].next(false);
    confirmations[0].complete();
    expect(deleteTemplate).not.toHaveBeenCalled();
  });

  it('locks delete actions while one deletion is pending', () => {
    load();
    deleteButtons()[1].click();
    confirmations[0].next(true);
    fixture.detectChanges();
    expect(deleteButtons().every((entry) => entry.disabled)).toBe(true);
    expect(page().querySelectorAll('li [role="status"]')).toHaveLength(1);
    deleteButtons()[0].click();
    expect(confirm).toHaveBeenCalledTimes(1);
  });

  it('removes only the selected ID and updates the count after successful deletion', () => {
    load();
    deleteButtons()[1].click();
    confirmations[0].next(true);
    expect(deleteTemplate).toHaveBeenCalledExactlyOnceWith('second');
    deletions[0].next(undefined);
    deletions[0].complete();
    fixture.detectChanges();
    expect(names()).toEqual(['Same name']);
    expect(page().querySelector('.count')?.textContent?.trim()).toBe('1 template');
  });

  it('moves focus to the list heading after deletion', () => {
    load();
    deleteButtons()[1].focus();
    deleteButtons()[1].click();
    confirmations[0].next(true);
    deletions[0].next(undefined);
    fixture.detectChanges();
    expect(document.activeElement).toBe(page().querySelector('#templates-title'));
  });

  it('ignores a late list response after deletion', () => {
    load();
    deleteButtons()[1].click();
    confirmations[0].next(true);
    deletions[0].next(undefined);
    fixture.detectChanges();
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
    expect(names()).toEqual(['Same name', 'Same name']);
    expect(page().querySelector('[role="alert"]')?.textContent).toContain('Could not delete the template.');
  });

  it('keeps a row after a failed delete and allows a deliberate retry without refreshing', () => {
    load();
    deleteButtons()[0].click();
    confirmations[0].next(true);
    deletions[0].error(new HttpErrorResponse({ status: 0, statusText: 'Unknown Error' }));
    fixture.detectChanges();

    deleteButtons()[0].click();
    expect(confirm).toHaveBeenCalledTimes(2);
    confirmations[1].next(true);
    expect(deleteTemplate).toHaveBeenCalledTimes(2);
    expect(deleteTemplate).toHaveBeenLastCalledWith('first');
    deletions[1].next(undefined);
    deletions[1].complete();
    fixture.detectChanges();

    expect(names()).toEqual(['Same name']);
    expect(listTemplates).toHaveBeenCalledTimes(1);
  });
});
