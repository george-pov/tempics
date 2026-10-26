import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormControl } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { finalize, startWith } from 'rxjs';
import { TemplateApi } from '../../shared/api/templates/template-api';
import { Alert } from '../../shared/components/alert/alert';
import { Button } from '../../shared/components/button/button';
import { Input } from '../../shared/components/input/input';
import { ProgressBar } from '../../shared/components/progress-bar/progress-bar';
import { INITIAL_TEMPLATE_DRAFT, type TemplateCreateDraft } from './template-create-draft';

@Component({
  selector: 'app-template-create',
  imports: [RouterLink, Alert, Button, Input, ProgressBar],
  templateUrl: './template-create.html',
  styleUrl: './template-create.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TemplateCreate {
  private readonly api = inject(TemplateApi);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly openingDraft: TemplateCreateDraft = INITIAL_TEMPLATE_DRAFT;
  readonly nameControl = new FormControl(this.openingDraft.name, { nonNullable: true });
  readonly templateControl = new FormControl(this.openingDraft.template, { nonNullable: true });

  private readonly nameValue = toSignal(
    this.nameControl.valueChanges.pipe(startWith(this.nameControl.value)),
    { initialValue: this.nameControl.value },
  );
  private readonly templateValue = toSignal(
    this.templateControl.valueChanges.pipe(startWith(this.templateControl.value)),
    { initialValue: this.templateControl.value },
  );

  protected readonly isSaving = signal(false);
  private readonly saveConfirmed = signal(false);
  protected readonly saveErrorMessage = signal('');
  protected readonly nameError = computed(() => {
    const name = this.nameValue().trim();
    if (!name) return 'Enter a template name.';
    if (name.length > 100) return 'Use 100 characters or fewer.';
    return '';
  });
  protected readonly templateError = computed(() => {
    const template = this.templateValue();
    if (!template.trim()) return 'Enter template markup.';
    if (template.length > 16_384) return 'Use 16,384 characters or fewer.';
    return '';
  });
  protected readonly hasChanges = computed(
    () =>
      this.nameValue() !== this.openingDraft.name ||
      this.templateValue() !== this.openingDraft.template,
  );
  protected readonly canCancel = computed(
    () => this.hasChanges() && !this.isSaving() && !this.saveConfirmed(),
  );
  protected readonly canSave = computed(
    () =>
      this.hasChanges() &&
      !this.nameError() &&
      !this.templateError() &&
      !this.isSaving() &&
      !this.saveConfirmed(),
  );

  protected save(): void {
    if (!this.canSave()) return;

    this.isSaving.set(true);
    this.saveErrorMessage.set('');
    this.api
      .createTemplate({
        name: this.nameControl.value.trim(),
        template: this.templateControl.value,
      })
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => {
          if (!this.saveConfirmed()) this.isSaving.set(false);
        }),
      )
      .subscribe({
        next: () => {
          this.saveConfirmed.set(true);
          void this.router.navigateByUrl('/templates').then(
            (navigated) => {
              if (!navigated) this.showNavigationError();
            },
            () => this.showNavigationError(),
          );
        },
        error: () =>
          this.saveErrorMessage.set(
            'Could not confirm the template was saved. Check Templates before retrying; it may already be on the list.',
          ),
      });
  }

  protected cancel(): void {
    if (!this.canCancel()) return;

    this.nameControl.setValue(this.openingDraft.name);
    this.templateControl.setValue(this.openingDraft.template);
    this.nameControl.markAsPristine();
    this.nameControl.markAsUntouched();
    this.templateControl.markAsPristine();
    this.templateControl.markAsUntouched();
    this.saveErrorMessage.set('');
  }

  private showNavigationError(): void {
    this.isSaving.set(false);
    this.saveErrorMessage.set(
      'Template was saved, but Templates could not be opened. Use the Templates link to check the list.',
    );
  }
}
