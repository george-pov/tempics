import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormControl } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { finalize, startWith, Subscription, type Observable } from 'rxjs';
import { ImageRenderApi } from '../../shared/api/image-render/image-render-api';
import { TemplateApi } from '../../shared/api/templates/template-api';
import type { TemplateDetail } from '../../shared/api/templates/template-detail';
import { Alert } from '../../shared/components/alert/alert';
import { Button } from '../../shared/components/button/button';
import { ButtonLink } from '../../shared/components/button-link/button-link';
import { Input } from '../../shared/components/input/input';
import { ProgressBar } from '../../shared/components/progress-bar/progress-bar';
import { INITIAL_TEMPLATE_DRAFT } from './template-editor-draft';

type TemplateEditorState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'ready'; readonly detail: TemplateDetail }
  | { readonly kind: 'error' };

@Component({
  selector: 'app-template-editor',
  imports: [Alert, Button, ButtonLink, Input, ProgressBar],
  templateUrl: './template-editor.html',
  styleUrl: './template-editor.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TemplateEditor {
  private readonly api = inject(TemplateApi);
  private readonly imageRenderApi = inject(ImageRenderApi);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly route = inject(ActivatedRoute);
  private readonly routeId = signal(this.route.snapshot.paramMap.get('id'));
  private detailSubscription: Subscription | undefined;
  private saveSubscription: Subscription | undefined;
  private previewSubscription: Subscription | undefined;
  private previewRequestId = 0;
  private routeGeneration = 0;

  protected readonly isEditing = computed(() => this.routeId() !== null);
  readonly openingDraft = INITIAL_TEMPLATE_DRAFT;
  readonly nameControl = new FormControl(this.isEditing() ? '' : this.openingDraft.name, {
    nonNullable: true,
  });
  readonly templateControl = new FormControl(this.isEditing() ? '' : this.openingDraft.template, {
    nonNullable: true,
  });

  private readonly nameValue = toSignal(
    this.nameControl.valueChanges.pipe(startWith(this.nameControl.value)),
    { initialValue: this.nameControl.value },
  );
  private readonly templateValue = toSignal(
    this.templateControl.valueChanges.pipe(startWith(this.templateControl.value)),
    { initialValue: this.templateControl.value },
  );

  protected readonly state = signal<TemplateEditorState>(
    this.isEditing() ? { kind: 'loading' } : { kind: 'ready', detail: this.openingDraft },
  );
  protected readonly isSaving = signal(false);
  private readonly saveConfirmed = signal(false);
  protected readonly saveErrorMessage = signal('');
  protected readonly isPreviewing = signal(false);
  protected readonly previewErrorMessage = signal('');
  protected readonly previewUrl = signal<string | null>(null);
  protected readonly nameError = computed(() => {
    const name = this.nameValue().trim();
    if (!name) return 'Enter a template name.';
    if (name.length > 100) return 'Max 100 characters.';
    return '';
  });
  protected readonly templateError = computed(() => {
    const template = this.templateValue();
    if (!template.trim()) return 'Enter template markup.';
    if (template.length > 16_384) return 'Max 16,384 characters.';
    return '';
  });
  protected readonly hasChanges = computed(() => {
    const current = this.state();
    return (
      current.kind === 'ready' &&
      (this.nameValue() !== current.detail.name || this.templateValue() !== current.detail.template)
    );
  });
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
  protected readonly canPreview = computed(() => {
    if (this.state().kind !== 'ready') return false;
    const template = this.templateValue();
    return (
      !!template.trim() &&
      template.length <= 2_048 &&
      new TextEncoder().encode(JSON.stringify({ template })).length <= 2_048
    );
  });

  constructor() {
    this.templateControl.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.clearPreview());
    this.destroyRef.onDestroy(() => this.clearPreview());
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const id = params.get('id');
      if (id === this.routeId()) return;
      this.routeId.set(id);
      this.resetForRoute();
    });
    if (this.isEditing()) this.loadTemplate();
  }

  private loadTemplate(): void {
    const id = this.routeId();
    if (id === null) return;

    this.detailSubscription = this.api
      .getTemplate(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (detail) => {
          this.nameControl.setValue(detail.name);
          this.templateControl.setValue(detail.template);
          this.nameControl.markAsPristine();
          this.templateControl.markAsPristine();
          this.state.set({ kind: 'ready', detail });
        },
        error: () => this.state.set({ kind: 'error' }),
      });
  }

  private resetForRoute(): void {
    this.routeGeneration++;
    this.detailSubscription?.unsubscribe();
    this.saveSubscription?.unsubscribe();
    this.clearPreview();
    this.saveConfirmed.set(false);
    this.isSaving.set(false);
    this.saveErrorMessage.set('');
    const id = this.routeId();
    const detail = id === null ? this.openingDraft : null;
    this.state.set(detail ? { kind: 'ready', detail } : { kind: 'loading' });
    this.nameControl.setValue(detail?.name ?? '');
    this.templateControl.setValue(detail?.template ?? '');
    this.nameControl.markAsPristine();
    this.nameControl.markAsUntouched();
    this.templateControl.markAsPristine();
    this.templateControl.markAsUntouched();
    if (id !== null) this.loadTemplate();
  }

  protected preview(): void {
    if (!this.canPreview()) return;

    const template = this.templateControl.value;
    this.clearPreview();
    const requestId = this.previewRequestId;
    this.isPreviewing.set(true);
    this.previewSubscription = this.imageRenderApi
      .renderPreview(template)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => {
          if (this.previewRequestId === requestId) {
            this.isPreviewing.set(false);
            this.previewSubscription = undefined;
          }
        }),
      )
      .subscribe({
        next: (blob) => {
          if (this.previewRequestId !== requestId || this.templateControl.value !== template)
            return;
          if (!(blob instanceof Blob) || blob.type !== 'image/png' || blob.size === 0) {
            this.showPreviewError();
            return;
          }

          try {
            this.previewUrl.set(URL.createObjectURL(blob));
          } catch {
            this.showPreviewError();
          }
        },
        error: () => {
          if (this.previewRequestId === requestId && this.templateControl.value === template) {
            this.showPreviewError();
          }
        },
      });
  }

  protected save(): void {
    if (!this.canSave()) return;

    this.isSaving.set(true);
    this.saveErrorMessage.set('');
    const draft = {
      name: this.nameControl.value.trim(),
      template: this.templateControl.value,
    };
    const id = this.routeId();
    const generation = this.routeGeneration;
    const request: Observable<unknown> =
      id === null ? this.api.createTemplate(draft) : this.api.updateTemplate(id, draft);
    this.saveSubscription = request
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => {
          if (!this.saveConfirmed()) this.isSaving.set(false);
        }),
      )
      .subscribe({
        next: () => {
          if (this.routeGeneration !== generation || this.routeId() !== id) return;
          this.saveConfirmed.set(true);
          void this.router.navigateByUrl('/templates').then(
            (navigated) => {
              if (!navigated && this.routeGeneration === generation) this.showNavigationError();
            },
            () => {
              if (this.routeGeneration === generation) this.showNavigationError();
            },
          );
        },
        error: () => {
          if (this.routeGeneration !== generation || this.routeId() !== id) return;
          this.saveErrorMessage.set(
            this.isEditing()
              ? 'Could not save this template. Your changes are still here.'
              : 'Could not confirm the template was saved. Check Templates before retrying; it may already be on the list.',
          );
        },
      });
  }

  protected cancel(): void {
    const current = this.state();
    if (current.kind !== 'ready' || !this.canCancel()) return;

    this.clearPreview();
    this.nameControl.setValue(current.detail.name);
    this.templateControl.setValue(current.detail.template);
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

  private showPreviewError(): void {
    this.previewErrorMessage.set('Could not preview this markup. Check it and try again.');
  }

  private clearPreview(): void {
    this.previewRequestId++;
    this.previewSubscription?.unsubscribe();
    this.previewSubscription = undefined;
    this.isPreviewing.set(false);
    this.previewErrorMessage.set('');
    const url = this.previewUrl();
    this.previewUrl.set(null);
    if (url) URL.revokeObjectURL(url);
  }
}
