export const naukriSelectors = {
  /**
   * Navigating to the root URL redirects to /mnjuser/homepage when logged
   * in, or to a login page when not. The redirect is client-side and fires
   * on a delay, so this only works with a generous wait — not fighting
   * Naukri's own routing, just watching where it eventually lands.
   */
  rootUrl: 'https://www.naukri.com',
  loggedInPath: '/mnjuser/homepage'
}
