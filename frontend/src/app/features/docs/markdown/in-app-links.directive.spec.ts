import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { InAppLinksDirective } from './in-app-links.directive';

@Component({
  imports: [InAppLinksDirective],
  template: `<div appInAppLinks [innerHTML]="html"></div>`,
})
class HostComponent {
  readonly html = `
    <a href="docs/api#errors">API errors</a>
    <a href="https://github.com/example" target="_blank">GitHub</a>
    <a href="content/docs/assets/brief.docx" download>Original</a>`;
}

describe('InAppLinksDirective', () => {
  let element: HTMLElement;
  let navigateByUrl: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    navigateByUrl = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    const fixture = TestBed.createComponent(HostComponent);
    element = fixture.nativeElement;
    await fixture.whenStable();
  });

  /** Clicks a link and reports whether the directive took over (prevented the browser default). */
  function clickIsHandledByDirective(linkText: string, init: MouseEventInit = {}): boolean {
    let handled = false;
    // Runs after the directive (the event bubbles up to the document). Stopping the default here
    // keeps jsdom from attempting a real page navigation it cannot perform.
    const recordAndStop = (event: Event) => {
      handled = event.defaultPrevented;
      event.preventDefault();
    };
    document.addEventListener('click', recordAndStop, { once: true });
    const link = Array.from(element.querySelectorAll('a')).find((a) => a.textContent === linkText);
    link?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, ...init }));
    return handled;
  }

  it('routes a click on an in-app link through the Angular Router instead of reloading', () => {
    expect(clickIsHandledByDirective('API errors')).toBe(true);
    expect(navigateByUrl).toHaveBeenCalledWith('/docs/api#errors');
  });

  it('leaves links that open a new tab or download a file to the browser', () => {
    expect(clickIsHandledByDirective('GitHub')).toBe(false);
    expect(clickIsHandledByDirective('Original')).toBe(false);
    expect(navigateByUrl).not.toHaveBeenCalled();
  });

  it('keeps Ctrl+click as "open in a new tab"', () => {
    expect(clickIsHandledByDirective('API errors', { ctrlKey: true })).toBe(false);
    expect(navigateByUrl).not.toHaveBeenCalled();
  });
});
