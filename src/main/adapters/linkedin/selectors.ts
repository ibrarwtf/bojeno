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
  appliedTabLabelPattern: /^Applied/,

  /**
   * Each applied-job row is an <a href="/jobs/view/<id>/"> containing
   * exactly 4 <p> tags in fixed order: title, "company · location
   * (workType)", "Applied Xh/Xd ago", a posted/status note. Confirmed by
   * inspecting the real logged-in page — no stable classes on any of them,
   * but the structural order holds. Pagination uses a real stable
   * data-testid (not a hashed class), unlike everything else on this page.
   */
  appliedJobRowLink: 'a[href*="/jobs/view/"]',
  paginationNextButton: '[data-testid="pagination-controls-next-button-visible"]'
}
