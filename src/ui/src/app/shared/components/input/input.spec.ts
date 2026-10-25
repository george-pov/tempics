import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl } from '@angular/forms';
import { Input } from './input';

@Component({
  imports: [Input],
  template: `<app-input
    [control]="control()"
    [label]="label()"
    [multiline]="multiline()"
    [hint]="hint()"
    [error]="error()"
    [showCharacterCount]="showCount()"
    [monospace]="monospace()"
  />`,
})
class InputHost {
  readonly control = signal(new FormControl('Initial', { nonNullable: true }));
  readonly label = signal('Template name');
  readonly multiline = signal(false);
  readonly hint = signal('Choose a clear name.');
  readonly error = signal('');
  readonly showCount = signal(false);
  readonly monospace = signal(false);
}

describe('Input', () => {
  let fixture: ComponentFixture<InputHost>;

  beforeEach(async () => {
    fixture = TestBed.createComponent(InputHost);
    await fixture.whenStable();
  });

  function field(): HTMLInputElement | HTMLTextAreaElement {
    return fixture.nativeElement.querySelector('input, textarea');
  }

  function description(): HTMLElement | null {
    return fixture.nativeElement.querySelector('mat-hint:not(.count)');
  }

  it('associates its visible label and hint with a two-way text control', async () => {
    const input = field() as HTMLInputElement;
    expect(input.tagName).toBe('INPUT');
    expect(input.type).toBe('text');
    expect(input.value).toBe('Initial');
    expect(fixture.nativeElement.querySelector(`label[for="${input.id}"]`)?.textContent).toContain(
      'Template name',
    );
    expect(input.getAttribute('aria-describedby')?.split(' ')).toContain(description()?.id);
    expect(description()?.textContent).toContain('Choose a clear name.');

    input.value = 'Typed name';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    expect(fixture.componentInstance.control().value).toBe('Typed name');

    fixture.componentInstance.control().setValue('Programmatic name');
    await fixture.whenStable();
    expect(input.value).toBe('Programmatic name');
  });

  it('edits multiline markup as plain text in both directions', async () => {
    fixture.componentInstance.multiline.set(true);
    fixture.componentInstance.monospace.set(true);
    await fixture.whenStable();
    const textarea = field() as HTMLTextAreaElement;
    expect(textarea.tagName).toBe('TEXTAREA');
    expect(textarea.classList.contains('is-monospace')).toBe(true);
    const markup = '<Grid><TextBlock Text="Hello" /></Grid>';
    textarea.value = markup;
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    expect(fixture.componentInstance.control().value).toBe(markup);
    expect(fixture.nativeElement.querySelector('grid, textblock')).toBeNull();

    fixture.componentInstance.control().setValue('<Canvas />');
    await fixture.whenStable();
    expect(textarea.value).toBe('<Canvas />');
  });

  it('rebinds when the caller replaces the control and follows disabled state', async () => {
    const oldControl = fixture.componentInstance.control();
    const replacement = new FormControl(
      { value: 'Replacement', disabled: true },
      { nonNullable: true },
    );
    fixture.componentInstance.control.set(replacement);
    await fixture.whenStable();
    expect(field().value).toBe('Replacement');
    expect(field().disabled).toBe(true);

    replacement.enable();
    replacement.setValue('Enabled');
    await fixture.whenStable();
    expect(field().disabled).toBe(false);
    expect(field().value).toBe('Enabled');
    oldControl.setValue('Obsolete');
    await fixture.whenStable();
    expect(field().value).toBe('Enabled');
  });

  it('shows a supplied error even for a valid control and replaces the hint', async () => {
    expect(fixture.componentInstance.control().valid).toBe(true);
    fixture.componentInstance.error.set('The name is already in use.');
    await fixture.whenStable();
    const alert = fixture.nativeElement.querySelector('[role="alert"]') as HTMLElement;
    expect(alert.textContent).toContain('The name is already in use.');
    expect(alert.textContent).not.toContain('Choose a clear name.');
    expect(alert.classList.contains('is-error')).toBe(true);
    expect(field().getAttribute('aria-describedby')?.split(' ')).toContain(alert.id);
    expect(field().getAttribute('aria-invalid')).toBe('true');

    fixture.componentInstance.error.set('');
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('[role="alert"]')).toBeNull();
    expect(description()?.textContent).toContain('Choose a clear name.');
  });

  it('updates an optional length count for typing, setValue, and control replacement', async () => {
    fixture.componentInstance.showCount.set(true);
    await fixture.whenStable();
    const count = () => fixture.nativeElement.querySelector('mat-hint.count')?.textContent?.trim();
    expect(count()).toBe('7 characters');
    expect((field() as HTMLInputElement).maxLength).toBe(-1);

    field().value = 'A longer name';
    field().dispatchEvent(new Event('input', { bubbles: true }));
    await fixture.whenStable();
    expect(count()).toBe('13 characters');

    fixture.componentInstance.control().setValue('Two');
    await fixture.whenStable();
    expect(count()).toBe('3 characters');

    const oldControl = fixture.componentInstance.control();
    fixture.componentInstance.control.set(new FormControl('New value', { nonNullable: true }));
    await fixture.whenStable();
    expect(count()).toBe('9 characters');
    oldControl.setValue('This must not appear');
    await fixture.whenStable();
    expect(count()).toBe('9 characters');
  });
});
