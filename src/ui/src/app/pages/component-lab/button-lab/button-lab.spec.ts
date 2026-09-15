import { TestBed } from '@angular/core/testing';
import { ButtonLab } from './button-lab';

describe('ButtonLab', () => {
  it('reports activation while disabled examples leave the counter unchanged', async () => {
    const fixture = TestBed.createComponent(ButtonLab);
    await fixture.whenStable();
    const root: HTMLElement = fixture.nativeElement;
    const buttons = Array.from(root.querySelectorAll('button'));
    buttons.find((button) => button.textContent?.trim() === 'Click me')!.click();
    buttons.find((button) => button.textContent?.trim() === 'Disabled button')!.click();
    await fixture.whenStable();
    expect(root.querySelector('[role="status"]')?.textContent?.trim()).toBe('Clicks: 1');
  });

  it('keeps default buttons separate from submit and restores the form on reset', async () => {
    const fixture = TestBed.createComponent(ButtonLab);
    await fixture.whenStable();
    const root: HTMLElement = fixture.nativeElement;
    const form = root.querySelector('form')!;
    const input = form.querySelector('input')!;
    input.value = 'Edited';
    form.querySelector<HTMLButtonElement>('button[type="button"]')!.click();
    await fixture.whenStable();
    expect(root.textContent).toContain('No form action yet.');
    expect(root.textContent).toContain('Clicks: 1');
    form.querySelector<HTMLButtonElement>('button[type="submit"]')!.click();
    await fixture.whenStable();
    expect(root.textContent).toContain('Form submitted.');
    form.querySelector<HTMLButtonElement>('button[type="reset"]')!.click();
    await fixture.whenStable();
    expect(input.value).toBe('Sample');
    expect(root.textContent).toContain('Form reset.');
  });
});
