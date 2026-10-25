import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatButton } from '@angular/material/button';
import { By } from '@angular/platform-browser';
import { provideRouter, Router } from '@angular/router';
import { ButtonLink, type ButtonLinkTarget } from './button-link';
import { type ButtonAppearance } from '../button/button';
import { type IconName } from '../icon/icon';

@Component({ template: '' })
class DemoPage {}

@Component({
  imports: [ButtonLink],
  template: `<app-button-link [route]="route()" [appearance]="appearance()" [icon]="icon()">
    Add template demo
  </app-button-link>`,
})
class ButtonLinkHost {
  readonly route = signal<ButtonLinkTarget>('/component-lab');
  readonly appearance = signal<ButtonAppearance>('text');
  readonly icon = signal<IconName | undefined>(undefined);
}

describe('ButtonLink', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter([{ path: 'component-lab', component: DemoPage }])],
    });
  });

  it('renders a focusable anchor with an href and navigates on click', async () => {
    const fixture = TestBed.createComponent(ButtonLinkHost);
    await fixture.whenStable();
    const anchor = fixture.nativeElement.querySelector('a') as HTMLAnchorElement;
    expect(anchor.getAttribute('href')).toBe('/component-lab');
    expect(anchor.textContent).toContain('Add template demo');
    expect(anchor.tabIndex).toBe(0);
    anchor.focus();
    expect(document.activeElement).toBe(anchor);
    anchor.click();
    await fixture.whenStable();
    expect(TestBed.inject(Router).url).toBe('/component-lab');
  });

  it('supports default text and filled appearances with an optional decorative icon', async () => {
    const fixture = TestBed.createComponent(ButtonLinkHost);
    await fixture.whenStable();
    const anchor = fixture.nativeElement.querySelector('a') as HTMLAnchorElement;
    const materialButton = fixture.debugElement.query(By.css('a')).injector.get(MatButton);
    expect(materialButton.appearance).toBe('text');
    expect(anchor.querySelector('app-icon')).toBeNull();

    fixture.componentInstance.appearance.set('filled');
    fixture.componentInstance.icon.set('add');
    await fixture.whenStable();
    expect(materialButton.appearance).toBe('filled');
    expect(anchor.querySelector('app-icon')?.getAttribute('aria-hidden')).toBe('true');
    expect(anchor.textContent).toContain('Add template demo');
  });
});
