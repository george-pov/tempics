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
  it('announces projected success text as a status', async () => {
    const fixture = TestBed.createComponent(AlertHost);
    await fixture.whenStable();
    const alert = fixture.nativeElement.querySelector('app-alert') as HTMLElement;
    expect(alert.getAttribute('role')).toBe('status');
    expect(alert.textContent).toContain('Saved.');
  });

  it('announces an error as an alert', async () => {
    const fixture = TestBed.createComponent(AlertHost);
    fixture.componentInstance.variant.set('error');
    fixture.componentInstance.message.set('Could not save.');
    await fixture.whenStable();
    const alert = fixture.nativeElement.querySelector('app-alert') as HTMLElement;
    expect(alert.getAttribute('role')).toBe('alert');
    expect(alert.textContent).toContain('Could not save.');
  });
});
