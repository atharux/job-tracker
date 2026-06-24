# Forge — Quick Start

A 9-agent pipeline that finds, tailors, and queues job applications for your review.
Setup takes about 20 minutes.

---

## Prerequisites

- Node.js 18+
- [Supabase](https://supabase.com) account (free tier works)
- [Groq](https://console.groq.com) API key (free)
- [Cloudflare](https://cloudflare.com) account for deployment (free)

---

## Step 1 — Install

```bash
unzip forge-v2.zip && cd forge-v2
npm install
```

---

## Step 2 — Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to **Settings → API** — copy your project URL and anon key
3. Create `.env.local` in the project root:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

4. Go to **SQL Editor** and run these migration files in order (copy contents, paste, run):

```
supabase/migrations/20240101000000_resume_builder_schema.sql
supabase/migrations/20260527000000_agent_system.sql
supabase/migrations/20260527000001_update_job_sources.sql
supabase/migrations/20260527000002_seed_cv_versions.sql
supabase/migrations/20260624000000_expand_job_sources.sql
```

---

## Step 3 — Your profile

Open `src/config/userProfile.ts` and fill in your details. This is the only file
you need to edit — all agents pull from it.

```ts
export const USER_PROFILE = {
  name: 'Jane Smith',
  email: 'jane@example.com',
  phone: '+44 7700 900000',
  location: 'London, UK',
  linkedin: 'https://linkedin.com/in/janesmith',
  portfolio: 'https://janesmith.com',

  background: '8 years in product design. Figma, React, design systems.',

  locationPreferences: 'London (on-site/hybrid), Remote Europe',

  tracks: {
    ux: {
      label: 'UX Engineer',
      color: '#06b6d4',
      voice: 'Designs and ships. Figma to React. Cares about systems that scale.',
    },
    pm: {
      label: 'Product Manager',
      color: '#8b5cf6',
      voice: 'Data-informed. Moves from ambiguous signal to shipped feature.',
    },
    devrel: {
      label: 'Developer Relations',
      color: '#f97316',
      voice: 'Technically credible. Builds demos, writes docs, grows communities.',
    },
  },
}
```

---

## Step 4 — Add your CV

The pipeline tailors your CV against each job description. Your base CV lives in
the `cv_versions` Supabase table (one row per track: `ux`, `pm`, `devrel`).

Run the import script (expects a markdown file):

```bash
npx tsx scripts/importResume.ts
```

Or paste your CV content directly into the `cv_versions` table in the Supabase
Table Editor.

---

## Step 5 — Deploy the Edge Function

Some job sources (Himalayas, WeWorkRemotely, Workable, Personio, Welcome to the Jungle)
are CORS-blocked in the browser. The scout proxies them through a Supabase Edge Function.

```bash
npx supabase link --project-ref your-project-ref
npx supabase functions deploy job-scout-proxy
```

Your project ref is in **Supabase → Settings → General**.

---

## Step 6 — Gmail Status Tracker (optional)

The 9th agent monitors your inbox and classifies replies as `screening | interview | rejection`.

1. Go to [console.cloud.google.com](https://console.cloud.google.com) → create a project
2. Enable the **Gmail API**
3. Create **OAuth 2.0 credentials** (Web application type)
4. Add your app URL as an authorised redirect URI (e.g. `https://yourapp.pages.dev`)
5. Copy the Client ID and add it to `.env.local`:

```env
VITE_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
```

6. Also add it as an environment variable in Cloudflare Pages

Once deployed: go to **Settings → Connect Gmail** to authorise. The **Sync Status** button appears in the Review Queue header when Gmail is connected.

---

## Step 7 — Run locally


```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173), sign up, then go to **Settings**
and add your API keys:

| Key | Where | Cost |
|-----|-------|------|
| Groq | [console.groq.com](https://console.groq.com) | Free |
| OpenRouter | [openrouter.ai](https://openrouter.ai) | Free tier |
| Anthropic | [console.anthropic.com](https://console.anthropic.com) | Optional |

---

## Step 8 — Run the Scout

Click **Run Scout**. The pipeline runs automatically:

1. **Scout** — fetches jobs from 15+ sources
2. **Classifier** — scores each job 0–10, assigns CV track
3. **Jobs appear in Review Queue** for your approval

From the queue: generate tailored resume + cover letter per job, then approve to submit.
Nothing submits without your explicit approval.

---

## Step 9 — Deploy to Cloudflare Pages

1. Push your fork to GitHub
2. Go to [dash.cloudflare.com](https://dash.cloudflare.com) → **Pages → Create application → Connect to Git**
3. Build settings:
   - Build command: `npm run build`
   - Output directory: `dist`
4. Add environment variables: `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
5. Deploy

See `DEPLOYMENT.md` and `CLOUDFLARE_WORKER_SETUP.md` for full deployment details.

---

## Troubleshooting

**Scout returns no jobs**
Check your Groq API key in Settings. Open browser console for network errors.

**`jobs_source_check` constraint error**
Run all five migrations in order — especially `20260624000000_expand_job_sources.sql`.

**Edge Function errors**
```bash
npx supabase functions logs job-scout-proxy
```

**Cover letters have wrong name or voice**
Edit `src/config/userProfile.ts` — it's the single source of truth for all agent prompts.

**Same jobs keep reappearing**
Rejected/submitted jobs are permanently excluded. If jobs cycle back, check that all
five migrations ran — the queue-based dedup requires the agent_system schema.

---

## Pipeline overview

```
Scout          → fetches jobs from 15+ free sources
Classifier     → scores fit 0–10, assigns ux / pm / devrel track
CV Selector    → pulls your base CV for the assigned track
Resume Tailor  → rewrites bullet points against the JD
Cover Letter   → writes a track-specific letter (max 350 words)
Form Mapper    → maps application form fields
Screenshot     → before/after screenshots
Review Gate    → holds everything for your approval ← nothing submits without this
```

**Roadmap:** Auto-trigger status sync on a cron schedule; Slack/email notification on status change.
