import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Button } from './button';

@Component({
  imports: [Button],
  template: `<app-button [disabled]="disabled()" (click)="activate()"
    >Generate sample image</app-button
  >`,
})
class ButtonHost {
  readonly disabled = signal(false);
  readonly activate = vi.fn();
}

describe('Button', () => {
  it('projects its label and bubbles native clicks', async () => {
    const fixture = TestBed.createComponent(ButtonHost);
    await fixture.whenStable();
    const button = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
    expect(button.textContent?.trim()).toBe('Generate sample image');
    expect(button.type).toBe('button');
    button.click();
    expect(fixture.componentInstance.activate).toHaveBeenCalledOnce();

    fixture.componentInstance.disabled.set(true);
    await fixture.whenStable();
    expect(button.disabled).toBe(true);
    button.click();
    expect(fixture.componentInstance.activate).toHaveBeenCalledOnce();
  });

  it.each(['submit', 'reset'])('supports native %s behavior', async (type) => {
    const fixture = TestBed.createComponent(Button);
    fixture.componentRef.setInput('type', type);
    await fixture.whenStable();
    expect((fixture.nativeElement.querySelector('button') as HTMLButtonElement).type).toBe(type);
  });
});
