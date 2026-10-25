import { ViewportScroller } from '@angular/common';
import { afterRenderEffect, Directive, ElementRef, inject, input } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';

/**
 * Gives the headings of rendered Markdown their anchor ids, then scrolls to the URL's #fragment
 * and moves focus to that heading.
 * The ids cannot travel inside the [innerHTML] string, because Angular's sanitizer removes id
 * attributes, so they are set through the DOM once Angular has rendered the HTML.
 * The router scrolls to a fragment when navigation ends, which is before the document has loaded;
 * the scroll here makes deep links such as /docs/api#errors land on their heading.
 */
@Directive({ selector: '[appHeadingAnchors]' })
export class HeadingAnchorsDirective {
  /** The id of every heading in document order (RenderedMarkdown.headingIds). */
  readonly ids = input.required<readonly string[]>({ alias: 'appHeadingAnchors' });

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly fragment = toSignal(inject(ActivatedRoute).fragment);
  private readonly viewportScroller = inject(ViewportScroller);

  constructor() {
    // Runs after rendering, when the [innerHTML] content exists, and again when an input changes.
    afterRenderEffect(() => {
      const headings =
        this.host.nativeElement.querySelectorAll<HTMLElement>('h1, h2, h3, h4, h5, h6');
      const ids = this.ids();
      ids.forEach((id, index) => headings.item(index)?.setAttribute('id', id));

      const fragment = this.fragment();
      if (fragment) {
        this.viewportScroller.scrollToAnchor(fragment);
        // Keyboard focus follows the scroll, so the next Tab continues from the heading instead of
        // from the link that was used. tabindex="-1" lets script focus the heading without adding
        // it to the Tab order.
        const target = ids.includes(fragment) ? headings.item(ids.indexOf(fragment)) : null;
        target?.setAttribute('tabindex', '-1');
        target?.focus({ preventScroll: true });
      }
    });
  }
}
