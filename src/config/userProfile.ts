// ── USER PROFILE ──────────────────────────────────────────────────────────────
// Fill this in before running the pipeline. All agents pull from here.
// This is the only file you need to edit to personalise Forge for yourself.

export const USER_PROFILE = {
  // Personal details — used in cover letters, form submissions, and classifier
  name: 'Your Name',
  email: 'you@example.com',
  phone: '+1 234 567 8900',
  location: 'Your City, Country',
  linkedin: 'https://linkedin.com/in/yourhandle',
  portfolio: 'https://yourportfolio.com',

  // One-line summary of your background for the classifier
  background: '10+ years experience in [your field]. [Key skills]. [Notable experience].',

  // Languages beyond English (shown to classifier for location/language fit)
  languages: [
    // { language: 'German', level: 'B2' },
  ] as Array<{ language: string; level: string }>,

  // Where you want to work (used by classifier for location scoring)
  locationPreferences: 'Your City (on-site/hybrid), Remote',

  // Community / notable memberships (optional — used in DevRel voice)
  community: '',

  // CV tracks — label, accent colour, and voice prompt for cover letters.
  // The classifier will assign one of these keys (ux | pm | devrel) to each job.
  // You can rename the labels and rewrite the voice to match your background.
  tracks: {
    ux: {
      label: 'UX Engineer',
      color: '#06b6d4',
      // Describe your UX voice: what you care about, your technical stack,
      // what makes your approach distinctive.
      voice: 'Describe your UX background and approach here. Reference real tools and methodologies you use.',
    },
    pm: {
      label: 'Product Manager',
      color: '#8b5cf6',
      voice: 'Describe your PM background here. Mention frameworks, methodologies, and the type of problems you solve.',
    },
    devrel: {
      label: 'Developer Relations',
      color: '#f97316',
      voice: 'Describe your DevRel background here. Reference communities, developer tools, and content you create.',
    },
  },
}
