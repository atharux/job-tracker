// Version release notes shown in Settings → What's New.
//
// Single source of truth for the changelog. Add a new entry at the TOP
// (newest first) as real changes ship — keep entries factual (ideally derived
// from merged PRs), never invented.

export interface Release {
  version: string
  date: string // ISO date, e.g. '2026-07-13'
  changes: string[]
}

export const RELEASES: Release[] = [
  {
    version: '0.3.0',
    date: '2026-07-13',
    changes: [
      'Contextual assistant now grounds its answers in your real CV content, not just a static profile summary (#22)',
      'Reorganised the assistant behind a reusable data-adapter and engine layer so it can power other tools later (#21)',
    ],
  },
  {
    version: '0.2.0',
    date: '2026-07-13',
    changes: [
      'Added "Tune My Search" — a search profile (titles, keywords, anti-signals) that shapes which roles Scout finds and how the Classifier scores them (#14)',
    ],
  },
]
