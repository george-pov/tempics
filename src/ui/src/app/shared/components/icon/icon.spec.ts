import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Icon, type IconName } from './icon';

@Component({
  imports: [Icon],
  template: `<app-icon [name]="name" />`,
})
class IconHost {
  name: IconName = 'add';
}

describe('Icon', () => {
  it.each(['add', 'check_circle', 'delete', 'edit', 'error', 'image'] as const)(
    'renders the local %s glyph',
    async (name) => {
      const fixture = TestBed.createComponent(IconHost);
      fixture.componentInstance.name = name;
      await fixture.whenStable();
      const icon = fixture.nativeElement.querySelector('mat-icon') as HTMLElement;
      expect(icon.textContent?.trim()).toBe(name);
    },
  );

  it('keeps the icon decorative and out of the tab order', async () => {
    const fixture = TestBed.createComponent(IconHost);
    await fixture.whenStable();
    const host = fixture.nativeElement.querySelector('app-icon') as HTMLElement;
    expect(host.getAttribute('aria-hidden')).toBe('true');
    expect(host.tabIndex).toBe(-1);
    expect(host.querySelector<HTMLElement>('mat-icon')?.tabIndex).toBe(-1);
  });
});
