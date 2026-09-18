import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize, tap } from 'rxjs';
import { Button } from '../../shared/components/button/button';
import { ImageRenderApi } from '../../shared/api/image-render/image-render-api';

@Component({
  selector: 'app-image-generator',
  imports: [Button],
  templateUrl: './image-generator.html',
  styleUrl: './image-generator.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ImageGenerator {
  private readonly api = inject(ImageRenderApi);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly isGenerating = signal(false);
  protected readonly errorMessage = signal('');
  protected readonly previewUrl = signal<string | null>(null);

  constructor() {
    this.destroyRef.onDestroy(() => this.revokePreview());
  }

  protected generateSample(): void {
    if (this.isGenerating()) return;

    this.isGenerating.set(true);
    this.errorMessage.set('');
    this.api
      .renderSample()
      .pipe(
        tap((blob) => this.replacePreview(blob)),
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.isGenerating.set(false)),
      )
      .subscribe({
        error: () => this.errorMessage.set('Could not generate the sample image. Try again.'),
      });
  }

  private replacePreview(blob: Blob): void {
    if (blob.type !== 'image/png' || blob.size === 0) {
      throw new Error('Invalid sample image');
    }

    const nextUrl = URL.createObjectURL(blob);
    const previousUrl = this.previewUrl();
    this.previewUrl.set(nextUrl);
    if (previousUrl) URL.revokeObjectURL(previousUrl);
  }

  private revokePreview(): void {
    const url = this.previewUrl();
    this.previewUrl.set(null);
    if (url) URL.revokeObjectURL(url);
  }
}
