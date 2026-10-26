import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TemplateApi } from '../../shared/api/templates/template-api';
import { type TemplateListItemResponse } from '../../shared/api/templates/template-list-response';
import { Alert } from '../../shared/components/alert/alert';
import { Button } from '../../shared/components/button/button';
import { Icon } from '../../shared/components/icon/icon';
import { ProgressBar } from '../../shared/components/progress-bar/progress-bar';

type TemplatesState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'loaded'; readonly items: readonly TemplateListItemResponse[] }
  | { readonly kind: 'error' };

@Component({
  selector: 'app-templates',
  imports: [Alert, Button, Icon, ProgressBar],
  templateUrl: './templates.html',
  styleUrl: './templates.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Templates {
  private readonly api = inject(TemplateApi);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly state = signal<TemplatesState>({ kind: 'loading' });

  constructor() {
    this.loadTemplates();
  }

  protected loadTemplates(): void {
    this.state.set({ kind: 'loading' });
    this.api
      .listTemplates()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ items }) => this.state.set({ kind: 'loaded', items }),
        error: () => this.state.set({ kind: 'error' }),
      });
  }
}
