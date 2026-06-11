/**
 * Seeds cv_versions for a specific user account.
 * Logs in via email/password, then upserts the 3 CV tracks scoped to that user.
 *
 * Usage:
 *   IMPORT_EMAIL=you@example.com IMPORT_PASSWORD=yourpassword npx tsx scripts/importResume.ts
 *
 * Source files:
 *   /Users/a1/2026 Resume/2026CVversions/resume_ats_english.md
 *   /Users/a1/2026 Resume/2026Portfolio/EN_Athar_Resume v2026_ATS.md
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })
dotenv.config()

const email    = process.env.IMPORT_EMAIL
const password = process.env.IMPORT_PASSWORD

if (!email || !password) {
  console.error('❌  Set IMPORT_EMAIL and IMPORT_PASSWORD before running.')
  console.error('    IMPORT_EMAIL=you@example.com IMPORT_PASSWORD=secret npx tsx scripts/importResume.ts')
  process.exit(1)
}

const url = process.env.VITE_SUPABASE_URL
const key = process.env.VITE_SUPABASE_ANON_KEY

if (!url || !key) {
  console.error('❌  Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env.local')
  process.exit(1)
}

// ── Shared blocks ─────────────────────────────────────────────────────────────

const CONTACT = {
  name: 'Athar Hafiz',
  email: 'athar.hafiz@gmail.com',
  location: 'Berlin, Germany',
  linkedin: 'https://www.linkedin.com/in/atharhafiz',
  portfolio: 'https://atharux.com',
  phone: '+49 177 2763088',
}

const EDUCATION = [
  {
    degree: 'Bachelor of Fine Arts — Digital Media Art',
    institution: 'San Jose State University',
    location: 'San Jose, CA',
    year: '2005',
  },
  {
    degree: 'A.A. Liberal Arts',
    institution: 'De Anza College',
    location: 'Cupertino, CA',
    year: '1999',
  },
]

const LANGUAGES = [
  { language: 'English', level: 'Native' },
  { language: 'Urdu', level: 'Native' },
  { language: 'German', level: 'B2.2 (learning)' },
]

const CERTIFICATIONS = [
  { name: 'Zertifikat B1', issuer: 'g.a.s.t., Berlin', year: '2025' },
  { name: 'Deutsch B1.2', issuer: 'vhs Pankow, Berlin', year: '2025' },
  { name: 'UX/UI Design', issuer: 'General Assembly, San Francisco', year: '2016' },
  { name: 'Gamification Design', issuer: 'Octalysis Group, San Jose', year: '2017' },
  { name: 'Lean Six Sigma — Green Belt', issuer: 'Lean Wright, Inc., Poway CA', year: '2019' },
]

const PROJECTS = [
  {
    name: 'Forge — Job Tracker',
    url: 'https://job-tracker-a5x.pages.dev/',
    github: 'https://github.com/atharux/job-tracker',
    description:
      '9-agent autonomous job search pipeline: Scout discovers roles across 8+ live job boards, ' +
      'Classifier scores fit, agents tailor resume and cover letter per CV track, ' +
      'Review Gatekeeper enforces human approval before any submission fires. ' +
      '3 real users. Stack: React + TypeScript, Supabase, Groq, OpenRouter, Cloudflare Pages.',
  },
  {
    name: 'Venue Outreach DB',
    url: 'https://github.com/atharux/venue-outreach-db',
    description:
      'Agentic venue intelligence and outreach platform deployed as live POC for Hydrat3 ' +
      '(Berlin electrolyte brand). Scrapes 9 European city regions via OpenStreetMap and ' +
      'Foursquare, extracts booking contact emails from venue websites, and manages outreach ' +
      'status across discovered leads. Stack: React + TypeScript, Supabase, ScrapeGraphAI.',
  },
]

// Bullets use the XYZ formula: Accomplished [X] as measured by [Y] by doing [Z]
const EXPERIENCE = [
  {
    company: 'Forge — Job Tracker (Open Source)',
    role: 'AI Systems Architect & Full-Stack Developer',
    dates: '2024 – Present',
    bullets: [
      'Shipped a 9-agent autonomous job application pipeline — Scout, Classifier, CV Selector, Resume Tailor, Cover Letter Writer, Form Mapper, Screenshot Capturer, Review Gatekeeper, Status Tracker — actively used by 3 real users including the author',
      'Enforced human oversight of all AI-generated documents by implementing a hard review gate as the final pipeline step, blocking submission until a human approves each tailored resume and cover letter',
      'Scaled job discovery from 150 to 500+ candidates per scan by rewriting sequential page fetching to parallel Promise.allSettled across 20 job board API pages simultaneously',
      'Delivered production-grade agentic architecture on Cloudflare Pages with Supabase backend and multi-model routing via Groq and OpenRouter for cost-optimised inference',
    ],
  },
  {
    company: 'Venue Outreach DB — Hydrat3 POC (Client Project)',
    role: 'Agentic Scraping & Outreach Automation Developer',
    dates: '2025 – Present',
    bullets: [
      'Delivered live venue intelligence POC for Hydrat3 electrolyte brand targeting nightclub and festival buyers across Europe by building agentic scraping pipeline covering 9 city regions from OpenStreetMap and Foursquare',
      'Maximised cold outreach deliverability by architecting two-layer contact extraction — venue website URL from public listing data, booking email scraped directly from the venue\'s own site',
      'Prevented duplicate scraping on resume after interruption by designing idempotent multi-region state machine persisting rotation state across 9 regions in Supabase',
    ],
  },
  {
    company: 'AgentCon Berlin 2026',
    role: 'Organiser & Co-host',
    dates: '2026',
    bullets: [
      'Produced inaugural AgentCon Berlin at CODE University — Berlin\'s first conference dedicated to agentic AI systems — with speakers from Neo4j (Michael Hunger) and Microsoft (Lee Stott) and sponsors including Neo4j, Microsoft, Qdrant, and MemVerge',
      'Built full event from scratch: speaker programme, sponsorship outreach, venue, registration, and day-of AV — drawing 100+ attendees to a first-edition community event',
    ],
  },
  {
    company: 'Rising Tide Berlin',
    role: 'Co-founder & Technical Lead',
    dates: 'Dec 2023 – Present',
    bullets: [
      'Launched brand-aligned digital presence from zero by designing and building responsive website with full brand identity and component guidelines',
      'Accelerated partnership pipeline for sustainability fashion events by leading co-brand strategy and digital presence with Frank Peralta Clothing',
    ],
  },
  {
    company: 'NDA Client (Startup)',
    role: 'Fractional Director UX Design & React Developer',
    dates: 'May 2024',
    bullets: [
      'Delivered 30-page tokenized Figma design system in a single contract engagement by architecting Shadcn/ui component library, reducing design-to-dev handoff friction for a complex SaaS desktop application',
      'Shipped production-ready React components with custom glassmorphic UI patterns by directly translating the Figma system into code, achieving zero rework on hand-off',
    ],
  },
  {
    company: 'Chef Works, Inc.',
    role: 'Marketing Developer / Campaign Strategist',
    dates: 'Oct 2018 – Jan 2024',
    bullets: [
      'Grew email click rates from 9% to 45% (+400%) and generated $150K+ annual incremental sales by building targeted HTML/CSS email templates and optimised landing pages',
      'Increased shipping team productivity by 25% as measured by order-fulfilment throughput by designing and implementing a gamified dashboard UI',
      'Supported data-driven campaign decisions across 4 revenue streams by building Tableau visualisation dashboards tracking performance metrics in real time',
      'Enabled GDPR-compliant marketing automation by implementing customer data segmentation systems across the full email database',
      'Improved campaign targeting accuracy by developing customer journey maps and persona frameworks adopted across 4 revenue streams',
    ],
  },
  {
    company: 'Volt 480',
    role: 'UX/UI Designer & Prototyper',
    dates: 'Sept 2018',
    bullets: [
      'Secured next-phase investor funding by delivering a fully interactive tradeshow prototype in 2 weeks, demonstrating core product workflows end-to-end',
    ],
  },
  {
    company: 'Epik Token',
    role: 'Marketing Project Manager & Web Developer',
    dates: 'Nov 2017 – Oct 2018',
    bullets: [
      'Contributed to $2M investment raise as measured by signed term sheets by creating investor pitch materials and tradeshow assets for blockchain startup launch',
      'Established startup\'s digital presence from scratch by designing and building product website and whitepaper that served as primary investor reference materials',
    ],
  },
  {
    company: 'Vinder',
    role: 'Product Designer & UI Developer',
    dates: 'Sep 2017 – May 2018',
    bullets: [
      'Reduced design-to-development rework by leading Agile design sprints and implementing structured handoff workflows for Android and iOS',
      'Eliminated UI inconsistency across platforms by building a complete design system with reusable components for both iOS and Android',
    ],
  },
  {
    company: 'Virtual Fantasy League',
    role: 'Technical Project Manager / Designer',
    dates: 'Nov 2016 – Sept 2017',
    bullets: [
      'Delivered complete product on a 9-month timeline as measured by on-time launch by managing cross-functional teams and establishing design and development SOPs',
      'Reduced delivery ambiguity by creating detailed design specifications and providing technical direction to the distributed development team',
    ],
  },
  {
    company: 'Tandon Group',
    role: 'User Experience Architect & Web Developer',
    dates: 'Jan 2016 – Oct 2016',
    bullets: [
      'Secured 3 major B2B contracts as measured by signed agreements by redesigning and rebuilding the medical services website with conversion-optimised UX',
      'Generated $250,000 in direct sales as measured by signed deal value by designing and developing the RFID technology product website',
      'Improved retail conversion by rebuilding the jewellery site with enhanced UX/UI, integrated SEO, and email campaign automation',
    ],
  },
  {
    company: 'Apple',
    role: 'iOS App Review / UX Designer',
    dates: 'Sep 2010 – Jan 2016',
    bullets: [
      'Increased team efficiency by 25% as measured by task throughput by designing and building a gamified productivity app in collaboration with the development team',
      'Processed 100,000+ app submissions annually as measured by review volume by enforcing UX quality standards and managing the developer appeals workflow',
      'Improved review consistency across the team by authoring app review workflow policies and best practices documentation adopted org-wide',
    ],
  },
  {
    company: 'Apple',
    role: 'Store Manager',
    dates: 'Nov 2002 – Oct 2006',
    bullets: [
      'Ranked top 3 stores nationally for sales as measured by quarterly revenue rankings by managing 150+ employees across two retail locations',
      'Shaped Apple Retail\'s customer experience model by leading early in-store planogram layout design, testing, and customer flow optimisation',
    ],
  },
]

// ── Per-track definitions ─────────────────────────────────────────────────────

const CV_VERSIONS = [
  {
    track: 'ux',
    label: 'UX Engineer',
    accent_color: '#06b6d4',
    content: {
      contact: CONTACT,
      title: 'UX Engineer & AI Systems Builder',
      summary:
        'UX Engineer and AI systems builder with 10+ years bridging design and engineering. ' +
        'Builds production React applications with embedded agentic pipelines — ' +
        'from a 9-agent job search automation platform (3 real users, public repo) to ' +
        'an agentic venue scraping tool deployed for a live startup client. ' +
        'Designs human-in-the-loop interfaces where AI actions require user oversight. ' +
        'Based in Berlin, working in English and German (B2).',
      experience: EXPERIENCE,
      skills: [
        // Design
        'Figma', 'Design Systems', 'User Research', 'Prototyping', 'Wireframing',
        'Accessibility (WCAG)', 'Information Architecture', 'Human-in-the-Loop UX',
        'Gamification Design', 'Customer Journey Mapping', 'Agentic Interface Design',
        // Engineering
        'React', 'TypeScript', 'JavaScript ES6+', 'Vite', 'Tailwind CSS', 'Shadcn/ui',
        'Component Architecture', 'Supabase', 'HTML5 / CSS3', 'Responsive Web Design', 'Git',
        // AI tooling
        'Anthropic Claude API', 'Groq', 'OpenRouter', 'AI-Assisted Development',
      ],
      projects: PROJECTS,
      education: EDUCATION,
      languages: LANGUAGES,
      certifications: CERTIFICATIONS,
    },
  },
  {
    track: 'pm',
    label: 'Product Manager',
    accent_color: '#8b5cf6',
    content: {
      contact: CONTACT,
      title: 'AI Product Manager & UX Consultant',
      summary:
        'AI product manager and UX practitioner with 10+ years taking products from concept to deployment. ' +
        'Lean Six Sigma Green Belt. Shipped agentic AI products as both PM and hands-on engineer — ' +
        'a 9-agent job search pipeline with human-in-the-loop oversight (3 real users) and ' +
        'a venue intelligence automation platform deployed for a live startup client. ' +
        'Brings rare technical depth to product decisions. Based in Berlin.',
      experience: EXPERIENCE,
      skills: [
        // Product & strategy
        'AI Product Strategy', 'Human-in-the-Loop Systems', 'LLM Evaluation & Quality',
        'Lean Six Sigma Green Belt', 'Agile / Scrum', 'Cross-functional Team Leadership',
        'Roadmap Planning', 'Stakeholder Management', 'OKRs',
        // Data & analytics
        'Tableau', 'Data Visualisation', 'Analytics', 'A/B Testing',
        // UX & research
        'Customer Journey Mapping', 'Persona Development', 'Gamification',
        'User Research', 'Accessibility (WCAG)',
        // Tools
        'GDPR Compliance', 'Campaign Strategy', 'Jira', 'Trello', 'Asana',
      ],
      projects: PROJECTS,
      education: EDUCATION,
      languages: LANGUAGES,
      certifications: CERTIFICATIONS,
    },
  },
  {
    track: 'devrel',
    label: 'Developer Relations',
    accent_color: '#f97316',
    content: {
      contact: CONTACT,
      title: 'Developer Relations Engineer & Agentic AI Builder',
      summary:
        'Developer advocate and agentic AI builder. ' +
        'Ships production multi-agent systems: 9-agent job search pipeline (Forge, public repo, 3 real users) ' +
        'and agentic venue intelligence platform (deployed for Hydrat3 startup, public repo). ' +
        'Organiser and co-host of AgentCon Berlin 2026 (speakers: Neo4j, Microsoft; sponsors: Neo4j, Microsoft, Qdrant, MemVerge). ' +
        'Volunteer at Global AI Berlin (120+ members). ' +
        'Stack: React · TypeScript · Supabase · Groq · Anthropic · Langfuse · Cloudflare Pages. ' +
        'atharux.com',
      experience: EXPERIENCE,
      skills: [
        // Engineering
        'React', 'TypeScript', 'JavaScript ES6+', 'Vite', 'Tailwind CSS', 'Cloudflare Pages',
        'Supabase', 'HTML5 / CSS3', 'Git', 'Accessibility (WCAG)',
        // AI / agentic stack
        'Anthropic Claude API', 'Groq', 'OpenRouter', 'Langfuse', 'ScrapeGraphAI',
        'Agentic AI Pipelines', 'Multi-agent Orchestration', 'LLM Prompt Engineering',
        'Human-in-the-Loop Systems', 'MCP Servers', 'AI-Assisted Development',
        // DevRel
        'Technical Writing', 'Public Speaking', 'Developer Community Building',
        'API Documentation', 'Live Demos & Workshops',
      ],
      projects: PROJECTS,
      education: EDUCATION,
      languages: LANGUAGES,
      certifications: CERTIFICATIONS,
    },
  },
]

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const supabase = createClient(url!, key!)

  console.log(`🔐  Signing in as ${email}...`)
  const { data: { user }, error: authError } = await supabase.auth.signInWithPassword({
    email: email!,
    password: password!,
  })

  if (authError || !user) {
    console.error(`❌  Auth failed: ${authError?.message ?? 'unknown error'}`)
    process.exit(1)
  }

  console.log(`✓  Signed in — user id: ${user.id}`)
  console.log(`⬆   Upserting ${CV_VERSIONS.length} CV tracks...\n`)

  for (const cv of CV_VERSIONS) {
    const { error } = await supabase
      .from('cv_versions')
      .upsert(
        {
          user_id: user.id,
          track: cv.track,
          label: cv.label,
          accent_color: cv.accent_color,
          content: cv.content,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,track' }
      )

    if (error) {
      console.error(`❌  ${cv.track}: ${error.message}`)
    } else {
      console.log(`✓  ${cv.label} (${cv.track}) — ${cv.content.experience.length} roles, ${cv.content.skills.length} skills`)
    }
  }

  console.log('\n✅  Done. cv_versions is ready for the document pipeline.')
  await supabase.auth.signOut()
}

main()
