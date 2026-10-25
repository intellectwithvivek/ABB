import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { catchError, EMPTY, map, Observable, of, startWith, switchMap } from 'rxjs';
import { APP_CONFIG } from '../../core/config/app-config';
import { DocHeaderComponent } from './components/doc-header/doc-header.component';
import { DocPagerComponent } from './components/doc-pager/doc-pager.component';
import { DocTocComponent } from './components/doc-toc/doc-toc.component';
import { DocsSidebarComponent } from './components/docs-sidebar/docs-sidebar.component';
import { DocsService } from './data-access/docs.service';
import { repositoryUrlOf } from './doc-urls';
import { DocEntry, findAdjacentDocs, findDocBySlug } from './docs.catalog';
import { HeadingAnchorsDirective } from './markdown/heading-anchors.directive';
import { InAppLinksDirective } from './markdown/in-app-links.directive';
import { renderMarkdown, RenderedMarkdown } from './markdown/markdown-renderer';

/** The body of a document page while its Markdown is fetched and rendered. */
type DocContent =
  | { status: 'loading' }
  | { status: 'ready'; rendered: RenderedMarkdown }
  /** The file is not published with this build (HTTP 404). */
  | { status: 'unavailable' }
  | { status: 'failed' };

const LOADING: DocContent = { status: 'loading' };

/** /docs/:slug — one project document: navigation, rendered Markdown and its table of contents. */
@Component({
  selector: 'app-doc-viewer-page',
  imports: [
    DocHeaderComponent,
    DocPagerComponent,
    DocTocComponent,
    DocsSidebarComponent,
    HeadingAnchorsDirective,
    InAppLinksDirective,
    RouterLink,
  ],
  templateUrl: './doc-viewer-page.component.html',
  styleUrl: './doc-viewer-page.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DocViewerPageComponent {
  /** The `:slug` route parameter, bound by withComponentInputBinding() in app.config.ts. */
  readonly slug = input.required<string>();

  private readonly docsService = inject(DocsService);
  private readonly repositoryUrl = inject(APP_CONFIG).repositoryUrl;

  protected readonly doc = computed(() => findDocBySlug(this.slug()));
  protected readonly adjacentDocs = computed(() => {
    const doc = this.doc();
    return doc ? findAdjacentDocs(doc) : {};
  });
  protected readonly sourceUrl = computed(() => {
    const doc = this.doc();
    return doc ? repositoryUrlOf(this.repositoryUrl, doc.sourcePath) : this.repositoryUrl;
  });

  // switchMap cancels the previous request when the reader opens another document before the
  // first one has arrived, so a slow response can never replace the newer page.
  protected readonly content = toSignal(
    toObservable(this.doc).pipe(switchMap((doc) => (doc ? this.load(doc) : EMPTY))),
    { initialValue: LOADING },
  );

  private load(doc: DocEntry): Observable<DocContent> {
    return this.docsService.getMarkdown(doc.sourcePath).pipe(
      map((markdown): DocContent => ({
        status: 'ready',
        rendered: renderMarkdown(markdown, doc, this.repositoryUrl),
      })),
      catchError((error: unknown) =>
        of<DocContent>({ status: isNotFound(error) ? 'unavailable' : 'failed' }),
      ),
      startWith(LOADING),
    );
  }
}

function isNotFound(error: unknown): boolean {
  return error instanceof HttpErrorResponse && error.status === 404;
}
