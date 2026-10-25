import { Component, input, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { MatButton } from '@angular/material/button';
import { Button, type ButtonAppearance } from './button';

@Component({
  imports: [Button],
  template: `<form (submit)="$event.preventDefault(); submit()">
    <app-button [disabled]="disabled()" (click)="activate()">Generate sample image</app-button>
  </form>`,
})
class ButtonHost {
  readonly disabled = signal(false);
  readonly activate = vi.fn();
  readonly submit = vi.fn();
}

@Component({
  imports: [Button],
  template: `<form (submit)="$event.preventDefault(); submit()" (reset)="reset()">
    <input value="Sample" />
    <app-button [type]="type()">Apply</app-button>
  </form>`,
})
class FormButtonHost {
  readonly type = input<'submit' | 'reset'>('submit');
  readonly submit = vi.fn();
  readonly reset = vi.fn();
}

@Component({
  imports: [Button],
  template: `<app-button [appearance]="appearance()">Apply</app-button>`,
})
class AppearanceButtonHost {
  readonly appearance = signal<ButtonAppearance>('filled');
}

describe('Button', () => {
  it('projects its label and bubbles native clicks', async () => {
    const fixture = TestBed.createComponent(ButtonHost);
    await fixture.whenStable();
    const button = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
    expect(button.textContent?.trim()).toBe('Generate sample image');
    expect(button.type).toBe('button');
    expect(fixture.debugElement.query(By.css('button')).injector.get(MatButton).appearance).toBe(
      'filled',
    );
    button.focus();
    expect(document.activeElement).toBe(button);
    button.click();
    expect(fixture.componentInstance.activate).toHaveBeenCalledOnce();
    expect(fixture.componentInstance.submit).not.toHaveBeenCalled();

    fixture.componentInstance.disabled.set(true);
    await fixture.whenStable();
    expect(button.disabled).toBe(true);
    button.click();
    expect(fixture.componentInstance.activate).toHaveBeenCalledOnce();
  });

  it.each(['filled', 'outlined', 'text'] as const)(
    'passes the %s appearance through the public Material input',
    async (appearance) => {
      const fixture = TestBed.createComponent(AppearanceButtonHost);
      fixture.componentInstance.appearance.set(appearance);
      await fixture.whenStable();
      const button = fixture.debugElement.query(By.css('button')).injector.get(MatButton);
      expect(button.appearance).toBe(appearance);
    },
  );

  it.each(['submit', 'reset'])('supports native %s behavior', async (type) => {
    const fixture = TestBed.createComponent(FormButtonHost);
    fixture.componentRef.setInput('type', type);
    await fixture.whenStable();
    const field = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    field.value = 'Edited';
    (fixture.nativeElement.querySelector('button') as HTMLButtonElement).click();
    expect(fixture.componentInstance.submit).toHaveBeenCalledTimes(type === 'submit' ? 1 : 0);
    expect(fixture.componentInstance.reset).toHaveBeenCalledTimes(type === 'reset' ? 1 : 0);
    expect(field.value).toBe(type === 'reset' ? 'Sample' : 'Edited');
  });
});
