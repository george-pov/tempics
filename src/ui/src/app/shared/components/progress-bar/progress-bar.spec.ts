import { TestBed } from '@angular/core/testing';
import { ProgressBar } from './progress-bar';

describe('ProgressBar', () => {
  it('shows one visible announcement with the same accessible label', async () => {
    const fixture = TestBed.createComponent(ProgressBar);
    fixture.componentRef.setInput('label', 'Generating image...');
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    const bar = root.querySelector('[role="progressbar"]') as HTMLElement;
    expect(root.querySelectorAll('[role="status"]')).toHaveLength(1);
    expect(root.querySelector('[role="status"]')?.textContent).toBe('Generating image...');
    expect(bar.getAttribute('aria-label')).toBe('Generating image...');
  });

  it('is indeterminate', async () => {
    const fixture = TestBed.createComponent(ProgressBar);
    fixture.componentRef.setInput('label', 'Generating image...');
    await fixture.whenStable();
    const bar = fixture.nativeElement.querySelector('[role="progressbar"]') as HTMLElement;
    expect(bar.getAttribute('aria-valuenow')).toBeNull();
  });
});
