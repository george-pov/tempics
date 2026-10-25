import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { Icon, IconName } from '../icon/icon';

export type AlertVariant = 'success' | 'error';

@Component({
  selector: 'app-alert',
  imports: [Icon],
  templateUrl: './alert.html',
  styleUrl: './alert.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[attr.role]': 'role()',
    '[class.is-error]': 'variant() === "error"',
  },
})
export class Alert {
  readonly variant = input.required<AlertVariant>();
  protected readonly role = computed(() => (this.variant() === 'error' ? 'alert' : 'status'));
  protected readonly icon = computed<IconName>(() =>
    this.variant() === 'error' ? 'error' : 'check_circle',
  );
}
