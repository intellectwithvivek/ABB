import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DOC_SECTIONS } from './docs.catalog';

/** /docs — every project document as a card, grouped by category. */
@Component({
  selector: 'app-docs-hub-page',
  imports: [RouterLink],
  templateUrl: './docs-hub-page.component.html',
  styleUrl: './docs-hub-page.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DocsHubPageComponent {
  protected readonly sections = DOC_SECTIONS;
}
