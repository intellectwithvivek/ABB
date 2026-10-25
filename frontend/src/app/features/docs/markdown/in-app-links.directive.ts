import { Directive, DOCUMENT, inject } from '@angular/core';
import { Router } from '@angular/router';

/**
 * Makes plain <a href> links inside [innerHTML] content behave like routerLink: a click on a link
 * to a page of this app is handled by the Angular Router instead of reloading the whole site.
 * Angular does not compile HTML inserted with [innerHTML], so routerLink cannot be used there;
 * one click listener on the container handles all of its links (event delegation).
 */
@Directive({
  selector: '[appInAppLinks]',
  host: { '(click)': 'onClick($event)' },
})
export class InAppLinksDirective {
  private readonly router = inject(Router);
  private readonly document = inject(DOCUMENT);

  protected onClick(event: MouseEvent): void {
    const link = event.target instanceof Element ? event.target.closest('a') : null;
    if (!link || !isPlainClick(event) || link.target || link.hasAttribute('download')) {
      return;
    }
    // In-app links are relative to <base href> (e.g. https://host/ABB/); others are other sites.
    const appRootUrl = this.document.baseURI;
    if (!link.href.startsWith(appRootUrl)) {
      return;
    }
    event.preventDefault();
    void this.router.navigateByUrl('/' + link.href.slice(appRootUrl.length));
  }
}

/** Ctrl/Cmd/Shift/Alt-click and middle-click keep their browser meaning (new tab, new window…). */
function isPlainClick(event: MouseEvent): boolean {
  return event.button === 0 && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey;
}
