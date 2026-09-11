export const naukriSelectors = {
  /**
   * Navigating here while logged out eventually redirects to a login URL,
   * but the redirect is client-side and fires on a delay — the URL is not a
   * reliable signal to check immediately after navigation. The login form
   * itself (rendered at the redirect target) is: use its password field as
   * the "not logged in" indicator instead.
   */
  loginCheckUrl: 'https://www.naukri.com/mnjuser/homepage',
  notLoggedInIndicator: 'input[type="password"]',

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
