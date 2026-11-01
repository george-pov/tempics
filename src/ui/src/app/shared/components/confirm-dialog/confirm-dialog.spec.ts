import { Component, inject } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { provideRouter } from '@angular/router';
import { ConfirmDialogService } from './confirm-dialog-service';
import type { ConfirmDialogOptions } from './confirm-dialog-options';

const options: ConfirmDialogOptions = {
  title: 'Remove this draft?',
  message: 'This action permanently removes the selected draft.',
  confirmLabel: 'Remove draft',
  cancelLabel: 'Keep draft',
  intent: 'destructive',
};

@Component({ template: '<button type="button" (click)="open()">Open dialog</button>' })
class DialogHost {
  private readonly confirmation = inject(ConfirmDialogService);
  result: boolean | undefined;

  open(): void {
    this.confirmation.confirm(options).subscribe((result) => (this.result = result));
  }
}

describe('ConfirmDialog', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: [provideRouter([])] }));

  afterEach(() => TestBed.inject(MatDialog).closeAll());

  async function settle(fixture: { whenStable(): Promise<unknown> }): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 50));
    await fixture.whenStable();
  }

  async function open() {
    const fixture = TestBed.createComponent(DialogHost);
    await fixture.whenStable();
    const invoker = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
    invoker.focus();
    invoker.click();
    await settle(fixture);
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
    if (!dialog) throw new Error('Confirmation dialog did not open');
    return { fixture, dialog, invoker };
  }

  it('renders supplied title, message, and action labels', async () => {
    const { dialog } = await open();
    const title = dialog.querySelector('h2')!;
    const message = dialog.querySelector('p')!;
    const buttons = dialog.querySelectorAll<HTMLButtonElement>('button');
    expect(title.textContent?.trim()).toBe(options.title);
    expect(message.textContent?.trim()).toBe(options.message);
    expect(Array.from(buttons, (button) => button.textContent?.trim())).toEqual([
      options.cancelLabel,
      options.confirmLabel,
    ]);
  });

  it('associates the title and message with the dialog', async () => {
    const { dialog } = await open();
    expect(dialog.getAttribute('aria-labelledby')).toBe(dialog.querySelector('h2')?.id);
    expect(dialog.getAttribute('aria-describedby')).toBe(dialog.querySelector('p')?.id);
  });

  it('confirms through the visible action button', async () => {
    const { fixture, dialog } = await open();
    dialog.querySelectorAll<HTMLButtonElement>('button')[1].click();
    await settle(fixture);
    expect(fixture.componentInstance.result).toBe(true);
  });

  it('never interprets untrusted text as HTML', async () => {
    const malicious: ConfirmDialogOptions = {
      ...options,
      title: '<img src=x onerror=alert(1)>',
      message: '<script>alert(1)</script>',
      intent: 'normal',
    };
    const fixture = TestBed.createComponent(DialogHost);
    await fixture.whenStable();
    TestBed.inject(ConfirmDialogService).confirm(malicious).subscribe();
    await settle(fixture);
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]')!;
    expect(dialog.querySelector('img, script')).toBeNull();
    expect(dialog.querySelector('h2')?.textContent).toBe(malicious.title);
    expect(dialog.querySelector('p')?.textContent).toBe(malicious.message);
  });

  it('closes with cancellation through the visible Cancel button', async () => {
    const { fixture, dialog } = await open();
    dialog.querySelector<HTMLButtonElement>('.cancel button')!.click();
    await settle(fixture);
    expect(fixture.componentInstance.result).toBe(false);
  });
});
