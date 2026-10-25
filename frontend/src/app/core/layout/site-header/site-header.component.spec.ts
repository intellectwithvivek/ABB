import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { TEST_APP_CONFIG } from '../../../testing/app-config.fixture';
import { APP_CONFIG } from '../../config/app-config';
import { SiteHeaderComponent } from './site-header.component';

@Component({ template: '' })
class EmptyPageStubComponent {}

describe('SiteHeaderComponent', () => {
  let fixture: ComponentFixture<SiteHeaderComponent>;
  let element: HTMLElement;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: '', component: EmptyPageStubComponent },
          { path: 'play', component: EmptyPageStubComponent },
          { path: 'docs/:slug', component: EmptyPageStubComponent },
        ]),
        { provide: APP_CONFIG, useValue: TEST_APP_CONFIG },
      ],
    });
    fixture = TestBed.createComponent(SiteHeaderComponent);
    element = fixture.nativeElement;
    await fixture.whenStable();
  });

  function link(label: string): HTMLAnchorElement | undefined {
    return Array.from(element.querySelectorAll('a')).find((anchor) =>
      anchor.textContent?.trim().startsWith(label),
    );
  }

  async function navigateTo(url: string): Promise<void> {
    await TestBed.inject(Router).navigateByUrl(url);
    await fixture.whenStable();
  }

  it('links the brand to the overview page', () => {
    expect(link('Tic Tac Toe')?.getAttribute('href')).toBe('/');
  });

  it('links Overview, Play and Docs to their in-app routes', () => {
    expect(link('Overview')?.getAttribute('href')).toBe('/');
    expect(link('Play')?.getAttribute('href')).toBe('/play');
    expect(link('Docs')?.getAttribute('href')).toBe('/docs');
  });

  it('opens the API reference and the GitHub repository from the config in a new tab', () => {
    const api = link('API');
    const gitHub = link('GitHub');

    expect(api?.href).toBe(TEST_APP_CONFIG.swaggerUrl);
    expect(gitHub?.href).toBe(TEST_APP_CONFIG.repositoryUrl);
    for (const external of [api, gitHub]) {
      expect(external?.target).toBe('_blank');
      expect(external?.rel).toBe('noopener');
      expect(external?.textContent).toContain('(opens in a new tab)');
    }
  });

  it('marks only the link of the current page as active', async () => {
    await navigateTo('/play');

    expect(link('Play')?.getAttribute('aria-current')).toBe('page');
    expect(link('Play')?.classList).toContain('nav-link--active');
    expect(link('Overview')?.hasAttribute('aria-current')).toBe(false);
  });

  it('keeps Overview active only on the home page itself', async () => {
    await navigateTo('/');
    expect(link('Overview')?.getAttribute('aria-current')).toBe('page');

    await navigateTo('/docs/api');
    expect(link('Overview')?.hasAttribute('aria-current')).toBe(false);
    expect(link('Docs')?.getAttribute('aria-current')).toBe('page');
  });
});
