# Hydra — Agentic Job Application Pipeline

Nine specialised agents carry a job search from raw listing to a reviewed, ready-to-submit application. Every listing is verified against a live ATS source, and **nothing is submitted without human approval** — that gate is enforced in code, not by convention.

Built with React, Vite, Supabase and a multi-provider model layer.

📐 **[Architecture walkthrough](https://job-tracker.pages.dev/architecture)** · 🔬 **[Live pipeline view](https://job-tracker.pages.dev/pipeline)**

---

## The pipeline

Each stage is a separate module under `src/agents/` with a narrow job and its own failure mode.

| # | Agent | Module | What it does |
|---|-------|--------|--------------|
| 1 | **Scout** | `scout.ts` | Scans ATS boards directly — Greenhouse, Ashby, Lever, SmartRecruiters, Recruitee — rather than aggregators. Companies are only registered after their board is probed and confirmed, so the registry can't fill with guessed slugs. |
| 2 | **Classifier** | `classifier.ts` | Scores each listing for fit and assigns a CV track. Injects the user's preferred titles, anti-signals and seniority into the prompt — but only when a custom profile exists, leaving default scoring untouched. |
| 3 | **CV Selector** | `cvSelector.ts` | Picks one of three maintained tracks: `ux`, `pm`, `devrel`. |
| 4 | **Resume Tailor** | `resumeTailor.ts` | Adapts the selected CV to the listing — emphasis and ordering, from real history. |
| 5 | **Cover Letter Writer** | `coverLetterWriter.ts` | Drafts against the job description *and* the tailored CV, so the two agree. |
| 6 | **Form Mapper** | `formMapper.ts` | Detects the ATS platform from the URL — deterministically, not via a model call — and maps fields accordingly. |
| 7 | **Screenshot Capturer** | `screenshotCapturer.ts` | Renders the filled application through a headless browser worker, so review sees the real form. Degrades and reports unavailable if no worker is deployed. |
| 8 | **Review Gatekeeper** | `reviewGatekeeper.ts` | ⛔ **Human required.** Enqueues at `pending_review` and waits for an explicit `approve()` or `reject()`. |
| 9 | **Status Tracker** | `statusTracker.ts` | Watches for employer replies and moves each application's status accordingly. |

**Supporting modules, not pipeline stages:** `submitter.ts` performs the actual submission and fires *only* after the Gatekeeper approves. `openRouterClient.ts` is the shared model client. `types.ts` holds the contracts between agents.

### Why the gate is the point

An agent pipeline that submits on your behalf is a liability the first time a model misreads a listing. One that prepares complete work and then waits is an assistant. Three properties hold the line:

- **Submission is unreachable without approval** — `submitter.ts` runs downstream of the gate, not in parallel with it.
- **Decisions are terminal** — once rejected, submitted or archived, a job cannot be re-queued by a later run.
- **Review sees the real artefact** — the screenshot stage renders the actual filled form.

### Failure behaviour

| Failure | Behaviour |
|---|---|
| Model provider unavailable | Falls through OpenRouter → Groq → Anthropic, whichever key is present. Free models are discovered live, since `:free` IDs are retired constantly. |
| Model returns malformed JSON | Parsed and validated *inside* the retry loop, so a truncated response advances to the next model. |
| Browser worker not deployed | Screenshot stage reports unavailable; review still happens without the visual. |
| Listing cannot be verified | Badged `UNVERIFIED` and excluded from automatic handling. |
| Reviewer rejects | Terminal — cannot re-enter the queue. |

---

## Also included

Beyond the pipeline, Hydra is a working tracker.

### 📊 Application tracking
- Full details (company, position, status, notes) with real-time Supabase sync
- Status flow: Applied → Interview → Offered → Rejected/Accepted
- Filter by status; export as CSV or PDF

### 📄 Resume management
- Multiple resume versions stored in the cloud
- Side-by-side editor for comparison
- Link resumes to specific applications
- Upload and parse existing resumes (PDF, DOCX, TXT)

### 🤖 AI resume assembly
- Free customization via Groq by default
- Paste any job description, get a tailored resume
- BYOK (bring your own key) for unlimited usage

### 🎮 Gamification
- 10 points per application, 25 per interview, 50 per offer
- Ranks, achievements, daily login streaks, leaderboard
- Celebration animations for milestones

### 🎓 Onboarding
- Interactive tutorial for first-time users, replayable from the help button
- Contextual tooltips throughout

---

## 🚀 Quick Start

### For users

1. Visit the live app — *(set your deployment URL here)*
2. Sign up with email and password
3. Start tracking applications immediately
4. Use AI Assembly with Groq (free, no API key needed)
5. Optional: add your own API keys in Settings for unlimited usage

### For developers

**Prerequisites:** Node.js 16+, npm or yarn, a Supabase account (free tier), a Cloudflare account (for the AI proxy worker).

1. Clone:
```bash
git clone https://github.com/atharux/job-tracker.git
cd job-tracker
```

2. Install:
```bash
npm install
```

3. Create `.env.local`:
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

4. Set up the Supabase database — run migrations in `supabase/migrations/`, see `supabase/SETUP_GUIDE.md`.

5. Set up the Cloudflare Worker for AI features — see `CLOUDFLARE_WORKER_SETUP.md`, add your Groq API key, deploy `cloudflare-worker/ai-proxy.js`.

6. Run:
```bash
npm run dev
```

> ⚠️ **Note on `VITE_` variables.** Anything prefixed `VITE_` is embedded in the client bundle and is readable by anyone who loads the app. Never put a value there that must stay secret.

---

## 🎯 Usage guide

### Application tracking
Add applications with company, position, status and notes. Filter by status, and export to CSV or PDF at any time.

### Resume management
Store multiple versions, compare them side by side, and attach a specific version to an application.

### AI resume assembly
Paste a job description and the assembler tailors your resume against it. Groq runs it free by default; add your own key for unlimited usage.

### Gamification
Earn points per application, interview and offer, plus daily login bonuses. View your rank and compete on the leaderboard.

---

## 🔐 Security & privacy

- **Supabase RLS** — row-level security ensures users only see their own data
- **API keys** — user keys are stored in browser storage, never sent to our server
- **Cloudflare Worker** — proxies AI requests so provider keys aren't exposed in the frontend
- **No tracking** — your data stays private

---

## 🛠️ Tech stack

- **Frontend**: React 18 + Vite
- **Database**: Supabase (PostgreSQL)
- **Models**: OpenRouter (free tier, live discovery) → Groq (`llama-3.3-70b-versatile`) → Anthropic (`claude-haiku-4-5`)
- **Headless browser**: Cloudflare Browser Worker
- **Styling**: Tailwind CSS + custom CSS
- **Icons**: Lucide React
- **Deployment**: Cloudflare Pages
- **AI proxy**: Cloudflare Workers
- **Optional**: Cognee knowledge graph, proxied server-side for CORS

---

## 📦 Deployment

### Cloudflare Pages

1. Push code to GitHub
2. Go to [dash.cloudflare.com](https://dash.cloudflare.com)
3. Pages → Create Application → Connect to Git
4. Select your repository
5. Build settings — Framework: Vite · Build command: `npm run build` · Output: `dist`
6. Add environment variables: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
7. Deploy

### Cloudflare Worker (AI proxy)

See `CLOUDFLARE_WORKER_SETUP.md` for detail. Quick version:

1. Create a worker at dash.cloudflare.com
2. Copy code from `cloudflare-worker/ai-proxy.js`
3. Add environment variables: `GROQ_API_KEY` (required for the free default), `ANTHROPIC_API_KEY` (optional fallback)
4. Deploy

### Supabase Edge Functions

The Cognee proxy deploys separately from the app:

```bash
supabase functions deploy cognee-proxy
```

---

## 📁 Project structure

```
hydra/
├── src/
│   ├── agents/                     # The nine-agent pipeline
│   │   ├── scout.ts                # 1 — ATS board discovery
│   │   ├── classifier.ts           # 2 — fit scoring + track assignment
│   │   ├── cvSelector.ts           # 3 — CV track selection
│   │   ├── resumeTailor.ts         # 4 — CV tailoring
│   │   ├── coverLetterWriter.ts    # 5 — cover letter drafting
│   │   ├── formMapper.ts           # 6 — ATS field mapping
│   │   ├── screenshotCapturer.ts   # 7 — visual capture for review
│   │   ├── reviewGatekeeper.ts     # 8 — HUMAN APPROVAL GATE
│   │   ├── statusTracker.ts        # 9 — reply tracking
│   │   ├── submitter.ts            # post-approval submission
│   │   ├── openRouterClient.ts     # shared model client
│   │   ├── cogneeClient.ts         # optional knowledge graph
│   │   └── types.ts                # inter-agent contracts
│   ├── components/
│   │   ├── PipelineVisualization.tsx # live pipeline view
│   │   ├── ResumeManager.jsx       # resume management UI
│   │   ├── ResumeAssembly.jsx      # AI resume customization
│   │   ├── ApiKeySettings.jsx      # user API key management
│   │   ├── OnboardingTutorial.jsx  # first-time user guide
│   │   ├── Leaderboard.jsx         # gamification leaderboard
│   │   └── ...
│   ├── utils/
│   │   ├── smartResumeParser.js    # resume parsing (PDF/DOCX)
│   │   └── resumeDatabase.js       # resume CRUD
│   ├── App.jsx                     # main app component
│   ├── supabaseClient.js           # Supabase config
│   └── gamification.js             # points & achievements
├── public/
│   └── architecture.html           # architecture walkthrough
├── cloudflare-worker/
│   └── ai-proxy.js                 # AI API proxy
├── supabase/
│   ├── functions/cognee-proxy/     # Cognee CORS proxy
│   └── migrations/                 # database schema
├── deploy.sh                       # quick deployment script
└── README.md
```

---

## 🗄️ Database schema

- `applications` — job applications
- `resume_versions` — resume storage
- `gamification_state` — user points and ranks
- `user_profiles` — user settings and preferences

See `supabase/DATABASE_SCHEMA.md` for the full schema.

---

## 🎨 Customization

### Themes
Dark theme with a cyberpunk aesthetic. Toggle available in the header.

### Models
- **OpenRouter** — free tier, models discovered live at runtime
- **Groq** — `llama-3.3-70b-versatile` (fast, free)
- **Anthropic** — `claude-haiku-4-5` (requires your own key)

---

## 🤝 Contributing

Contributions welcome:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

One issue per PR; please don't bundle unrelated changes.

---

## 📝 License

**PolyForm Noncommercial License 1.0.0** — see the [`LICENSE`](LICENSE) file.

Free to use, modify and share for any **noncommercial** purpose. Commercial use requires a separate licence. Copyright 2026 Athar Hafiz.

---

## 🆘 Support

- **Issues**: open an issue on GitHub
- **Documentation**: see the `/docs` folder
- **Security**: see `SECURITY.md`

---

## 🙏 Acknowledgments

- Supabase for backend infrastructure
- Groq for free AI inference
- Anthropic for Claude
- Cloudflare for hosting and workers

---

**Built for job seekers who want the work done, and still want the last word.**

**GitHub**: https://github.com/atharux/job-tracker
