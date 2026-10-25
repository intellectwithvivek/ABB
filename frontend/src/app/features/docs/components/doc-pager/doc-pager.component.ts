import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DocEntry } from '../../docs.catalog';

/** Previous / next document links at the end of a page, in catalog order. */
@Component({
  selector: 'app-doc-pager',
  imports: [RouterLink],
  templateUrl: './doc-pager.component.html',
  styleUrl: './doc-pager.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DocPagerComponent {
  readonly previous = input<DocEntry>();
  readonly next = input<DocEntry>();
}
