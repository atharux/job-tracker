-- Run this in the Supabase SQL Editor (not as a migration).
-- Replace the email on line 12 with yours, then execute.

DO $$
DECLARE
  v_user_id UUID;
  v_contact  JSONB;
  v_education JSONB;
  v_projects  JSONB;
  v_experience JSONB;
BEGIN
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = 'athar.hafiz@gmail.com'
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User not found. Sign up in the app first.';
  END IF;

  -- ── Shared blocks ────────────────────────────────────────────────────────

  v_contact := '{
    "name": "Athar Hafiz",
    "email": "athar.hafiz@gmail.com",
    "location": "Berlin, Germany",
    "linkedin": "https://www.linkedin.com/in/atharhafiz",
    "portfolio": "https://atharux.com",
    "phone": "+49 177 2763088"
  }'::jsonb;

  v_education := '[
    {"degree": "Bachelor of Fine Arts — Digital Media Art", "institution": "San Jose State University", "location": "San Jose, CA", "year": "2005"},
    {"degree": "A.A. Liberal Arts", "institution": "De Anza College", "location": "Cupertino, CA", "year": "1999"}
  ]'::jsonb;

  v_projects := '[
    {
      "name": "NeuroFlow Learning Platform",
      "url": "https://atharux.com/cases/Neuro",
      "description": "React-based learning platform with drag-and-drop kanban, XP progression, 82 coding exercises with Monaco editor, 3D isometric skills graph via ReactFlow, and AI-recommended learning paths across 7 programming courses."
    },
    {
      "name": "Job Tracker — Forge",
      "url": "https://job-tracker-a5x.pages.dev/",
      "description": "AI-powered job application automation platform: autonomous scout agents, LLM-tailored CVs per track, cover letter generation, human-in-the-loop review queue. Stack: React, Supabase, Groq, OpenRouter."
    }
  ]'::jsonb;

  -- Bullets follow XYZ formula: Accomplished [X] as measured by [Y] by doing [Z]
  v_experience := '[
    {"company":"Rising Tide Berlin","role":"Co-founder & Technical Lead","dates":"Dec 2023 – Present","bullets":["Launched brand-aligned digital presence from zero by building responsive React website with full design system and component library, tracked through consistent brand engagement across all digital touchpoints","Accelerated partnership pipeline for sustainability fashion events by leading co-brand strategy and digital presence with Frank Peralta Clothing"]},
    {"company":"NDA Client (Startup)","role":"Fractional Director UX Design & React Developer","dates":"May 2024","bullets":["Delivered 30-page tokenized Figma design system in a single contract engagement by architecting Shadcn/ui component library, reducing design-to-dev handoff friction for complex SaaS desktop application","Shipped production-ready React components with custom glassmorphic UI patterns by directly translating Figma system into code, achieving zero rework on hand-off"]},
    {"company":"NeuroFlow Learning Platform","role":"Full-Stack Developer & UX Designer (Personal Project)","dates":"2026","bullets":["Built full learning platform covering 7 programming courses and 82 coding exercises by implementing drag-and-drop kanban, XP progression, and Monaco editor in React","Visualised AI-recommended learning paths across the full curriculum by implementing 3D isometric skills graph with depth-based progress tracking using ReactFlow","Achieved WCAG accessibility compliance by designing glassmorphism UI with dark/light themes, command palette (⌘K), and screen-reader support"]},
    {"company":"Chef Works, Inc.","role":"Marketing Developer / Campaign Strategist","dates":"Oct 2018 – Jan 2024","bullets":["Grew email click rates from 9% to 45% (+400%) and generated $150K+ annual incremental sales by building targeted HTML/CSS email templates and optimised landing pages","Increased shipping team productivity by 25% as measured by order-fulfilment throughput by designing and implementing a gamified dashboard UI","Supported data-driven campaign decisions across 4 revenue streams by building Tableau visualisation dashboards tracking performance metrics in real time","Enabled GDPR-compliant marketing automation by implementing customer data segmentation systems across the full email database","Improved campaign targeting accuracy across 4 revenue streams by developing customer journey maps and persona frameworks used by the marketing team"]},
    {"company":"Volt 480","role":"UX/UI Designer & Prototyper","dates":"Sept 2018","bullets":["Secured next-phase investor funding by delivering a fully interactive tradeshow prototype in 2 weeks, demonstrating core product workflows end-to-end"]},
    {"company":"Epik Token","role":"Marketing Project Manager & Web Developer","dates":"Nov 2017 – Oct 2018","bullets":["Contributed to $2M investment raise as measured by signed term sheets by creating investor pitch materials and tradeshow assets for blockchain startup launch","Established startup''s digital presence from scratch by designing and building product website and whitepaper that served as primary investor reference materials"]},
    {"company":"Vinder","role":"Product Designer & UI Developer","dates":"Sep 2017 – May 2018","bullets":["Reduced design-to-development rework by leading Agile design sprints and implementing structured handoff workflows for Android and iOS","Eliminated UI inconsistency across platforms by building a complete design system with reusable React Native components for both iOS and Android"]},
    {"company":"Virtual Fantasy League","role":"Technical Project Manager / Designer","dates":"Nov 2016 – Sept 2017","bullets":["Delivered complete product on a 9-month timeline as measured by on-time launch by managing cross-functional teams and establishing design and development SOPs","Reduced delivery ambiguity by creating detailed design specifications and providing technical direction to the distributed development team"]},
    {"company":"Tandon Group","role":"User Experience Architect & Web Developer","dates":"Jan 2016 – Oct 2016","bullets":["Secured 3 major B2B contracts as measured by signed agreements by redesigning and rebuilding the medical services website with conversion-optimised UX","Generated $250,000 in direct sales as measured by signed deal value by designing and developing the RFID technology product website","Improved retail conversion by rebuilding the jewelry site with enhanced UX/UI, integrated SEO, and email campaign automation"]},
    {"company":"Apple","role":"iOS App Review / UX Designer","dates":"Sep 2010 – Jan 2016","bullets":["Increased team efficiency by 25% as measured by task throughput by designing and building a gamified productivity app in collaboration with the development team","Processed 100,000+ app submissions annually as measured by review volume by enforcing UX quality standards and managing the developer appeals workflow","Improved review consistency across the team by authoring app review workflow policies and best practices documentation adopted org-wide"]},
    {"company":"Apple","role":"Store Manager","dates":"Nov 2002 – Oct 2006","bullets":["Ranked top 3 stores nationally for sales as measured by quarterly revenue rankings by managing 150+ employees across two retail locations","Shaped Apple Retail''s customer experience model by leading early in-store planogram layout design, testing, and customer flow optimisation"]}
  ]'::jsonb;

  -- ── UX Engineer ──────────────────────────────────────────────────────────

  INSERT INTO cv_versions (user_id, track, label, accent_color, content, updated_at)
  VALUES (
    v_user_id, 'ux', 'UX Engineer', '#06b6d4',
    jsonb_build_object(
      'contact',    v_contact,
      'summary',    'UX/UI Developer and React Application Architect with 10+ years bridging design and engineering. Specialises in translating design systems into production-ready React applications using AI-assisted development workflows. Based in Berlin — comfortable working in English and German (B2).',
      'experience', v_experience,
      'skills',     '["Figma","Design Systems","User Research","Prototyping","Wireframing","Accessibility (WCAG)","Information Architecture","UI/UX Best Practices","React","Tailwind CSS","Shadcn/ui","Component Architecture","HTML5 / CSS3 / JavaScript","Responsive Web Design","Git","Gamification Design","Customer Journey Mapping"]'::jsonb,
      'projects',   v_projects,
      'education',  v_education
    ),
    NOW()
  )
  ON CONFLICT (user_id, track) DO UPDATE SET
    label = EXCLUDED.label, accent_color = EXCLUDED.accent_color,
    content = EXCLUDED.content, updated_at = NOW();

  -- ── Product Manager ───────────────────────────────────────────────────────

  INSERT INTO cv_versions (user_id, track, label, accent_color, content, updated_at)
  VALUES (
    v_user_id, 'pm', 'Product Manager', '#8b5cf6',
    jsonb_build_object(
      'contact',    v_contact,
      'summary',    'Product leader and UX practitioner with 10+ years driving digital products from concept to deployment. Lean Six Sigma Green Belt with a strong track record in cross-functional team leadership, data-driven campaign optimisation, and gamification strategy. Based in Berlin.',
      'experience', v_experience,
      'skills',     '["Lean Six Sigma Green Belt","Agile / Scrum","Cross-functional Team Leadership","Tableau","Data Visualization","Analytics","A/B Testing","Customer Journey Mapping","Persona Development","Gamification","GDPR Compliance","Campaign Strategy","Roadmap Planning","Jira","Trello","Asana","Stakeholder Management"]'::jsonb,
      'projects',   v_projects,
      'education',  v_education
    ),
    NOW()
  )
  ON CONFLICT (user_id, track) DO UPDATE SET
    label = EXCLUDED.label, accent_color = EXCLUDED.accent_color,
    content = EXCLUDED.content, updated_at = NOW();

  -- ── Developer Relations ───────────────────────────────────────────────────

  INSERT INTO cv_versions (user_id, track, label, accent_color, content, updated_at)
  VALUES (
    v_user_id, 'devrel', 'Developer Relations', '#f97316',
    jsonb_build_object(
      'contact',    v_contact,
      'summary',    'Technical UX Engineer and AI product builder with 10+ years across design, front-end engineering, and developer tooling. Builds production React apps integrated with LLM APIs (Claude, Groq, OpenRouter, n8n). Organiser of Global AI Berlin meetup. Portfolio: atharux.com',
      'experience', v_experience,
      'skills',     '["React","TypeScript","JavaScript ES6+","Vite","Tailwind CSS","Supabase","Anthropic / Claude API","Groq","OpenRouter","n8n","AI-Assisted Development","Prompt Engineering","API Integration","Git","Technical Writing","Developer Community Building","HTML5 / CSS3","Accessibility (WCAG)","ReactFlow"]'::jsonb,
      'projects',   v_projects,
      'education',  v_education
    ),
    NOW()
  )
  ON CONFLICT (user_id, track) DO UPDATE SET
    label = EXCLUDED.label, accent_color = EXCLUDED.accent_color,
    content = EXCLUDED.content, updated_at = NOW();

  RAISE NOTICE 'Seeded 3 CV tracks for % (%)', 'athar.hafiz@gmail.com', v_user_id;
END $$;
