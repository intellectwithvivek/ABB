/** A requirement of the brief and how this build meets it. */
export interface FeatureHighlight {
  title: string;
  description: string;
  /** Where the requirement is stated in the problem statement. */
  briefReference: string;
}

export interface TechStackGroup {
  area: string;
  items: readonly string[];
}

export const FEATURE_HIGHLIGHTS: readonly FeatureHighlight[] = [
  {
    title: 'Board and turns',
    description:
      'A 3×3 board where a played cell stays locked. X always starts and the turn passes after every valid move; an invalid move never changes it.',
    briefReference: 'Functional requirements 1–2',
  },
  {
    title: 'Win and draw detection',
    description:
      'Rows, columns and both diagonals are checked on the server after every move. The winning cells are highlighted and a finished game accepts no more moves.',
    briefReference: 'Functional requirements 3–4',
  },
  {
    title: 'Undo by mode, Option A',
    description:
      'Two Player undoes the last move; Vs Computer undoes your move and the reply together. Undo is disabled once a game is won or drawn.',
    briefReference: 'Must-have 2 · Clarification 2',
  },
  {
    title: 'Scoreboard counted exactly once',
    description:
      'X wins, O wins and draws are kept by the API. Each finished game is counted once, and Reset Game leaves the scores untouched.',
    briefReference: 'Must-have 3',
  },
  {
    title: 'Rule-based computer opponent',
    description:
      'Win if possible, otherwise block, then take the centre, a corner, any free cell. Deterministic, so every move is explainable and tested.',
    briefReference: 'Must-have 4',
  },
  {
    title: 'Backend as the single source of truth',
    description:
      'The UI sends actions and renders the state the API returns: turn, winner, winning cells and whether undo is allowed. No rule is duplicated in Angular.',
    briefReference: 'Clarification 1',
  },
];

export const TECH_STACK: readonly TechStackGroup[] = [
  {
    area: 'Frontend',
    items: ['Angular 21', 'TypeScript 5.9', 'Signals, zoneless', 'Standalone components', 'Vitest'],
  },
  {
    area: 'Backend',
    items: ['.NET 8', 'ASP.NET Core Web API', 'REST + JSON', 'Swagger / OpenAPI', 'xUnit'],
  },
  {
    area: 'Delivery',
    items: ['GitHub Actions CI', 'Docker', 'GitHub Pages', 'Render'],
  },
];

/** Documents a reviewer is most likely to want first, shown as quick links (catalog slugs). */
export const KEY_DOC_SLUGS: readonly string[] = [
  'problem-statement',
  'traceability',
  'api',
  'decisions',
  'ai-workflow',
];
