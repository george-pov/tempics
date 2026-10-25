import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatIcon } from '@angular/material/icon';

export type IconName = 'add' | 'check_circle' | 'error';

@Component({
  selector: 'app-icon',
  imports: [MatIcon],
  templateUrl: './icon.html',
  styleUrl: './icon.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'aria-hidden': 'true',
  },
})
export class Icon {
  readonly name = input.required<IconName>();
}
