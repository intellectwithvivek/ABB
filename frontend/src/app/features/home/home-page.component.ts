import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { APP_CONFIG } from '../../core/config/app-config';
import { DOCS_CATALOG } from '../docs/docs.catalog';
import { ArchitectureDiagramComponent } from './components/architecture-diagram/architecture-diagram.component';
import { FEATURE_HIGHLIGHTS, KEY_DOC_SLUGS, TECH_STACK } from './home-page.content';

/** The landing page for reviewers: what was built, how to review it, and where everything is. */
@Component({
  selector: 'app-home-page',
  imports: [ArchitectureDiagramComponent, RouterLink],
  templateUrl: './home-page.component.html',
  styleUrl: './home-page.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomePageComponent {
  protected readonly config = inject(APP_CONFIG);
  protected readonly features = FEATURE_HIGHLIGHTS;
  protected readonly techStack = TECH_STACK;
  protected readonly keyDocs = DOCS_CATALOG.filter((doc) => KEY_DOC_SLUGS.includes(doc.slug));
}
