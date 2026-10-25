/** Sidebar and hub sections, in display order. */
export const DOC_CATEGORIES = [
  'Start here',
  'Engineering',
  'Delivery',
  'AI-assisted development',
  'Panel preparation',
] as const;

export type DocCategory = (typeof DOC_CATEGORIES)[number];

/** One project document the portal can show. */
export interface DocEntry {
  /** URL segment: /docs/<slug>. */
  slug: string;
  title: string;
  description: string;
  category: DocCategory;
  /** Path from the repository root, e.g. 'docs/API.md'. The build publishes it under content/. */
  sourcePath: string;
  /** The original file a document was transcribed from, offered as a download. */
  originalPath?: string;
}

export interface DocSection {
  category: DocCategory;
  docs: readonly DocEntry[];
}

/** Every document, grouped by category in DOC_CATEGORIES order (previous/next follow this order). */
export const DOCS_CATALOG: readonly DocEntry[] = [
  {
    slug: 'readme',
    title: 'README',
    description:
      'Project overview, how to run the API and the UI locally, tests and known limitations.',
    category: 'Start here',
    sourcePath: 'README.md',
  },
  {
    slug: 'problem-statement',
    title: 'Problem statement',
    description:
      'The official Round 2 brief, transcribed to Markdown, with the original Word file.',
    category: 'Start here',
    sourcePath: 'docs/PROBLEM_STATEMENT.md',
    originalPath: 'docs/assets/Round-2-Problem-Statement.docx',
  },
  {
    slug: 'traceability',
    title: 'Requirements traceability',
    description: 'Every requirement of the brief mapped to the code and the tests that cover it.',
    category: 'Start here',
    sourcePath: 'docs/TRACEABILITY.md',
  },
  {
    slug: 'architecture',
    title: 'Architecture',
    description:
      'How the Angular SPA, the ASP.NET Core API and the TicTacToe.Core rules fit together.',
    category: 'Engineering',
    sourcePath: 'docs/ARCHITECTURE.md',
  },
  {
    slug: 'api',
    title: 'API reference',
    description: 'REST endpoints, the JSON contract, status codes and error responses.',
    category: 'Engineering',
    sourcePath: 'docs/API.md',
  },
  {
    slug: 'decisions',
    title: 'Design decisions',
    description: 'What was decided, why, and which alternatives were considered.',
    category: 'Engineering',
    sourcePath: 'docs/DECISIONS.md',
  },
  {
    slug: 'testing',
    title: 'Testing',
    description: 'What the backend and frontend test suites cover and how to run them.',
    category: 'Engineering',
    sourcePath: 'docs/TESTING.md',
  },
  {
    slug: 'deployment',
    title: 'Deployment',
    description: 'Docker, GitHub Pages, Render, Vercel and DigitalOcean: build, configure, ship.',
    category: 'Delivery',
    sourcePath: 'docs/DEPLOYMENT.md',
  },
  {
    slug: 'contributing',
    title: 'Contributing',
    description: 'Project structure, coding conventions and the checks every change must pass.',
    category: 'Delivery',
    sourcePath: 'docs/CONTRIBUTING.md',
  },
  {
    slug: 'ai-workflow',
    title: 'AI workflow',
    description: 'How AI tools were used to build the project and how their output was verified.',
    category: 'AI-assisted development',
    sourcePath: 'docs/AI_WORKFLOW.md',
  },
  {
    slug: 'spec-prompt',
    title: 'Specification prompt',
    description: 'The specification written for the AI assistant, recorded verbatim.',
    category: 'AI-assisted development',
    sourcePath: 'docs/SPEC_PROMPT.md',
  },
  {
    slug: 'panel-qa',
    title: 'Panel Q&A',
    description: 'Questions the panel is likely to ask, with short prepared answers.',
    category: 'Panel preparation',
    sourcePath: 'docs/PANEL_QA.md',
  },
];

export const DOC_SECTIONS: readonly DocSection[] = DOC_CATEGORIES.map((category) => ({
  category,
  docs: DOCS_CATALOG.filter((doc) => doc.category === category),
}));

export function findDocBySlug(slug: string): DocEntry | undefined {
  return DOCS_CATALOG.find((doc) => doc.slug === slug);
}

export function findDocBySourcePath(sourcePath: string): DocEntry | undefined {
  return DOCS_CATALOG.find((doc) => doc.sourcePath === sourcePath);
}

/** The documents before and after `doc` in reading order, for previous/next links. */
export function findAdjacentDocs(doc: DocEntry): { previous?: DocEntry; next?: DocEntry } {
  const index = DOCS_CATALOG.indexOf(doc);
  return { previous: DOCS_CATALOG[index - 1], next: DOCS_CATALOG[index + 1] };
}
