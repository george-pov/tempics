import { ChangeDetectionStrategy, Component, computed } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, Validators } from '@angular/forms';
import { startWith } from 'rxjs';
import { Input } from '../../../shared/components/input/input';
import { LabExample } from '../shared/lab-example/lab-example';
import { LabPage } from '../shared/lab-page/lab-page';

const sampleMarkup = `<Grid>
${Array.from({ length: 30 }, (_, index) => `  <TextBlock Text="Example line ${index + 1}" />`).join('\n')}
</Grid>`;

@Component({
  selector: 'app-input-lab',
  imports: [Input, LabExample, LabPage],
  templateUrl: './input-lab.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InputLab {
  protected readonly emptyName = new FormControl('', { nonNullable: true });
  protected readonly filledName = new FormControl('Autumn illustration', { nonNullable: true });
  protected readonly disabledName = new FormControl(
    { value: 'Unavailable for editing', disabled: true },
    { nonNullable: true },
  );
  protected readonly requiredName = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required],
  });
  protected readonly markup = new FormControl(sampleMarkup, { nonNullable: true });

  private readonly requiredNameStatus = toSignal(
    this.requiredName.statusChanges.pipe(startWith(this.requiredName.status)),
    { initialValue: this.requiredName.status },
  );
  protected readonly requiredNameError = computed(() =>
    this.requiredNameStatus() === 'INVALID' ? 'Enter a name.' : '',
  );
}
