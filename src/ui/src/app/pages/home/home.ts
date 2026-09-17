import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Button } from '../../shared/components/button/button';
import { DemoSession } from '../../shared/session/demo-session';

@Component({
  selector: 'app-home',
  imports: [Button],
  templateUrl: './home.html',
  styleUrl: './home.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Home {
  private readonly session = inject(DemoSession);
  private readonly router = inject(Router);

  protected signIn(): void {
    this.session.signIn();
    void this.router.navigateByUrl('/image-generator', { replaceUrl: true });
  }
}
