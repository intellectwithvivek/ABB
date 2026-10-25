import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { contentUrl } from '../doc-urls';

/** Loads the Markdown source of the project documents published with the site. */
@Injectable({ providedIn: 'root' })
export class DocsService {
  private readonly http = inject(HttpClient);

  getMarkdown(sourcePath: string): Observable<string> {
    const url = contentUrl(sourcePath);
    return this.http.get(url, { observe: 'response', responseType: 'text' }).pipe(
      map((response) => {
        // Hosts with a single-page-app fallback (Vercel, DigitalOcean) answer a missing file with
        // index.html and status 200; report it as the 404 it really is.
        if (response.headers.get('Content-Type')?.includes('text/html')) {
          throw new HttpErrorResponse({ status: 404, statusText: 'Not Found', url });
        }
        return response.body ?? '';
      }),
    );
  }
}
