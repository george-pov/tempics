import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { ButtonLink, type ButtonLinkTarget } from './button-link';
import { type IconName } from '../icon/icon';

@Component({ template: '' })
class DemoPage {}

@Component({
  imports: [ButtonLink],
  template: `<app-button-link [route]="route()" [icon]="icon()">
    Add template demo
  </app-button-link>`,
})
class ButtonLinkHost {
  readonly route = signal<ButtonLinkTarget>('/component-lab');
  readonly icon = signal<IconName | undefined>(undefined);
}

describe('ButtonLink', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter([{ path: 'component-lab', component: DemoPage }])],
    });
  });

  it('renders its projected label', async () => {
    const fixture = TestBed.createComponent(ButtonLinkHost);
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('a')?.textContent).toContain('Add template demo');
  });

  it('navigates to its route through an anchor', async () => {
    const fixture = TestBed.createComponent(ButtonLinkHost);
    await fixture.whenStable();
    const anchor = fixture.nativeElement.querySelector('a') as HTMLAnchorElement;
    expect(anchor.getAttribute('href')).toBe('/component-lab');
    anchor.click();
    await fixture.whenStable();
    expect(TestBed.inject(Router).url).toBe('/component-lab');
  });

  it('is keyboard focusable', async () => {
    const fixture = TestBed.createComponent(ButtonLinkHost);
    await fixture.whenStable();
    const anchor = fixture.nativeElement.querySelector('a') as HTMLAnchorElement;
    anchor.focus();
    expect(document.activeElement).toBe(anchor);
  });

  it('hides its optional icon from assistive technology', async () => {
    const fixture = TestBed.createComponent(ButtonLinkHost);
    fixture.componentInstance.icon.set('add');
    await fixture.whenStable();
    const anchor = fixture.nativeElement.querySelector('a') as HTMLAnchorElement;
    expect(anchor.querySelector('app-icon')?.getAttribute('aria-hidden')).toBe('true');
  });
});
