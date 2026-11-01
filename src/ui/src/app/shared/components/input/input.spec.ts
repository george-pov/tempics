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
  />`,
})
class InputHost {
  readonly control = signal(new FormControl('Initial', { nonNullable: true }));
  readonly label = signal('Template name');
  readonly multiline = signal(false);
  readonly hint = signal('Choose a clear name.');
  readonly error = signal('');
  readonly showCount = signal(false);
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

  it('associates its visible label and hint with the field', () => {
    const input = field() as HTMLInputElement;
    expect(fixture.nativeElement.querySelector(`label[for="${input.id}"]`)?.textContent).toContain(
      'Template name',
    );
    expect(input.getAttribute('aria-describedby')?.split(' ')).toContain(description()?.id);
    expect(description()?.textContent).toContain('Choose a clear name.');
  });

  it('keeps its text field and form control in sync', async () => {
    const input = field() as HTMLInputElement;
    expect(input.value).toBe('Initial');
    input.value = 'Typed name';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    expect(fixture.componentInstance.control().value).toBe('Typed name');

    fixture.componentInstance.control().setValue('Programmatic name');
    await fixture.whenStable();
    expect(input.value).toBe('Programmatic name');
  });

  it('edits multiline markup as plain text in both directions', async () => {
    fixture.componentInstance.multiline.set(true);
    await fixture.whenStable();
    const textarea = field() as HTMLTextAreaElement;
    expect(textarea.tagName).toBe('TEXTAREA');
    const markup = '<Grid><TextBlock Text="Hello" /></Grid>';
    textarea.value = markup;
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    expect(fixture.componentInstance.control().value).toBe(markup);
    expect(fixture.nativeElement.querySelector('grid, textblock')).toBeNull();

    fixture.componentInstance.control().setValue('<Canvas />');
    await fixture.whenStable();
    expect(textarea.value).toBe('<Canvas />');
  });

  it('rebinds when the caller replaces the control', async () => {
    const oldControl = fixture.componentInstance.control();
    const replacement = new FormControl('Replacement', { nonNullable: true });
    fixture.componentInstance.control.set(replacement);
    await fixture.whenStable();
    expect(field().value).toBe('Replacement');
    replacement.setValue('Enabled');
    await fixture.whenStable();
    expect(field().value).toBe('Enabled');
    oldControl.setValue('Obsolete');
    await fixture.whenStable();
    expect(field().value).toBe('Enabled');
  });

  it('follows the current control disabled state', async () => {
    const control = fixture.componentInstance.control();
    control.disable();
    await fixture.whenStable();
    expect(field().disabled).toBe(true);
    control.enable();
    await fixture.whenStable();
    expect(field().disabled).toBe(false);
  });

  it('shows a supplied error even for a valid control and associates it with the field', async () => {
    expect(fixture.componentInstance.control().valid).toBe(true);
    fixture.componentInstance.error.set('The name is already in use.');
    await fixture.whenStable();
    const alert = fixture.nativeElement.querySelector('[role="alert"]') as HTMLElement;
    expect(alert.textContent).toContain('The name is already in use.');
    expect(alert.textContent).not.toContain('Choose a clear name.');
    expect(field().getAttribute('aria-describedby')?.split(' ')).toContain(alert.id);
    expect(field().getAttribute('aria-invalid')).toBe('true');
  });

  it('restores the hint when an error clears', async () => {
    fixture.componentInstance.error.set('The name is already in use.');
    await fixture.whenStable();
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
