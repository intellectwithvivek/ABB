/**
 * Returns a function that turns heading text into a unique anchor id, using GitHub's rules
 * ("POST /api/games — create a game" → "post-apigames--create-a-game"; a repeated heading gets
 * "-1", "-2"…). Matching GitHub means a link written for GitHub, such as API.md#computer-mode, also
 * works in the portal. One slugger per document, because uniqueness is per page.
 */
export function createHeadingSlugger(): (headingText: string) => string {
  const timesUsed = new Map<string, number>();

  return (headingText) => {
    const slug = headingText
      .trim()
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s_-]/gu, '')
      .replace(/\s/g, '-');
    const count = timesUsed.get(slug) ?? 0;
    timesUsed.set(slug, count + 1);
    return count === 0 ? slug : `${slug}-${count}`;
  };
}
