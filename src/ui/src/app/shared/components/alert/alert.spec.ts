import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Alert, AlertVariant } from './alert';

@Component({
  imports: [Alert],
  template: `<app-alert [variant]="variant()">{{ message() }}</app-alert>`,
})
class AlertHost {
  readonly variant = signal<AlertVariant>('success');
  readonly message = signal('Saved.');
}

describe('Alert', () => {
  it('announces success with text and a decorative icon', async () => {
    const fixture = TestBed.createComponent(AlertHost);
    await fixture.whenStable();
    const alert = fixture.nativeElement.querySelector('app-alert') as HTMLElement;
    expect(alert.getAttribute('role')).toBe('status');
    expect(alert.textContent).toContain('Saved.');
    expect(alert.querySelector('app-icon')?.textContent).toContain('check_circle');
    expect(alert.querySelector('app-icon')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('updates its meaning and icon when the variant and message change', async () => {
    const fixture = TestBed.createComponent(AlertHost);
    fixture.componentInstance.variant.set('error');
    fixture.componentInstance.message.set('Could not save.');
    await fixture.whenStable();
    const alert = fixture.nativeElement.querySelector('app-alert') as HTMLElement;
    expect(alert.getAttribute('role')).toBe('alert');
    expect(alert.textContent).toContain('Could not save.');
    expect(alert.querySelector('app-icon')?.textContent).toContain('error');
  });
});
