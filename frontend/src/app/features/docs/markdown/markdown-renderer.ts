import { Marked } from 'marked';
import { DocEntry } from '../docs.catalog';
import { ResolvedLink, resolveDocLink, resolveImageSource } from './doc-link-resolver';
import { createHeadingSlugger } from './heading-slugger';

/** Spoken after the text of a link that opens in a new tab, like the site header's links. */
const NEW_TAB_NOTE = '<span class="visually-hidden">(opens in a new tab)</span>';

/** One entry of a document's "On this page" list. */
export interface TocEntry {
  id: string;
  text: string;
  level: 2 | 3;
}

export interface RenderedMarkdown {
  html: string;
  /**
   * The anchor id of every heading, in document order. The HTML carries no id attributes because
   * Angular's [innerHTML] sanitizer would remove them; HeadingAnchorsDirective sets them instead.
   */
  headingIds: string[];
  /** The h2 and h3 headings, for the "On this page" list. */
  toc: TocEntry[];
}

/**
 * Converts one project document from Markdown to HTML with `marked`, collecting heading anchors and
 * rewriting links so they work inside the portal (see resolveDocLink). Pure, so it is easy to test.
 */
export function renderMarkdown(
  markdown: string,
  doc: DocEntry,
  repositoryUrl: string,
): RenderedMarkdown {
  const slugify = createHeadingSlugger();
  const headingIds: string[] = [];
  const toc: TocEntry[] = [];

  // A new Marked instance per call: the overrides close over this document's context, and the
  // shared global `marked` object stays unmodified.
  const marked = new Marked({
    renderer: {
      heading({ tokens, depth }) {
        const text = this.parser.parseInline(tokens, this.parser.textRenderer);
        const id = slugify(text);
        headingIds.push(id);
        if (depth === 2 || depth === 3) {
          toc.push({ id, text, level: depth });
        }
        return false; // false = let marked render the heading as usual
      },
      link({ href, title, tokens }) {
        const link = resolveDocLink(href, doc, repositoryUrl);
        // The ↗ that styles.css draws is silent, so screen readers get the cue as text.
        const newTabNote = link.kind === 'external' ? NEW_TAB_NOTE : '';
        const text = this.parser.parseInline(tokens);
        return `<a${linkAttributes(link)}${titleAttribute(title)}>${text}${newTabNote}</a>`;
      },
      image({ href, title, text }) {
        const src = resolveImageSource(href, doc, repositoryUrl);
        return `<img src="${escapeAttribute(src)}" alt="${escapeAttribute(text)}"${titleAttribute(title)}>`;
      },
      // A task list item ("- [x] Done") would get an <input type="checkbox">, which Angular's
      // sanitizer strips (with a console warning), so a text mark is drawn instead.
      checkbox({ checked }) {
        const [mark, label] = checked ? ['☑', 'Done'] : ['☐', 'To do'];
        return `<span class="task-check" role="img" aria-label="${label}">${mark}</span> `;
      },
      // Raw HTML in the Markdown is kept, except comments: they are notes for the file's editors,
      // and the sanitizer would strip them with a warning anyway.
      html({ text }) {
        return text.replace(/<!--[\s\S]*?-->/g, '');
      },
    },
  });

  return { html: marked.parse(markdown, { async: false }), headingIds, toc };
}

function linkAttributes(link: ResolvedLink): string {
  const href = ` href="${escapeAttribute(link.href)}"`;
  switch (link.kind) {
    case 'external':
      return `${href} target="_blank" rel="noopener"`;
    case 'download':
      return `${href} download`;
    default:
      return href;
  }
}

function titleAttribute(title: string | null | undefined): string {
  return title ? ` title="${escapeAttribute(title)}"` : '';
}

function escapeAttribute(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}
