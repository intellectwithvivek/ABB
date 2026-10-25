import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { APP_CONFIG } from '../../config/app-config';

interface NavLink {
  label: string;
  path: string;
  /** Only Overview ('/') needs an exact match; otherwise it would look active on every page. */
  exact: boolean;
}

/** Brand plus the main navigation: in-app pages, then the API reference and source on GitHub. */
@Component({
  selector: 'app-site-header',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './site-header.component.html',
  styleUrl: './site-header.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SiteHeaderComponent {
  protected readonly config = inject(APP_CONFIG);

  protected readonly navLinks: readonly NavLink[] = [
    { label: 'Overview', path: '/', exact: true },
    { label: 'Play', path: '/play', exact: false },
    { label: 'Docs', path: '/docs', exact: false },
  ];
}
