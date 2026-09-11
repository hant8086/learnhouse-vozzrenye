# Learner interface — September 2026 redesign

Implementation reference: `styles/learner.css`. This is the learner/auth design layer over the existing Tailwind, shadcn and Radix stack. No new UI runtime or image assets are required.

## Direction

A calm learning workspace with precise borders, spacious typography and a restrained cyan accent. Futurism comes from a cool palette, compact numeric progress and occasional grid geometry. It should support long reading sessions. Course covers, configured organization fonts, labels, content, section ordering and access states retain their original meaning.

| Role | Light | Dark |
| --- | --- | --- |
| Page | `#f5f7f8` | `#101419` |
| Surface | `#ffffff` | `#171d24` |
| Raised surface | `#edf1f3` | `#202932` |
| Text | `#17212a` | `#e8eef3` |
| Secondary text | `#566673` | `#a8b7c5` |
| Border | `#dce3e8` | `#303d49` |
| Accent | `#087f8c` | `#80d7df` |

Semantic shadcn HSL channels are global so dialogs and popovers rendered through portals share the theme. Legacy neutral utility aliases, typography and layout rules are scoped to `.vz-learner` / `.vz-auth`. Dashboard/editor layout and colored content blocks have not been redesigned. Check shared dialogs and the editor for theme regressions during server review.

## Component rules

- Containers: 1280px including desktop gutters of 40px; mobile gutters 20px. Card grids adapt to the number of courses, with a 600px cap on a solitary card.
- Course cards: 16:9 contained covers (no cropping of existing artwork), two-line titles, readable description and metadata. Dashboard thumbnails retain their previous ratio.
- Navigation: organization identity, theme and mobile disclosure remain available. Desktop navigation and expanded search start at 1024px. Escape closes the mobile menu and returns focus; route changes close it too.
- Course overview: balanced media/action columns, compact authors, linear progress, curriculum disclosure buttons with keyboard access and wrapping chapter names.
- Reader: prose width 70ch, 17px body text, 1.8 line height. Video, SCORM and embedded resources keep their available width. Focus mode follows the selected theme and reserves space for mobile controls and safe areas. Completion remains an explicit action, now a native button.
- Auth: visible primary action in both themes, scrollable forms for short viewports, 16px inputs and quieter panel framing. Preserve configured art and branding.
- Account/trail: shared surfaces, larger progress cards, active navigation state and legible mobile tab labels. Existing account, certificate, membership and enrollment flows remain intact.
- Controls: minimum 44px height for primary controls; explicit keyboard focus. Reduced motion is respected by the existing Motion primitives and the learner CSS.

Do not infer completion from navigation, bypass locked activities, hide required auth states, or rewrite persisted content as part of visual changes. Continue to use the existing access resolver and analytics calls.

## Verification boundary

TypeScript, strict scoped ESLint, the existing test suite, CSS parsing and palette contrast arithmetic can be checked without an application build. They do not establish visual correctness. Build and browser review must run on the project's server/CI path; no local production build is part of this change.

The locked TypeScript 6 compiler rejects the existing `baseUrl` option as a deprecation error. `ignoreDeprecations: "6.0"` permits the current aliases without disabling type checking. A future alias migration can remove this compatibility option.

## Server review matrix

Review both themes at 390px, 768px, 1024px and 1440px; also check 320px and keyboard zoom at 200%.

| Surface | Representative states and assertions |
| --- | --- |
| Home/catalog | Guest/member, no courses, one/two/many courses, long Russian names, custom tags, search/clear/filter, pending/error states |
| Course | Guest sign-in, member start/resume, unavailable access, locked chapter/lesson, progress dialog, share, compact authors; all curriculum headings operable by keyboard |
| Lesson | Dynamic prose, video, SCORM, embedded resource, assignment; normal/focus, previous/next, mark/unmark, final course screen; no overlap with fixed controls |
| Auth | Password/magic link/signup/reset, validation, pending, MFA and Google redirect entry; footer remains reachable on short viewports |
| Account/trail | Profile/security/purchases, long tab labels, no courses, progress, certificates and leave confirmation |
| Shared controls | Mobile menu, Escape/focus return, theme toggle, dialogs/popovers, dashboard/editor smoke check |

Use a test account for completion or account changes. Do not alter real learners' progress for visual verification. Current implementation is pending server visual review and user corrections.
