import { booleanAttribute, ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatButton } from '@angular/material/button';

type ButtonType = 'button' | 'submit' | 'reset';

@Component({
  selector: 'app-button',
  imports: [MatButton],
  templateUrl: './button.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Button {
  readonly type = input<ButtonType>('button');
  readonly disabled = input(false, { transform: booleanAttribute });
}
