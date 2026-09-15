import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { Button } from '../../../shared/components/button/button';
import { LabExample } from '../shared/lab-example/lab-example';
import { LabPage } from '../shared/lab-page/lab-page';

@Component({
  selector: 'app-button-lab',
  imports: [Button, LabExample, LabPage],
  templateUrl: './button-lab.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ButtonLab {
  protected readonly clicks = signal(0);
  protected readonly formStatus = signal('No form action yet.');

  protected recordClick(): void {
    this.clicks.update((count) => count + 1);
  }

  protected submit(event: Event): void {
    event.preventDefault();
    this.formStatus.set('Form submitted.');
  }

  protected reset(): void {
    this.formStatus.set('Form reset.');
  }
}
