/**
 * "Meet the hiring team" block capture - present on many (not all) LinkedIn
 * postings, live-confirmed on the search-results pane
 * (.jobs-search__job-details--container, same container
 * captureActiveJobDetails already reads) as plain DOM:
 *
 *   Meet the hiring team
 *   Sangita Sanghvi
 *   · 3rd
 *   Co-Founder @ Zetheta Algorithms Private Limited
 *   Job poster
 *   Message
 *
 * Split the same way jobDetails.ts splits its parsers from the page-driving
 * code that feeds them: `findJobPosterBlockInPage` is a browser-context
 * function (passed straight to page.evaluate, so it must stay
 * self-contained - no closures over module scope) that only locates the
 * block and its profile link; `parseJobPosterBlock` is the pure,
 * unit-tested text parser that turns that block's innerText into
 * name/title. Must never throw when the block is absent.
 */

/**
 * Browser-context function - pass directly to `page.evaluate`. Finds the
 * "Meet the hiring team" heading within `scopeSelector` (or the whole
 * document when null) and climbs to the ancestor that also contains the
 * "Job poster" label, which scopes exactly that one person's card. Returns
 * null when the block is absent, which is the common case.
 */
export function findJobPosterBlockInPage(
  scopeSelector: string | null
): { blockText: string; profileUrl: string | null } | null {
  const root: ParentNode = scopeSelector
    ? (document.querySelector(scopeSelector) ?? document)
    : document
  const heading = Array.from(root.querySelectorAll<HTMLElement>('*')).find(
    (el) => el.children.length === 0 && el.textContent?.trim() === 'Meet the hiring team'
  )
  if (!heading) return null

  let container: HTMLElement | null = heading
  for (let i = 0; i < 8 && container; i++) {
    if (container.textContent?.includes('Job poster')) break
    container = container.parentElement
  }
  if (!container || !container.textContent?.includes('Job poster')) return null

  const link = container.querySelector<HTMLAnchorElement>('a[href*="/in/"]')
  return {
    blockText: container.innerText,
    profileUrl: link ? link.href.split('?')[0] : null
  }
}

/**
 * Pure parser over the block's innerText - name is the first line after the
 * heading that isn't a connection-degree marker ("· 3rd"), title is
 * whichever non-marker line comes after that, stopping at "Job poster".
 * Live-verified both fields are optional-looking-but-actually-present when
 * the block exists at all; absence of the whole block (not just a field) is
 * the common "no data" case, handled by the caller checking for null before
 * ever calling this.
 */
export function parseJobPosterBlock(text: string): { name: string | null; title: string | null } {
  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
  const headingIndex = lines.indexOf('Meet the hiring team')
  if (headingIndex === -1) return { name: null, title: null }

  let name: string | null = null
  let title: string | null = null
  for (let i = headingIndex + 1; i < lines.length; i++) {
    const line = lines[i]
    if (line === 'Job poster') break
    // Connection-degree marker - live-verified LinkedIn renders the bullet
    // before it inconsistently ("· 3rd" in one capture, "• 3rd" in another),
    // so match on the degree text itself (optionally bullet-prefixed) rather
    // than pinning to one bullet character.
    if (/^[·•]?\s*\d+(st|nd|rd|th)\+?$/i.test(line)) continue
    if (!name) {
      name = line
      continue
    }
    if (!title) {
      title = line
      continue
    }
    break
  }
  return { name, title }
}
