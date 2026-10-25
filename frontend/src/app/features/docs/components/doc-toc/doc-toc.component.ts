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
   * Long documents (e.g. Design decisions has ~70 headings) would turn the list into a second scrolling page,
   * so they list only their sections. A document without any h2 keeps its full list.
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
