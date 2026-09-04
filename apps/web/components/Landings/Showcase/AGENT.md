# Showcase landing — AI maintainer contract

## Role

You are the maintainer of the `showcase` landing section. You edit the typed
JSON object stored at `org.config.config.customization.landing.sections[]`.
The admin UI writes this same JSON; do not invent a parallel storage format.

## Files

- `landing_types.ts` (relative to `OrgEditLanding`) owns the TypeScript shape.
- `components/Landings/Showcase/model.ts` validates and normalizes persisted data.
- `components/Landings/Showcase/LandingShowcase.tsx` renders the public section.
- `OrgEditLanding.tsx` owns the guided editor and default section.
- `locales/en.json` and `locales/ru.json` own editor labels.

## Data contract

Use `normalizeShowcase()` before adding new public fields. Keep unknown legacy
data safe, trim user-entered strings, cap visible collections in the renderer,
and store course references as `courseIds: string[]`. Legacy `courses` arrays
with `{ course_uuid }` are accepted for compatibility.

Example:

```json
{
  "type": "showcase",
  "greetingEyebrow": "PLATFORM / WELCOME",
  "greetingHeading": "Learn the technology with intention",
  "greetingDescription": "One clear path from fundamentals to practice.",
  "stats": [{ "value": "12+", "label": "Courses" }],
  "features": [
    { "icon": "route", "title": "Clear path", "description": "Know the next step." }
  ],
  "steps": [
    { "number": "01", "title": "Assess", "description": "Start where you are." }
  ],
  "offer": {
    "eyebrow": "OFFER",
    "heading": "Start learning today",
    "description": "Structured courses with practical outcomes.",
    "highlights": ["Mentorship"],
    "ctaLabel": "Browse courses",
    "ctaHref": "/courses"
  },
  "courseIds": ["course_uuid_1"],
  "coursesTitle": "Selected courses",
  "coursesDescription": "A focused starting set."
}
```

## Rules

- Preserve existing fields unless explicitly asked to change them.
- Prefer editing config content over changing renderer code.
- Renderer code changes must support light/dark tokens and reduced motion.
- Do not add raw HTML or arbitrary color input to the public renderer.
- Update `model.ts`, types, editor defaults, and both locales together.
- Focused gate: `node --test tests/showcase-landing-model.test.mjs` from
  `apps/web`. In a complete dependency environment, also run TypeScript and
  changed-file ESLint review.

## Deployment boundary

Never deploy directly. Commit to `prod`; CI builds and pins the image. A human
updates production compose only after review.
