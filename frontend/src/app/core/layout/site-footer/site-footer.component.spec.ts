import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TEST_APP_CONFIG } from '../../../testing/app-config.fixture';
import { APP_CONFIG } from '../../config/app-config';
import { SiteFooterComponent } from './site-footer.component';

describe('SiteFooterComponent', () => {
  let element: HTMLElement;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: APP_CONFIG, useValue: TEST_APP_CONFIG }],
    });
    const fixture = TestBed.createComponent(SiteFooterComponent);
    element = fixture.nativeElement;
    await fixture.whenStable();
  });

  function link(label: string): HTMLAnchorElement | undefined {
    return Array.from(element.querySelectorAll('a')).find((anchor) =>
      anchor.textContent?.trim().startsWith(label),
    );
  }

  it('credits the author and the assessment', () => {
    expect(element.textContent).toContain('Built by Vivek Kumar Singh · ABB Round 2 assessment');
  });

  it('links to the problem statement, the docs and the repository', () => {
    expect(link('Problem statement')?.getAttribute('href')).toBe('/docs/problem-statement');
    expect(link('Docs')?.getAttribute('href')).toBe('/docs');
    expect(link('GitHub')?.href).toBe(TEST_APP_CONFIG.repositoryUrl);
    expect(link('GitHub')?.target).toBe('_blank');
  });
});
