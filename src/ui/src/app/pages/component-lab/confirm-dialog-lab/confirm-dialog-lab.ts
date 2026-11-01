import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Button } from '../../../shared/components/button/button';
import { ConfirmDialogOptions } from '../../../shared/components/confirm-dialog/confirm-dialog-options';
import { ConfirmDialogService } from '../../../shared/components/confirm-dialog/confirm-dialog-service';
import { LabExample } from '../shared/lab-example/lab-example';
import { LabPage } from '../shared/lab-page/lab-page';

const normalExample: ConfirmDialogOptions = {
  title: 'Leave this page?',
  message: 'Your local changes will be lost.',
  confirmLabel: 'Leave page',
  cancelLabel: 'Keep editing',
  intent: 'normal',
};

const destructiveExample: ConfirmDialogOptions = {
  title: 'Delete sample template?',
  message: 'This permanently deletes the sample template.',
  confirmLabel: 'Delete template',
  cancelLabel: 'Cancel',
  intent: 'destructive',
};

@Component({
  selector: 'app-confirm-dialog-lab',
  imports: [Button, LabExample, LabPage],
  templateUrl: './confirm-dialog-lab.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConfirmDialogLab {
  private readonly dialog = inject(ConfirmDialogService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly result = signal('No dialog result yet.');

  protected openNormal(): void {
    this.open(normalExample);
  }

  protected openDestructive(): void {
    this.open(destructiveExample);
  }

  private open(options: ConfirmDialogOptions): void {
    this.dialog.confirm(options).pipe(takeUntilDestroyed(this.destroyRef)).subscribe((confirmed) => {
      this.result.set(confirmed ? 'Confirmed.' : 'Canceled or dismissed.');
    });
  }
}
