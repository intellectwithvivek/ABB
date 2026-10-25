import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TocEntry } from '../../markdown/markdown-renderer';

/** Above this many headings the list shows only the h2 sections (see visibleEntries). */
export const MAX_TOC_ENTRIES_WITH_SUBSECTIONS = 24;

/** "On this page": links to the h2/h3 headings of the open document. */
@Component({
  selector: 'app-doc-toc',
  imports: [RouterLink],
  templateUrl: './doc-toc.component.html',
  styleUrl: './doc-toc.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DocTocComponent {
  readonly slug = input.required<string>();
  readonly entries = input.required<readonly TocEntry[]>();

  /**
   * A long document lists only its h2 sections, so the list does not become a second scrolling
   * page. A document without any h2 keeps its full list.
   */
  protected readonly visibleEntries = computed(() => {
    const entries = this.entries();
    if (entries.length <= MAX_TOC_ENTRIES_WITH_SUBSECTIONS) {
      return entries;
    }

    const sections = entries.filter((entry) => entry.level === 2);
    return sections.length > 0 ? sections : entries;
  });
}
