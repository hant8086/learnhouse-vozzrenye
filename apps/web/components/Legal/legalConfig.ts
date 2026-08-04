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
export const CONTACT_EMAIL = 'hant8086@gmail.com'

/** Jurisdiction whose law governs the Terms. */
export const GOVERNING_LAW = ''

/** Last substantive revision, ISO date. Shown to users and used for change notices. */
export const LAST_UPDATED = '2026-08-03'

/** The domain the service runs on — must match the OAuth consent screen. */
export const SERVICE_DOMAIN = 'platform.vozzrenye.pro'

/**
 * Licence applied to learning material that is explicitly published as open.
 *
 * ⚠️ A substantive choice, not a derived fact — confirm before relying on it.
 *
 * CC BY-SA 4.0 was picked because it expresses the intent exactly and needs no
 * bespoke wording:
 *  - BY  — reuse must credit the source, which is the attribution requirement;
 *  - SA  — derivatives stay open, mirroring the AGPL copyleft on the software
 *          side, so the open contour cannot be quietly enclosed;
 *  - §2(b)(2) of the licence grants NO trademark rights, so the brand
 *          reservation below is native to the licence rather than bolted on.
 *
 * A licence is only granted where material is explicitly marked as open.
 * Everything else — paid courses, member-only material — is all rights
 * reserved. Silence is not a grant.
 */
export const OPEN_CONTENT_LICENSE = 'CC BY-SA 4.0'
export const OPEN_CONTENT_LICENSE_URL =
  'https://creativecommons.org/licenses/by-sa/4.0/'

/**
 * Names reserved as marks. Neither the AGPL (which §7(e) lets us decline to
 * grant trademark rights under) nor the content licence transfers these.
 *
 * The distinction that matters, and which the Terms spell out: naming the
 * project to credit it is required by attribution, so it is always permitted.
 * Adopting the names as your own identity is not.
 */
export const BRAND_NAMES = ['Воззрение', 'Vozzrenye', 'Технология Просветления']
