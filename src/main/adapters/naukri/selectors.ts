export const naukriSelectors = {
  /**
   * Navigating to the root URL redirects to /mnjuser/homepage when logged
   * in, or to a login page when not. The redirect is client-side and fires
   * on a delay, so this only works with a generous wait — not fighting
   * Naukri's own routing, just watching where it eventually lands.
   */
  rootUrl: 'https://www.naukri.com',
  loggedInPath: '/mnjuser/homepage',

  /**
   * Unlike LinkedIn, Naukri ships real semantic class names here (confirmed
   * by inspecting the real logged-in page): a .appStatusCnt container with
   * two .grayLTxtBold number spans in a fixed order — total applies, then
   * application updates (the same figure shown as "Recruiter Actions" on
   * the tab above it).
   */
  appliedCountUrl: 'https://www.naukri.com/myapply/historypage',
  appStatusContainer: '.appStatusCnt',
  appStatusNumber: '.grayLTxtBold'
}
