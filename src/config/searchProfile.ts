// User-owned search profile.
//
// Generalizes what today lives hardcoded in the classifier rubric
// (src/agents/classifier.ts) and Scout's keyword gate (src/agents/scout.ts)
// into editable, user-owned data — persisted in localStorage exactly like the
// API keys in ApiKeySettings.jsx.
//
// This module only defines the model, the default, and load/save helpers.
// Consuming the profile in Scout/Classifier is a separate issue; until then the
// pipeline behaves exactly as before.

import { USER_PROFILE } from './userProfile'

export interface SearchProfile {
  /** Free-text description of the roles the user wants. */
  intentText: string
  /** Job titles the user is aiming for. */
  preferredTitles: string[]
  /** Extra role keywords, unioned with Scout's built-in ROLE_KEYWORDS (wired later). */
  keywords: string[]
  /** Signals that should down-weight a role (e.g. "people management", "Head of"). */
  antiSignals: string[]
  /** Description of the kind of company the user targets. */
  targetCompanyProfile: string
  /** Acceptable locations / work arrangements. */
  locations: string[]
  /** Target seniority band, free-text (e.g. "mid–senior"). */
  seniorityBand: string
}

const STORAGE_KEY = 'search_profile'

function parseLocations(pref: string): string[] {
  return pref.split(',').map(s => s.trim()).filter(Boolean)
}

// Default profile — reproduces today's behavior so nothing changes until a user
// saves their own. Derived from userProfile.ts plus the existing classifier
// rubric intent (DevRel/build blend favored; core data-science and
// staff/principal roles down-weighted). `keywords` is intentionally empty so
// that, once consumed, `ROLE_KEYWORDS ∪ keywords` leaves Scout unchanged.
export const DEFAULT_SEARCH_PROFILE: SearchProfile = {
  intentText: '',
  preferredTitles: [
    'UX Engineer',
    'Product Designer',
    'Design Engineer',
    'Developer Advocate',
    'Developer Relations',
    'Solutions Engineer',
    'Forward Deployed Engineer',
    'AI Product Manager',
    'Product Manager',
  ],
  keywords: [],
  antiSignals: [
    'core data science',
    'ML research',
    'staff/principal seniority',
  ],
  targetCompanyProfile: 'AI-native / AI-forward product teams',
  locations: parseLocations(USER_PROFILE.locationPreferences),
  seniorityBand: 'mid–senior',
}

function asString(v: unknown, fallback: string): string {
  return typeof v === 'string' ? v : fallback
}

function asStringArray(v: unknown, fallback: string[]): string[] {
  if (!Array.isArray(v)) return fallback
  return v.filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
}

// Coerce a possibly-partial/corrupt parsed object into a valid SearchProfile,
// filling any missing or wrong-typed field from the default.
function normalize(p: Partial<SearchProfile> | null | undefined): SearchProfile {
  const src = p ?? {}
  return {
    intentText: asString(src.intentText, DEFAULT_SEARCH_PROFILE.intentText),
    preferredTitles: asStringArray(src.preferredTitles, DEFAULT_SEARCH_PROFILE.preferredTitles),
    keywords: asStringArray(src.keywords, DEFAULT_SEARCH_PROFILE.keywords),
    antiSignals: asStringArray(src.antiSignals, DEFAULT_SEARCH_PROFILE.antiSignals),
    targetCompanyProfile: asString(src.targetCompanyProfile, DEFAULT_SEARCH_PROFILE.targetCompanyProfile),
    locations: asStringArray(src.locations, DEFAULT_SEARCH_PROFILE.locations),
    seniorityBand: asString(src.seniorityBand, DEFAULT_SEARCH_PROFILE.seniorityBand),
  }
}

/** True if the user has saved a custom profile (vs. running on the default). */
export function hasSearchProfile(): boolean {
  try {
    return !!localStorage.getItem(STORAGE_KEY)
  } catch {
    return false
  }
}

/** Load the saved profile, or the default when none/corrupt. Never throws. */
export function loadSearchProfile(): SearchProfile {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULT_SEARCH_PROFILE }
    return normalize(JSON.parse(raw) as Partial<SearchProfile>)
  } catch {
    return { ...DEFAULT_SEARCH_PROFILE }
  }
}

/** Persist a profile (normalized first). */
export function saveSearchProfile(profile: SearchProfile): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalize(profile)))
  } catch {
    /* storage unavailable (private mode / quota) — silently no-op */
  }
}

/** Clear the saved profile so loadSearchProfile() returns the default again. */
export function resetSearchProfile(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* ignore */
  }
}
