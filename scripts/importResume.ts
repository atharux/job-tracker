/**
 * Seeds cv_versions for a specific user account.
 * Logs in via email/password, then upserts the 3 CV tracks scoped to that user.
 *
 * Usage:
 *   IMPORT_EMAIL=you@example.com IMPORT_PASSWORD=yourpassword npx tsx scripts/importResume.ts
 *
 * Source files this data was derived from:
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
    name: 'NeuroFlow Learning Platform',
    url: 'https://atharux.com/cases/Neuro',
    description:
      'React-based learning platform with drag-and-drop kanban, XP progression, 82 coding exercises with Monaco editor, 3D isometric skills graph via ReactFlow, and AI-recommended learning paths across 7 programming courses.',
  },
  {
    name: 'Job Tracker — Forge',
    url: 'https://job-tracker-a5x.pages.dev/',
    description:
      'AI-powered job application automation platform: autonomous scout agents, LLM-tailored CVs per track, cover letter generation, human-in-the-loop review queue. Stack: React, Supabase, Groq, OpenRouter.',
  },
]

// Bullets follow the XYZ formula: Accomplished [X] as measured by [Y] by doing [Z]
const EXPERIENCE = [
  {
    company: 'Rising Tide Berlin',
    role: 'Co-founder & Technical Lead',
    dates: 'Dec 2023 – Present',
    bullets: [
      'Launched brand-aligned digital presence from zero by building responsive React website with full design system and component library, tracked through consistent brand engagement across all digital touchpoints',
      'Accelerated partnership pipeline for sustainability fashion events by leading co-brand strategy and digital presence with Frank Peralta Clothing',
    ],
  },
  {
    company: 'NDA Client (Startup)',
    role: 'Fractional Director UX Design & React Developer',
    dates: 'May 2024',
    bullets: [
      'Delivered 30-page tokenized Figma design system in a single contract engagement by architecting Shadcn/ui component library, reducing design-to-dev handoff friction for complex SaaS desktop application',
      'Shipped production-ready React components with custom glassmorphic UI patterns by directly translating Figma system into code, achieving zero rework on hand-off',
    ],
  },
  {
    company: 'NeuroFlow Learning Platform',
    role: 'Full-Stack Developer & UX Designer (Personal Project)',
    dates: '2026',
    bullets: [
      'Built full learning platform covering 7 programming courses and 82 coding exercises by implementing drag-and-drop kanban, XP progression, and Monaco editor in React',
      'Visualised AI-recommended learning paths across the full curriculum by implementing 3D isometric skills graph with depth-based progress tracking using ReactFlow',
      'Achieved WCAG accessibility compliance by designing glassmorphism UI with dark/light themes, command palette (⌘K), and screen-reader support',
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
      'Improved campaign targeting accuracy across 4 revenue streams by developing customer journey maps and persona frameworks used by the marketing team',
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
      'Eliminated UI inconsistency across platforms by building a complete design system with reusable React Native components for both iOS and Android',
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
      'Improved retail conversion by rebuilding the jewelry site with enhanced UX/UI, integrated SEO, and email campaign automation',
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
      summary:
        'UX/UI Developer and React Application Architect with 10+ years bridging design and engineering. ' +
        'Specialises in translating design systems into production-ready React applications using AI-assisted ' +
        'development workflows. Based in Berlin — comfortable working in English and German (B2).',
      experience: EXPERIENCE,
      skills: [
        'Figma', 'Design Systems', 'User Research', 'Prototyping', 'Wireframing',
        'Accessibility (WCAG)', 'Information Architecture', 'UI/UX Best Practices',
        'React', 'Tailwind CSS', 'Shadcn/ui', 'Component Architecture',
        'HTML5 / CSS3 / JavaScript', 'Responsive Web Design', 'Git',
        'Gamification Design', 'Customer Journey Mapping',
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
      summary:
        'Product leader and UX practitioner with 10+ years driving digital products from concept to deployment. ' +
        'Lean Six Sigma Green Belt with a strong track record in cross-functional team leadership, ' +
        'data-driven campaign optimisation, and gamification strategy. Based in Berlin.',
      experience: EXPERIENCE,
      skills: [
        'Lean Six Sigma Green Belt', 'Agile / Scrum', 'Cross-functional Team Leadership',
        'Tableau', 'Data Visualization', 'Analytics', 'A/B Testing',
        'Customer Journey Mapping', 'Persona Development', 'Gamification',
        'GDPR Compliance', 'Campaign Strategy', 'Roadmap Planning',
        'Jira', 'Trello', 'Asana', 'Stakeholder Management',
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
      summary:
        'Technical UX Engineer and AI product builder with 10+ years across design, front-end engineering, ' +
        'and developer tooling. Builds production React apps integrated with LLM APIs (Claude, Groq, OpenRouter, n8n). ' +
        'Organiser of Global AI Berlin meetup. Portfolio: atharux.com',
      experience: EXPERIENCE,
      skills: [
        'React', 'TypeScript', 'JavaScript ES6+', 'Vite', 'Tailwind CSS',
        'Supabase', 'Anthropic / Claude API', 'Groq', 'OpenRouter', 'n8n',
        'AI-Assisted Development', 'Prompt Engineering', 'API Integration',
        'Git', 'Technical Writing', 'Developer Community Building',
        'HTML5 / CSS3', 'Accessibility (WCAG)', 'ReactFlow',
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
