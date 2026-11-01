import { Component, inject } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { provideRouter, Router } from '@angular/router';
import { ConfirmDialogService } from './confirm-dialog-service';
import type { ConfirmDialogOptions } from './confirm-dialog-options';

const options: ConfirmDialogOptions = {
  title: 'Confirm action',
  message: 'Continue with this action?',
  confirmLabel: 'Continue',
  cancelLabel: 'Cancel',
  intent: 'normal',
};

@Component({ template: '<button type="button" (click)="open()">Open dialog</button>' })
class DialogInvoker {
  private readonly confirmation = inject(ConfirmDialogService);
  results: boolean[] = [];

  open(): void {
    this.confirmation.confirm(options).subscribe((result) => this.results.push(result));
  }
}

describe('ConfirmDialogService', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: [provideRouter([])] }));

  afterEach(() => TestBed.inject(MatDialog).closeAll());

  async function settle(fixture: { whenStable(): Promise<unknown> }): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 50));
    await fixture.whenStable();
  }

  async function open() {
    const fixture = TestBed.createComponent(DialogInvoker);
    await fixture.whenStable();
    const invoker = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
    invoker.focus();
    invoker.click();
    await settle(fixture);
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]')!;
    return { fixture, invoker, dialog };
  }

  it('starts focus on Cancel and returns it to the connected invoker', async () => {
    const { fixture, invoker, dialog } = await open();
    const cancel = dialog.querySelector<HTMLButtonElement>('.cancel button')!;
    expect(document.activeElement).toBe(cancel);
    cancel.click();
    await settle(fixture);
    expect(document.activeElement).toBe(invoker);
  });

  it('treats Escape as cancellation', async () => {
    const { fixture, dialog } = await open();
    const escape = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true });
    Object.defineProperty(escape, 'keyCode', { value: 27 });
    dialog.querySelector<HTMLButtonElement>('.cancel button')!.dispatchEvent(escape);
    await settle(fixture);
    expect(fixture.componentInstance.results).toEqual([false]);
  });

  it('treats backdrop dismissal as cancellation', async () => {
    const { fixture } = await open();
    document.querySelector<HTMLElement>('.cdk-overlay-backdrop')!.click();
    await settle(fixture);
    expect(fixture.componentInstance.results).toEqual([false]);
  });

  it('maps an undefined close result to cancellation', async () => {
    const { fixture } = await open();
    TestBed.inject(MatDialog).closeAll();
    await settle(fixture);
    expect(fixture.componentInstance.results).toEqual([false]);
  });

  it('closes on route navigation without restoring focus to the former page', async () => {
    const { fixture, invoker } = await open();
    const next = document.createElement('button');
    document.body.append(next);
    next.focus();
    try {
      await TestBed.inject(Router)
        .navigateByUrl('/gone')
        .catch(() => false);
      await settle(fixture);
      expect(fixture.componentInstance.results).toEqual([false]);
      expect(document.activeElement).not.toBe(invoker);
    } finally {
      next.remove();
    }
  });
});
