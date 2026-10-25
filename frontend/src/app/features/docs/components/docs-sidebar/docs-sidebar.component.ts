import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { DOC_SECTIONS } from '../../docs.catalog';

/** Every document grouped by category, with the open one highlighted. Collapsible on small screens. */
@Component({
  selector: 'app-docs-sidebar',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './docs-sidebar.component.html',
  styleUrl: './docs-sidebar.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DocsSidebarComponent {
  protected readonly sections = DOC_SECTIONS;
  /** Only used on small screens, where the list is folded away behind a toggle button. */
  protected readonly expanded = signal(false);

  protected toggle(): void {
    this.expanded.update((expanded) => !expanded);
  }
}
