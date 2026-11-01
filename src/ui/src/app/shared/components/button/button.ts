import { booleanAttribute, ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatButton } from '@angular/material/button';

type ButtonType = 'button' | 'submit' | 'reset';
export type ButtonAppearance = 'filled' | 'outlined' | 'text';
export type ButtonIntent = 'normal' | 'destructive';

@Component({
  selector: 'app-button',
  imports: [MatButton],
  templateUrl: './button.html',
  styleUrl: './button.scss',
  host: { '[class.is-full-width]': 'fullWidth()' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Button {
  readonly appearance = input<ButtonAppearance>('filled');
  readonly intent = input<ButtonIntent>('normal');
  readonly type = input<ButtonType>('button');
  readonly disabled = input(false, { transform: booleanAttribute });
  readonly fullWidth = input(false, { transform: booleanAttribute });
}
