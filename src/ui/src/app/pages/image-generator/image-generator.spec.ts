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

  it('starts without a preview', () => {
    expect(preview()).toBeNull();
  });

  it('starts only one request from repeated clicks while rendering', async () => {
    expect(renderSample).not.toHaveBeenCalled();
    button().click();
    // The signal guard also protects clicks before disabled state reaches the DOM.
    button().click();
    await fixture.whenStable();
    expect(renderSample).toHaveBeenCalledOnce();
    expect(button().disabled).toBe(true);
  });

  it('announces progress while rendering', async () => {
    button().click();
    await fixture.whenStable();
    expect(progress()?.getAttribute('aria-label')).toContain('Generating');
    expect(feedback()?.textContent).toContain('Generating your sample image');
  });

  it('displays a returned PNG as an accessible image', async () => {
    button().click();
    response.next(png);
    response.complete();
    await fixture.whenStable();
    expect(preview()?.getAttribute('src')).toBe('blob:first');
    expect(preview()?.alt.trim()).toBeTruthy();
  });

  it('announces readiness after rendering succeeds', async () => {
    await succeed();
    expect(feedback()?.getAttribute('role')).toBe('status');
    expect(feedback()?.textContent).toMatch(/ready/i);
  });

  it('keeps the previous preview during refresh and releases it on replacement', async () => {
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
  });

  it('releases the preview URL on destruction', async () => {
    await succeed();
    fixture.destroy();
    expect(revokeUrl).toHaveBeenCalledExactlyOnceWith('blob:first');
  });

  it('shows safe failure feedback', async () => {
    button().click();
    response.error(new Error('private backend details'));
    await fixture.whenStable();
    expect(feedback()?.getAttribute('role')).toBe('alert');
    expect(feedback()?.textContent).toMatch(errorFeedback);
    expect(fixture.nativeElement.textContent).not.toContain('private backend details');
  });

  it('allows a successful retry after failure', async () => {
    button().click();
    response.error(new Error('offline'));
    await fixture.whenStable();
    response = new Subject<Blob>();
    button().click();
    response.next(png);
    response.complete();
    await fixture.whenStable();
    expect(preview()).not.toBeNull();
  });

  it('keeps an earlier preview when refresh fails', async () => {
    await succeed();
    response = new Subject<Blob>();
    button().click();
    response.error(new Error('offline'));
    await fixture.whenStable();
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
    expect(feedback()?.textContent).toMatch(errorFeedback);
    expect(createUrl).not.toHaveBeenCalled();
  });

  it('ignores a late render response after destruction', () => {
    button().click();
    fixture.destroy();
    response.next(png);
    expect(createUrl).not.toHaveBeenCalled();
  });
});
