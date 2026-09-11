export const linkedinSelectors = {
  /**
   * Navigating here while logged out redirects away to a login URL. LinkedIn
   * ships hashed/obfuscated class names with no stable DOM id to check
   * instead (confirmed by inspecting a real logged-in page), so detection
   * is URL-based: if the path is still under /feed after settling, logged in.
   */
  loginCheckUrl: 'https://www.linkedin.com/feed/',
  loginCheckPath: '/feed'
}
