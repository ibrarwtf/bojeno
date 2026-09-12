/**
 * LinkedIn's numeric geoId for each place, as captured live from the URL bar
 * after typing the name into LinkedIn's own location autocomplete. There's
 * no API to derive these - they're LinkedIn-internal ids - so this is a
 * manually curated allowlist of the places actually used so far, not
 * something computed from the name.
 */
export const KNOWN_GEO_IDS: Record<string, string> = {
  hyderabad: '105556991',
  india: '102713980',
  dubai: '106204383',
  'abu dhabi': '103720977',
  riyadh: '101336206',
  'saudi arabia': '100459316',
  uae: '104305776'
}
