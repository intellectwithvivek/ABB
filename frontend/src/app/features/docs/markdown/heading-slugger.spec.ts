import { createHeadingSlugger } from './heading-slugger';

describe('createHeadingSlugger', () => {
  it('builds the same anchors as GitHub', () => {
    const slugify = createHeadingSlugger();

    expect(slugify('Computer mode')).toBe('computer-mode');
    expect(slugify('POST /api/games — create a game')).toBe('post-apigames--create-a-game');
    expect(slugify('Clarification 1: Backend State Ownership')).toBe(
      'clarification-1-backend-state-ownership',
    );
    expect(slugify('Position (winningCells items)')).toBe('position-winningcells-items');
  });

  it('numbers repeated headings so every anchor on the page is unique', () => {
    const slugify = createHeadingSlugger();

    expect([slugify('Errors'), slugify('Errors'), slugify('Errors')]).toEqual([
      'errors',
      'errors-1',
      'errors-2',
    ]);
  });
});
