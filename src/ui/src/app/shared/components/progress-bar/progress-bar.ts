import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatProgressBar } from '@angular/material/progress-bar';

@Component({
  selector: 'app-progress-bar',
  imports: [MatProgressBar],
  templateUrl: './progress-bar.html',
  styleUrl: './progress-bar.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProgressBar {
  readonly label = input.required<string>();
}
