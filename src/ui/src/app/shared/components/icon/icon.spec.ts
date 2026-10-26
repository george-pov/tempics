import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Icon, type IconName } from './icon';

@Component({
  imports: [Icon],
  template: `<span><app-icon [name]="name" />Add item</span>`,
})
class IconHost {
  name: IconName = 'add';
}

describe('Icon', () => {
  it.each(['add', 'check_circle', 'error', 'image'] as const)(
    'renders the local %s glyph as decorative, non-focusable content',
    async (name) => {
      const fixture = TestBed.createComponent(IconHost);
      fixture.componentInstance.name = name;
      await fixture.whenStable();
      const host = fixture.nativeElement.querySelector('app-icon') as HTMLElement;
      const icon = host.querySelector('mat-icon') as HTMLElement;
      expect(host.getAttribute('aria-hidden')).toBe('true');
      expect(host.tabIndex).toBe(-1);
      expect(icon.tabIndex).toBe(-1);
      expect(icon.textContent?.trim()).toBe(name);
      expect(icon.getAttribute('fontSet')).toBe('material-symbols-outlined');
      expect(host.parentElement?.textContent).toContain('Add item');
    },
  );
});
