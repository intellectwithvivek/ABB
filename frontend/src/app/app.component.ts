import { ChangeDetectionStrategy, Component, ElementRef, inject, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter, skip } from 'rxjs';
import { SiteFooterComponent } from './core/layout/site-footer/site-footer.component';
import { SiteHeaderComponent } from './core/layout/site-header/site-header.component';

/** The shell around every page: header, the routed page in <main>, footer. */
@Component({
  selector: 'app-root',
  imports: [RouterOutlet, SiteFooterComponent, SiteHeaderComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent {
  private readonly mainContent = viewChild.required<ElementRef<HTMLElement>>('mainContent');

  constructor() {
    // A full page load starts keyboard and screen reader users at the top of the new page; an
    // in-app navigation does not, and the link they used may now be hidden (e.g. in the folded
    // docs menu). So focus moves to <main> after each navigation. Skipped: the first navigation,
    // which is the page load itself, and #fragment links, which focus their heading instead.
    const router = inject(Router);
    router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        skip(1),
        filter((event) => router.parseUrl(event.urlAfterRedirects).fragment === null),
        takeUntilDestroyed(),
      )
      .subscribe(() => this.mainContent().nativeElement.focus({ preventScroll: true }));
  }
}
