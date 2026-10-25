import { TestBed } from '@angular/core/testing';
import { ProgressBar } from './progress-bar';

describe('ProgressBar', () => {
  it('shows the same label visibly and accessibly for indeterminate work', async () => {
    const fixture = TestBed.createComponent(ProgressBar);
    fixture.componentRef.setInput('label', 'Generating image...');
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    const bar = root.querySelector('[role="progressbar"]') as HTMLElement;
    expect(root.querySelectorAll('[role="status"]')).toHaveLength(1);
    expect(root.querySelector('[role="status"]')?.textContent).toBe('Generating image...');
    expect(bar.getAttribute('aria-label')).toBe('Generating image...');
    expect(bar.getAttribute('aria-valuenow')).toBeNull();
  });
});
