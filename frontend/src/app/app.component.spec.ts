import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { AppComponent } from './app.component';
import { APP_CONFIG } from './core/config/app-config';
import { TEST_APP_CONFIG } from './testing/app-config.fixture';

@Component({ template: '<h1>Routed page</h1>' })
class RoutedPageStubComponent {}

/** The layout around every page; which page each URL shows is covered by app.routes.spec.ts. */
describe('AppComponent', () => {
  let fixture: ComponentFixture<AppComponent>;
  let page: HTMLElement;
  let router: Router;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: '', component: RoutedPageStubComponent },
          { path: 'other', component: RoutedPageStubComponent },
        ]),
        { provide: APP_CONFIG, useValue: TEST_APP_CONFIG },
      ],
    });
    fixture = TestBed.createComponent(AppComponent);
    page = fixture.nativeElement;
    router = TestBed.inject(Router);
    await router.navigateByUrl('/');
    await fixture.whenStable();
  });

  function main(): HTMLElement | null {
    return page.querySelector('main');
  }

  it('renders the routed page inside <main>, between the site header and footer', () => {
    const landmarks = Array.from(page.querySelectorAll('header, main, footer'), (element) =>
      element.tagName.toLowerCase(),
    );

    expect(landmarks).toEqual(['header', 'main', 'footer']);
    expect(main()?.querySelector('h1')?.textContent).toBe('Routed page');
  });

  it('offers a skip link as the first focusable element', () => {
    const firstLink = page.querySelector('a');

    expect(firstLink?.classList).toContain('skip-link');
    expect(firstLink?.textContent?.trim()).toBe('Skip to main content');
  });

  it('moves keyboard focus to <main> when the skip link is used, without navigating', () => {
    const click = new MouseEvent('click', { bubbles: true, cancelable: true });

    page.querySelector('a.skip-link')?.dispatchEvent(click);

    expect(click.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(main());
  });

  it('leaves focus alone on the first navigation, which is the page load', () => {
    expect(document.activeElement).not.toBe(main());
  });

  it('moves focus to <main> after an in-app navigation, so the next Tab starts on the new page', async () => {
    await router.navigateByUrl('/other');

    expect(document.activeElement).toBe(main());
  });

  it('does not move focus for a #fragment link, whose heading takes focus instead', async () => {
    await router.navigateByUrl('/other#details');

    expect(document.activeElement).not.toBe(main());
  });
});
