import { SecurityContext } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { DomSanitizer } from '@angular/platform-browser';
import { TEST_APP_CONFIG } from '../../../testing/app-config.fixture';
import { DocEntry, findDocBySlug } from '../docs.catalog';
import { renderMarkdown } from './markdown-renderer';

const REPOSITORY_URL = TEST_APP_CONFIG.repositoryUrl;

function doc(slug: string): DocEntry {
  const entry = findDocBySlug(slug);
  if (!entry) {
    throw new Error(`No catalog entry '${slug}'`);
  }
  return entry;
}

/** Renders `markdown` as if it were the given document and returns its first link. */
function renderLink(markdown: string, slug: string): HTMLAnchorElement {
  const container = document.createElement('div');
  container.innerHTML = renderMarkdown(markdown, doc(slug), REPOSITORY_URL).html;
  const link = container.querySelector('a');
  if (!link) {
    throw new Error('The markdown rendered no link');
  }
  return link;
}

describe('renderMarkdown', () => {
  describe('headings', () => {
    it('collects a unique, GitHub-style id for every heading in document order', () => {
      const rendered = renderMarkdown(
        '# API contract\n## Errors\n### Computer mode\n## Errors\n#### Notes',
        doc('api'),
        REPOSITORY_URL,
      );

      expect(rendered.headingIds).toEqual([
        'api-contract',
        'errors',
        'computer-mode',
        'errors-1',
        'notes',
      ]);
    });

    it('keeps id attributes out of the HTML, which Angular would strip anyway', () => {
      const rendered = renderMarkdown('## Errors', doc('api'), REPOSITORY_URL);

      expect(rendered.html.trim()).toBe('<h2>Errors</h2>');
    });

    it('lists only h2 and h3 headings, as plain text, in the table of contents', () => {
      const rendered = renderMarkdown(
        '# Title\n## The `GameState` shape\n### Cell\n#### Too deep',
        doc('api'),
        REPOSITORY_URL,
      );

      expect(rendered.toc).toEqual([
        { id: 'the-gamestate-shape', text: 'The GameState shape', level: 2 },
        { id: 'cell', text: 'Cell', level: 3 },
      ]);
    });
  });

  describe('links', () => {
    it('opens a catalog document linked from the same folder inside the app', () => {
      const link = renderLink('[spec](SPEC_PROMPT.md)', 'ai-workflow');

      expect(link.getAttribute('href')).toBe('docs/spec-prompt');
      expect(link.hasAttribute('target')).toBe(false);
    });

    it('opens a catalog document linked from the README inside the app, keeping its anchor', () => {
      const link = renderLink('[errors](docs/API.md#errors)', 'readme');

      expect(link.getAttribute('href')).toBe('docs/api#errors');
    });

    it('resolves ../ links to catalog documents', () => {
      const link = renderLink('[readme](../README.md)', 'decisions');

      expect(link.getAttribute('href')).toBe('docs/readme');
    });

    it('turns an in-page #anchor into a link to the same document', () => {
      const link = renderLink('[see below](#computer-mode)', 'api');

      expect(link.getAttribute('href')).toBe('docs/api#computer-mode');
    });

    it('opens other repository files on GitHub in a new tab', () => {
      const link = renderLink(
        '[engine](../backend/TicTacToe.Core/Engine/GameEngine.cs#L10)',
        'decisions',
      );

      expect(link.getAttribute('href')).toBe(
        `${REPOSITORY_URL}/blob/main/backend/TicTacToe.Core/Engine/GameEngine.cs#L10`,
      );
      expect(link.target).toBe('_blank');
      expect(link.rel).toBe('noopener');
    });

    it("uses GitHub's folder view for a link ending in a slash", () => {
      const link = renderLink('[frontend](frontend/src/)', 'readme');

      expect(link.getAttribute('href')).toBe(`${REPOSITORY_URL}/tree/main/frontend/src`);
    });

    it('downloads the Word original from the copy published with the site', () => {
      const link = renderLink(
        '[original](assets/Round-2-Problem-Statement.docx)',
        'problem-statement',
      );

      expect(link.getAttribute('href')).toBe('content/docs/assets/Round-2-Problem-Statement.docx');
      expect(link.hasAttribute('download')).toBe(true);
      expect(link.hasAttribute('target')).toBe(false);
    });

    it('opens other websites in a new tab', () => {
      const link = renderLink('[Angular](https://angular.dev)', 'readme');

      expect(link.getAttribute('href')).toBe('https://angular.dev');
      expect(link.target).toBe('_blank');
      expect(link.rel).toBe('noopener');
    });

    it('tells screen readers that a link opens a new tab', () => {
      const link = renderLink('[Angular](https://angular.dev)', 'readme');

      expect(link.textContent).toBe('Angular(opens in a new tab)');
      expect(link.querySelector('.visually-hidden')?.textContent).toBe('(opens in a new tab)');
    });

    it('leaves other schemes such as mailto: as written', () => {
      const link = renderLink('[mail](mailto:someone@example.com)', 'readme');

      expect(link.getAttribute('href')).toBe('mailto:someone@example.com');
      expect(link.hasAttribute('target')).toBe(false);
    });

    it('keeps the link text and an escaped title', () => {
      const link = renderLink('[the **API**](docs/API.md "Say \\"hi\\"")', 'readme');

      expect(link.innerHTML).toBe('the <strong>API</strong>');
      expect(link.title).toBe('Say "hi"');
    });
  });

  describe('images', () => {
    it('loads images under docs/ from the copy published with the site', () => {
      const html = renderMarkdown('![board](assets/board.png)', doc('api'), REPOSITORY_URL).html;

      expect(html).toContain('src="content/docs/assets/board.png"');
      expect(html).toContain('alt="board"');
    });

    it('loads other repository images from GitHub', () => {
      const html = renderMarkdown(
        '![icon](frontend/public/icon.png)',
        doc('readme'),
        REPOSITORY_URL,
      ).html;

      expect(html).toContain(`src="${REPOSITORY_URL}/raw/main/frontend/public/icon.png"`);
    });
  });

  describe("content that Angular's sanitizer would strip", () => {
    it('draws task list check boxes as text marks with a spoken state', () => {
      const container = document.createElement('div');
      container.innerHTML = renderMarkdown(
        '- [x] Board\n- [ ] Docs',
        doc('contributing'),
        REPOSITORY_URL,
      ).html;

      const marks = Array.from(container.querySelectorAll('li > .task-check'), (mark) => [
        mark.textContent,
        mark.getAttribute('aria-label'),
      ]);
      expect(marks).toEqual([
        ['☑', 'Done'],
        ['☐', 'To do'],
      ]);
      expect(container.querySelector('input')).toBeNull();
    });

    it('drops HTML comments and keeps other raw HTML', () => {
      const html = renderMarkdown(
        '<!-- A note for editors -->\n\nLine one<br>line two',
        doc('traceability'),
        REPOSITORY_URL,
      ).html;

      expect(html).not.toContain('<!--');
      expect(html).toContain('Line one<br>line two');
    });

    it('produces HTML that the sanitizer passes through without stripping anything', () => {
      // In development builds Angular warns whenever sanitizing removed something.
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
      const html = renderMarkdown(
        '<!-- note -->\n\n- [x] Done\n- [ ] To do\n\n[Angular](https://angular.dev)',
        doc('contributing'),
        REPOSITORY_URL,
      ).html;

      TestBed.inject(DomSanitizer).sanitize(SecurityContext.HTML, html);

      expect(warn).not.toHaveBeenCalled();
      warn.mockRestore();
    });
  });
});
