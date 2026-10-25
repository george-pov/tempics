import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { ImageGenerator } from './image-generator';
import { ImageRenderApi } from '../../shared/api/image-render/image-render-api';

describe('ImageGenerator', () => {
  let fixture: ComponentFixture<ImageGenerator>;
  let response: Subject<Blob>;
  let renderSample: ReturnType<typeof vi.fn>;
  let createUrl: ReturnType<typeof vi.fn>;
  let revokeUrl: ReturnType<typeof vi.fn>;
  const png = new Blob(['sample'], { type: 'image/png' });
  const errorFeedback = /could not generate.*try again/i;

  beforeEach(async () => {
    response = new Subject<Blob>();
    renderSample = vi.fn(() => response.asObservable());
    createUrl = vi.fn().mockReturnValueOnce('blob:first').mockReturnValueOnce('blob:second');
    revokeUrl = vi.fn();
    // jsdom does not implement object URLs. Restore its exact descriptors after each test.
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      writable: true,
      value: createUrl,
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      writable: true,
      value: revokeUrl,
    });
    TestBed.configureTestingModule({
      providers: [{ provide: ImageRenderApi, useValue: { renderSample } }],
    });
    fixture = TestBed.createComponent(ImageGenerator);
    await fixture.whenStable();
  });

  const originalCreate = Object.getOwnPropertyDescriptor(URL, 'createObjectURL');
  const originalRevoke = Object.getOwnPropertyDescriptor(URL, 'revokeObjectURL');

  afterEach(() => {
    fixture.destroy();
    if (originalCreate) Object.defineProperty(URL, 'createObjectURL', originalCreate);
    else Reflect.deleteProperty(URL, 'createObjectURL');
    if (originalRevoke) Object.defineProperty(URL, 'revokeObjectURL', originalRevoke);
    else Reflect.deleteProperty(URL, 'revokeObjectURL');
  });

  function button(): HTMLButtonElement {
    return fixture.nativeElement.querySelector('button');
  }

  function preview(): HTMLImageElement | null {
    return fixture.nativeElement.querySelector('img');
  }

  function progress(): HTMLElement | null {
    return fixture.nativeElement.querySelector('[role="progressbar"]');
  }

  function feedback(): HTMLElement | null {
    return fixture.nativeElement.querySelector('[role="status"], [role="alert"]');
  }

  async function succeed(): Promise<void> {
    button().click();
    response.next(png);
    response.complete();
    await fixture.whenStable();
  }

  it('waits for activation, prevents overlapping requests, and displays the returned image', async () => {
    expect(preview()).toBeNull();
    expect(renderSample).not.toHaveBeenCalled();
    button().click();
    // The signal guard also protects clicks before disabled state reaches the DOM.
    button().click();
    await fixture.whenStable();
    expect(renderSample).toHaveBeenCalledOnce();
    expect(button().disabled).toBe(true);
    expect(progress()?.getAttribute('aria-label')).toContain('Generating');
    expect(fixture.nativeElement.querySelectorAll('[role="status"]')).toHaveLength(1);
    expect(feedback()?.textContent).toContain('Generating your sample image');
    response.next(png);
    response.complete();
    await fixture.whenStable();
    expect(button().disabled).toBe(false);
    expect(preview()?.getAttribute('src')).toBe('blob:first');
    expect(preview()?.alt.trim()).toBeTruthy();
    expect(progress()).toBeNull();
    expect(feedback()?.getAttribute('role')).toBe('status');
    expect(feedback()?.textContent).toMatch(/ready/i);
  });

  it('keeps the previous preview during refresh and releases it on replacement and destruction', async () => {
    await succeed();
    response = new Subject<Blob>();
    button().click();
    await fixture.whenStable();
    expect(preview()?.getAttribute('src')).toBe('blob:first');
    expect(revokeUrl).not.toHaveBeenCalled();
    response.next(png);
    response.complete();
    await fixture.whenStable();
    expect(preview()?.getAttribute('src')).toBe('blob:second');
    expect(revokeUrl).toHaveBeenCalledExactlyOnceWith('blob:first');
    fixture.destroy();
    expect(revokeUrl.mock.calls).toEqual([['blob:first'], ['blob:second']]);
  });

  it('shows safe failure feedback and allows a successful retry', async () => {
    button().click();
    response.error(new Error('private backend details'));
    await fixture.whenStable();
    expect(feedback()?.getAttribute('role')).toBe('alert');
    expect(feedback()?.textContent).toMatch(errorFeedback);
    expect(fixture.nativeElement.textContent).not.toContain('private backend details');
    expect(preview()).toBeNull();
    expect(button().disabled).toBe(false);
    response = new Subject<Blob>();
    button().click();
    await fixture.whenStable();
    expect(feedback()?.textContent).toContain('Generating your sample image');
    expect(progress()).not.toBeNull();
    response.next(png);
    response.complete();
    await fixture.whenStable();
    expect(preview()).not.toBeNull();
    expect(feedback()?.getAttribute('role')).toBe('status');
  });

  it('keeps an earlier preview when refresh fails', async () => {
    await succeed();
    response = new Subject<Blob>();
    button().click();
    response.error(new Error('offline'));
    await fixture.whenStable();
    expect(feedback()?.getAttribute('role')).toBe('alert');
    expect(feedback()?.textContent).toMatch(errorFeedback);
    expect(preview()?.getAttribute('src')).toBe('blob:first');
    expect(revokeUrl).not.toHaveBeenCalled();
  });

  it.each([
    new Blob(['{}'], { type: 'application/problem+json' }),
    new Blob([], { type: 'image/png' }),
  ])('rejects an invalid response without allocating an object URL', async (blob) => {
    button().click();
    response.next(blob);
    response.complete();
    await fixture.whenStable();
    expect(feedback()?.getAttribute('role')).toBe('alert');
    expect(feedback()?.textContent).toMatch(errorFeedback);
    expect(button().disabled).toBe(false);
    expect(createUrl).not.toHaveBeenCalled();
  });

  it('cancels pending work on destruction without allocating a late preview', () => {
    button().click();
    expect(response.observed).toBe(true);
    fixture.destroy();
    expect(response.observed).toBe(false);
    response.next(png);
    expect(createUrl).not.toHaveBeenCalled();
  });
});
