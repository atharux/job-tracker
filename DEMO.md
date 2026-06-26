# Job Tracker — Demo Script

**Duration:** ~10 minutes  
**Audience:** Technical / AI-curious  
**Angle:** Agentic AI in production — real users, real observability, human-in-the-loop

---

## Before You Start

- [ ] Settings open → Groq/OpenRouter key filled, Langfuse keys filled
- [ ] Langfuse tab open: cloud.langfuse.com (or eu.cloud.langfuse.com)
- [ ] App loaded on main Tracker page (`/`)
- [ ] At least one prior Scout run in Langfuse (so traces exist)
- [ ] Fallback: if Cognee query fails live, describe it — the Langfuse demo carries the weight

---

## 1. The Problem (30 sec)

> "I was applying to 50+ jobs manually. Same CV, same cover letter, copy-paste into every ATS form. So I built a pipeline to automate it — nine agents, each with a specific job in the sequence."

---

## 2. Agent Architecture (1 min)

Navigate to **Agent Studio** (`/pipeline` — button in the top nav).

> "This is the architecture. Scout fetches live jobs from 14 sources — Arbeitnow, Remotive, GermanTechJobs, Greenhouse-backed companies — all free APIs, no paid keys needed."

> "Classifier scores each job 0–10 against my profile using Groq's LPU hardware — fastest inference available, and free tier. Anything below 3 gets dropped."

> "Then three document agents: Resume Tailor rewrites my CV bullets to mirror the job description language. Cover Letter Writer generates a three-paragraph letter in the right voice for the track. Form Mapper maps every application form field."

Point to the **REVIEW GATEKEEPER** node (amber).

> "This one is the most important node in the system. Nothing is submitted without my approval. I see the tailored CV, the cover letter, the form mapping — and I hit Approve or Reject. The AI prepares everything. I make the final call."

---

## 3. Run It Live (2 min)

Click **RUN SCOUT** (top-right of the Agent Studio page).

> "This hits all 14 sources in parallel, right now. Deduplicates by URL. Scores against 60+ role titles across three CV tracks — UX Engineer, Product Manager, Developer Relations."

While it runs, switch to **Review Queue** (`/review-queue` in the top nav).

> "While Scout runs — here's what a processed job looks like. The agents have already tailored the CV bullets for this specific job description, written the cover letter, mapped the form fields. I hit Approve and it goes out. Reject and it's archived."

---

## 4. Langfuse — Observability (3 min)

Switch to the **Langfuse browser tab**.

> "Every pipeline run is traced. Let me show you inside one."

Click the latest trace in the list (named `job_tracker_run`).

> "This is the full pipeline as a single trace. Each span is one agent — classifier, resumeTailor, coverLetterWriter, formMapper. The whole run took about 20–30 seconds end to end."

Click into the **`classifier`** span, then click the **`llm_call`** generation inside it.

> "Here's exactly what Groq received — the system prompt, the full job description, my CV. And here's what it returned — score of 7, CV track UX Engineer, key matches, red flags, rationale."

Scroll to the **usage** section.

> "Input tokens, output tokens, latency in milliseconds. This is how you tune an agentic system. You can't optimise what you can't measure. Most people treat LLM calls as a black box. This makes every decision in the pipeline transparent and auditable."

Click back to the **trace timeline view**.

> "Classifier is the fastest — Groq's LPU hardware. Document agents are slower because they're generating full text. Cover letter is the longest call. This tells me exactly where to optimise if I need to cut latency."

---

## 5. Cognee Knowledge Graph (1 min)

Back on **Agent Studio**, use the Cognee query panel.

Type: `which jobs match UX Engineer above score 7?`

> "After each Scout run, every classified job gets written into a Cognee knowledge graph — company, role, fit score, key skill matches. I can query the graph in natural language. It knows the relationships between companies, required skills, and my profile — not just keyword matching."

_(If Cognee returns no results: "The graph builds asynchronously after Scout — cognify can take a minute or two. In production, this powers recommendations across runs: 'which companies keep posting for UX leads?', 'what skills am I missing for PM roles?'")_

---

## 6. Close (30 sec)

> "Three real users running this against live job boards — including me. The architecture is public on GitHub. This is what agentic AI looks like in production: not a chatbot, not a demo — a pipeline with audit logs, human oversight, and observability built in from day one."

> "The pattern scales. Same architecture works for any multi-step agentic task where you need human review before action — outreach, content generation, code review. The human-in-the-loop gate is the primitive, not the exception."

---

## Langfuse Cheat Sheet

| What to click | What it shows |
|---|---|
| Traces list | One row per pipeline run — name, timestamp, total latency |
| Trace → span tree | `classifier`, `resumeTailor`, `coverLetterWriter` as nested spans |
| `llm_call` generation inside a span | Actual prompt sent + actual completion received |
| Usage column | Input / output tokens per LLM call |
| Timeline tab on a trace | Visual waterfall — which agent took longest |

**Setup check:** If no traces exist, run Scout once from Agent Studio with Langfuse keys filled in Settings. Traces appear ~10 seconds after the run completes.

---

## Fallback Lines

**If Scout finds 0 jobs:**
> "The job boards rotate their listings — I'll show you a trace from an earlier run in Langfuse."

**If Cognee query returns no results:**
> "Cognee's cognify step is asynchronous — it builds the graph in the background after ingestion. The architecture is wired; in a live deployment you'd query after a short delay."

**If someone asks about cost:**
> "Scout uses zero paid APIs. Classifier runs on Groq free tier. Document agents use OpenRouter's free model tier. The only paid layer is if you add Langfuse Cloud above the free tier — the whole pipeline can run at zero cost."

**If someone asks about job application law / automation ethics:**
> "Every application goes through a human review gate before submission. I read every tailored CV and cover letter before it goes out. The agents prepare, I approve."
