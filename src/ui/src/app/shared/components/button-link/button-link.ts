import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatButton } from '@angular/material/button';
import { RouterLink, type UrlTree } from '@angular/router';
import { type ButtonAppearance } from '../button/button';
import { Icon, type IconName } from '../icon/icon';

export type ButtonLinkTarget = string | readonly unknown[] | UrlTree;

@Component({
  selector: 'app-button-link',
  imports: [RouterLink, MatButton, Icon],
  templateUrl: './button-link.html',
  styles: [
    'a:focus-visible { outline: 3px solid var(--mat-sys-primary, #245b7a); outline-offset: 3px; }',
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ButtonLink {
  readonly route = input.required<ButtonLinkTarget>();
  readonly appearance = input<ButtonAppearance>('text');
  readonly icon = input<IconName>();
}
