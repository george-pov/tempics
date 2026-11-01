import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { Subscription, take } from 'rxjs';
import { TemplateApi } from '../../shared/api/templates/template-api';
import type { TemplateSummary } from '../../shared/api/templates/template-summary';
import { Alert, type AlertVariant } from '../../shared/components/alert/alert';
import { ButtonLink } from '../../shared/components/button-link/button-link';
import { ConfirmDialogService } from '../../shared/components/confirm-dialog/confirm-dialog-service';
import { Icon } from '../../shared/components/icon/icon';
import { ProgressBar } from '../../shared/components/progress-bar/progress-bar';

type TemplatesState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'loaded'; readonly items: readonly TemplateSummary[] }
  | { readonly kind: 'error' };

type DeleteFeedback = {
  readonly variant: AlertVariant;
  readonly message: string;
};

type DeleteState = {
  readonly kind: 'confirming' | 'deleting';
  readonly id: string;
};

@Component({
  selector: 'app-templates',
  imports: [Alert, ButtonLink, Icon, ProgressBar, RouterLink],
  templateUrl: './templates.html',
  styleUrl: './templates.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Templates {
  private readonly api = inject(TemplateApi);
  private readonly confirmDialog = inject(ConfirmDialogService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly listHeading = viewChild.required<ElementRef<HTMLHeadingElement>>('listHeading');
  private listSubscription: Subscription | undefined;

  protected readonly state = signal<TemplatesState>({ kind: 'loading' });
  protected readonly deleteState = signal<DeleteState | null>(null);
  protected readonly feedback = signal<DeleteFeedback | null>(null);

  constructor() {
    this.loadTemplates();
  }

  private loadTemplates(): void {
    this.listSubscription?.unsubscribe();
    this.state.set({ kind: 'loading' });
    this.feedback.set(null);
    this.listSubscription = this.api
      .listTemplates()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ items }) => this.state.set({ kind: 'loaded', items }),
        error: () => {
          this.state.set({ kind: 'error' });
        },
      });
  }

  protected confirmDelete(template: TemplateSummary): void {
    if (this.deleteState() !== null) return;

    this.deleteState.set({ kind: 'confirming', id: template.id });
    this.confirmDialog
      .confirm({
        title: 'Delete template?',
        message: `Delete "${template.name}" permanently? This cannot be undone.`,
        confirmLabel: 'Delete template',
        cancelLabel: 'Cancel',
        intent: 'destructive',
      })
      .pipe(take(1), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (confirmed) => {
          if (!confirmed) {
            this.deleteState.set(null);
            return;
          }

          this.feedback.set(null);
          this.deleteState.set({ kind: 'deleting', id: template.id });
          this.deleteTemplate(template.id);
        },
        error: () => {
          this.deleteState.set(null);
          this.feedback.set({
            variant: 'error',
            message: 'Could not open the confirmation. Try again.',
          });
        },
      });
  }

  private deleteTemplate(id: string): void {
    this.api
      .deleteTemplate(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.deleteState.set(null);
          const current = this.state();
          if (current.kind !== 'loaded') {
            this.loadTemplates();
            return;
          }
          this.listSubscription?.unsubscribe();
          const remaining = current.items.filter((item) => item.id !== id);
          this.state.set({ kind: 'loaded', items: remaining });
          this.feedback.set({
            variant: 'success',
            message: `Template deleted. ${remaining.length} ${remaining.length === 1 ? 'template' : 'templates'} remaining.`,
          });
          this.listHeading().nativeElement.focus();
        },
        error: () => {
          this.deleteState.set(null);
          this.feedback.set({
            variant: 'error',
            message: 'Could not delete the template.',
          });
        },
      });
  }
}
