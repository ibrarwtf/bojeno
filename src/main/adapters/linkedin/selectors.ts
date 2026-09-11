export const linkedinSelectors = {
  /**
   * Navigating to the root URL redirects to /feed when logged in, or to a
   * login/landing page when not — no need to fight LinkedIn's own routing
   * by deep-linking to a gated page and inferring from an inverse redirect.
   */
  rootUrl: 'https://www.linkedin.com',
  loggedInPath: '/feed',

  /**
   * Same hashed-class situation as the login check — the "Applied" tab
   * label (rendered as "Applied · 459") has no stable class or id, only
   * stable text (confirmed by inspecting the real logged-in page). Matched
   * by text via Playwright's hasText filter rather than a CSS selector.
   */
  appliedCountUrl: 'https://www.linkedin.com/jobs-tracker/?stage=applied',
  appliedTabLabelPattern: /^Applied/
}
