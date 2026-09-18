import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Button } from '../../shared/components/button/button';
import { AuthSession } from '../../shared/auth/auth-session';
import { ImageGenerator } from '../image-generator/image-generator';

@Component({
  selector: 'app-home',
  imports: [Button, ImageGenerator],
  templateUrl: './home.html',
  styleUrl: './home.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Home {
  protected readonly session = inject(AuthSession);

  protected signIn(): void {
    void this.session.signIn();
  }
}
