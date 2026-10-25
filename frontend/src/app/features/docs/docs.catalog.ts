/** Sidebar and hub sections, in display order. */
export const DOC_CATEGORIES = [
  'Start here',
  'Engineering',
  'Delivery',
  'AI-assisted development',
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

/** Every document, grouped in DOC_CATEGORIES order; previous/next links follow this order. */
export const DOCS_CATALOG: readonly DocEntry[] = [
  {
    slug: 'readme',
    title: 'README',
    description: 'Project overview, how to run and test it locally, and known limitations.',
    category: 'Start here',
    sourcePath: 'README.md',
  },
  {
    slug: 'problem-statement',
    title: 'Problem statement',
    description: 'The official Round 2 brief in Markdown, with the original Word file.',
    category: 'Start here',
    sourcePath: 'docs/PROBLEM_STATEMENT.md',
    originalPath: 'docs/assets/Round-2-Problem-Statement.docx',
  },
  {
    slug: 'traceability',
    title: 'Requirements traceability',
    description: 'Each requirement of the brief mapped to the code and tests that meet it.',
    category: 'Start here',
    sourcePath: 'docs/TRACEABILITY.md',
  },
  {
    slug: 'architecture',
    title: 'Architecture',
    description: 'How the Angular app, the ASP.NET Core API and the game rules fit together.',
    category: 'Engineering',
    sourcePath: 'docs/ARCHITECTURE.md',
  },
  {
    slug: 'api',
    title: 'API reference',
    description: 'REST endpoints, the JSON contract, status codes and errors.',
    category: 'Engineering',
    sourcePath: 'docs/API.md',
  },
  {
    slug: 'decisions',
    title: 'Design decisions',
    description: 'Key decisions, their rationale and the alternatives considered.',
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
    slug: 'panel-qa',
    title: 'Design Q&A',
    description: 'Common reviewer questions answered with references to the code.',
    category: 'Engineering',
    sourcePath: 'docs/PANEL_QA.md',
  },
  {
    slug: 'deployment',
    title: 'Deployment',
    description: 'The live setup on Vercel and Render, and how to configure and release it.',
    category: 'Delivery',
    sourcePath: 'docs/DEPLOYMENT.md',
  },
  {
    slug: 'contributing',
    title: 'Contributing',
    description: 'Branches, commits, coding conventions and the checks every change must pass.',
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
