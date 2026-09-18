import { ChangeDetectionStrategy, Component, ElementRef, inject, viewChild } from '@angular/core';
import { IsActiveMatchOptions, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Button } from '../../shared/components/button/button';
import { AuthSession } from '../../shared/auth/auth-session';

@Component({
  selector: 'app-layout',
  imports: [Button, RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './app-layout.html',
  styleUrl: './app-layout.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppLayout {
  protected readonly session = inject(AuthSession);
  private readonly content = viewChild.required<ElementRef<HTMLElement>>('content');
  private hasPage = false;

  protected readonly navItems = [
    { label: 'Image Generator', link: '/image-generator' },
    { label: 'Component Lab', link: '/component-lab' },
  ];

  protected readonly activeMatch: IsActiveMatchOptions = {
    paths: 'exact',
    queryParams: 'ignored',
    matrixParams: 'ignored',
    fragment: 'ignored',
  };

  protected skipToContent(event: Event): void {
    event.preventDefault();
    this.content().nativeElement.focus();
  }

  protected signOut(): void {
    void this.session.signOut();
  }

  protected pageActivated(): void {
    // Preserve initial browser focus; move it into the new page on later navigation.
    if (this.hasPage) {
      this.content().nativeElement.focus();
    }
    this.hasPage = true;
  }
}
