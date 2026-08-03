/**
 * Identifiers used across the legal pages.
 *
 * ⚠️ These four values are the only things on the legal pages that were not
 * derived from the code or the running deployment. They must be confirmed by
 * the operator before the pages are relied on — in particular before
 * submitting the app for Google OAuth verification, which checks that the
 * privacy policy names a real, reachable operator.
 */

/** Legal/trading name of the party operating the service. */
export const OPERATOR_NAME = 'Vozzrenye'

/** Monitored mailbox for privacy requests and legal notices. */
export const CONTACT_EMAIL = 'support@vozzrenye.pro'

/** Jurisdiction whose law governs the Terms. */
export const GOVERNING_LAW = ''

/** Last substantive revision, ISO date. Shown to users and used for change notices. */
export const LAST_UPDATED = '2026-08-03'

/** The domain the service runs on — must match the OAuth consent screen. */
export const SERVICE_DOMAIN = 'platform.vozzrenye.pro'
