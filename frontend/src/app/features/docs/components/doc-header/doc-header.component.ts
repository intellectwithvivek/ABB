import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { APP_CONFIG } from '../../../../core/config/app-config';
import { contentUrl, repositoryUrlOf } from '../../doc-urls';
import { DocEntry } from '../../docs.catalog';

/** Title block of a document page, with links to its source on GitHub and to its original file. */
@Component({
  selector: 'app-doc-header',
  templateUrl: './doc-header.component.html',
  styleUrl: './doc-header.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DocHeaderComponent {
  readonly doc = input.required<DocEntry>();

  private readonly repositoryUrl = inject(APP_CONFIG).repositoryUrl;

  protected readonly sourceUrl = computed(() =>
    repositoryUrlOf(this.repositoryUrl, this.doc().sourcePath),
  );
  protected readonly originalUrl = computed(() => {
    const originalPath = this.doc().originalPath;
    return originalPath ? contentUrl(originalPath) : null;
  });
}
