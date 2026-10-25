import { booleanAttribute, ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatButton } from '@angular/material/button';

type ButtonType = 'button' | 'submit' | 'reset';
export type ButtonAppearance = 'filled' | 'outlined' | 'text';

@Component({
  selector: 'app-button',
  imports: [MatButton],
  templateUrl: './button.html',
  styles: [
    'button:focus-visible { outline: 3px solid var(--mat-sys-primary, #245b7a); outline-offset: 3px; }',
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Button {
  readonly appearance = input<ButtonAppearance>('filled');
  readonly type = input<ButtonType>('button');
  readonly disabled = input(false, { transform: booleanAttribute });
}
