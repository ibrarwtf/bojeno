export const linkedinSelectors = {
  /**
   * Navigating here while logged out redirects away to a login URL. LinkedIn
   * ships hashed/obfuscated class names with no stable DOM id to check
   * instead (confirmed by inspecting a real logged-in page), so detection
   * is URL-based: if the path is still under /feed after settling, logged in.
   */
  loginCheckUrl: 'https://www.linkedin.com/feed/',
  loginCheckPath: '/feed',

  /**
   * Same hashed-class situation as the login check — the "Applied" tab
   * label (rendered as "Applied · 459") has no stable class or id, only
   * stable text (confirmed by inspecting the real logged-in page). Matched
   * by text via Playwright's hasText filter rather than a CSS selector.
   */
  appliedCountUrl: 'https://www.linkedin.com/jobs-tracker/?stage=applied',
  appliedTabLabelPattern: /^Applied/
}
