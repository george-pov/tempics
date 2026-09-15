import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-lab-page',
  templateUrl: './lab-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LabPage {
  readonly titleId = input.required<string>();
  readonly title = input.required<string>();
}
