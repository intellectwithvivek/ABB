import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { APP_CONFIG } from '../../core/config/app-config';
import { TEST_APP_CONFIG } from '../../testing/app-config.fixture';
import { HomePageComponent } from './home-page.component';

describe('HomePageComponent', () => {
  let element: HTMLElement;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: APP_CONFIG, useValue: TEST_APP_CONFIG }],
    });
    const fixture = TestBed.createComponent(HomePageComponent);
    element = fixture.nativeElement;
    await fixture.whenStable();
  });

  function heroLink(label: string): HTMLAnchorElement | undefined {
    return Array.from(element.querySelectorAll<HTMLAnchorElement>('.hero-actions a')).find(
      (anchor) => anchor.textContent?.trim().startsWith(label),
    );
  }

  it('introduces the project with its one-line pitch', () => {
    expect(element.querySelector('h1')?.textContent).toBe('Tic Tac Toe');
    expect(element.textContent).toContain(
      'Angular 21 + .NET 8 · backend-owned game state · ABB Round 2 assessment',
    );
  });

  it('links the in-app calls to action to the game and the docs', () => {
    expect(heroLink('Play now')?.getAttribute('href')).toBe('/play');
    expect(heroLink('Read the docs')?.getAttribute('href')).toBe('/docs');
  });

  it('opens the API reference and the source from the config in a new tab', () => {
    const api = heroLink('API reference');
    const source = heroLink('Source on GitHub');

    expect(api?.href).toBe(TEST_APP_CONFIG.swaggerUrl);
    expect(source?.href).toBe(TEST_APP_CONFIG.repositoryUrl);
    for (const external of [api, source]) {
      expect(external?.target).toBe('_blank');
      expect(external?.rel).toBe('noopener');
    }
  });

  it('walks a reviewer through five steps', () => {
    expect(element.querySelectorAll('.steps > li')).toHaveLength(5);
  });

  it('maps each feature to the part of the brief it meets', () => {
    const features = element.querySelectorAll('.feature');

    expect(features).toHaveLength(6);
    expect(features[2].textContent).toContain('Undo by mode, Option A');
    expect(features[2].textContent).toContain('Clarification 2');
  });

  it('links the key documents', () => {
    const links = Array.from(element.querySelectorAll('.doc-links a'), (anchor) =>
      anchor.getAttribute('href'),
    );

    expect(links).toEqual([
      '/docs/problem-statement',
      '/docs/traceability',
      '/docs/api',
      '/docs/decisions',
      '/docs/ai-workflow',
    ]);
  });
});
