// ── USER PROFILE ──────────────────────────────────────────────────────────────
// Fill this in before running the pipeline. All agents pull from here.
// This is the only file you need to edit to personalise Forge for yourself.

export const USER_PROFILE = {
  name: 'Athar Hafiz',
  email: 'athar.hafiz@gmail.com',
  phone: '+49 177 276 3088',
  location: 'Berlin, Germany',
  linkedin: 'https://linkedin.com/in/atharhafiz',
  portfolio: 'https://atharux.com',

  background: `12+ years shipping production systems across B2B SaaS, developer tooling, and agentic pipelines.
Built a 9-step agentic hiring pipeline with 4 LLM reasoning agents and human-in-the-loop oversight (3 active users).
Co-organised AgentCon Berlin 2026 (Neo4j + Microsoft partners). Two stints at Apple — iOS App Review (100K+ apps/year) and retail leadership.
Stack: React, TypeScript, Vite, Supabase, Cloudflare Pages, Anthropic API, Groq, Langfuse, Figma.
Lean Six Sigma. WCAG 2.2. B2–C1 German (in progress). Berlin-based.`,

  languages: [
    { language: 'German', level: 'B2–C1 (in progress)' },
  ] as Array<{ language: string; level: string }>,

  locationPreferences: 'Berlin (on-site/hybrid), Remote Europe, Dubai',

  community: 'Co-organiser AgentCon Berlin 2026 (Neo4j + Microsoft). Volunteer Global AI Berlin (120+ members).',

  tracks: {
    ux: {
      label: 'UX Engineer · AI Systems Builder',
      color: '#06b6d4',
      voice: `Designs AND ships — Figma to React to production. 12+ years including Apple App Store Review (100K+ apps/year) where he built internal tooling that lifted team throughput 25%. Delivered 30-page Figma design systems (Shadcn/ui tokens), gamified dashboards (+25% fulfillment productivity), email campaigns (9% → 45% open rates). Specialist in agentic UI patterns, WCAG 2.2 accessibility, and design systems that scale. React, TypeScript, Tailwind, Framer Motion. Opening hook: lead with a specific design or system challenge this company faces — not a generic enthusiasm statement.`,
    },
    pm: {
      label: 'Product Manager · AI Systems Builder',
      color: '#8b5cf6',
      voice: `Data-informed, not data-paralysed. 12+ years from Apple App Store policy to shipping agentic product pipelines. Supported a $2M seed raise (technical docs + web presence). Drove $150K+ annual sales growth via segmented automation. Shepherded a gaming platform from design to release in 9 months. Lean Six Sigma mindset. Tableau analytics, GDPR-compliant database segmentation, cross-functional agile leadership. Quantifies everything — mention specific outcomes. Opening hook: name the product problem space this role is solving.`,
    },
    devrel: {
      label: 'Developer Advocate · AI Systems Builder',
      color: '#f97316',
      voice: `Technically credible communicator who builds the demos that get developers unstuck. Shipped a 9-step agentic hiring pipeline in production (4 LLM agents, human-in-the-loop gate, 3 real users). Co-organised AgentCon Berlin 2026 — recruited speakers from Neo4j and Microsoft, secured 4 corporate partners. Active Global AI Berlin volunteer. Two stints at Apple including App Review (contributed to internal guideline discussions, built throughput tooling). Explains agent architectures, multi-agent pipelines, and operator control surfaces clearly. React, TypeScript, Supabase, Anthropic API, Langfuse, Cloudflare. Opening hook: lead with a concrete developer experience gap this company is solving.`,
    },
  },
}
