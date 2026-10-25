import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { startWith, switchMap } from 'rxjs';

@Component({
  selector: 'app-input',
  imports: [ReactiveFormsModule, MatFormFieldModule, MatInputModule],
  templateUrl: './input.html',
  styleUrl: './input.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Input {
  private static nextId = 0;

  readonly control = input.required<FormControl<string>>();
  readonly label = input.required<string>();
  readonly multiline = input(false, { transform: booleanAttribute });
  readonly hint = input('');
  readonly error = input('');
  readonly showCharacterCount = input(false, { transform: booleanAttribute });
  readonly monospace = input(false, { transform: booleanAttribute });

  protected readonly fieldId = `app-input-${++Input.nextId}`;
  protected readonly descriptionId = `${this.fieldId}-description`;
  private readonly controlValue = toSignal(
    toObservable(this.control).pipe(
      switchMap((control) => control.valueChanges.pipe(startWith(control.value))),
    ),
    { initialValue: '' },
  );
  protected readonly characterCount = computed(() => this.controlValue().length);
}
