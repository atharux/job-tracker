## Forge, the cleaner architecture is:

UI (React)
↓
Prompt Engine
↓
AI Service Layer
↓
OpenRouter
↓
Models
WHAT YOU SHOULD BUILD INSTEAD
CENTRAL PROMPT ENGINE ARCHITECTURE

This becomes the intelligence layer of Forge.

## IDEAL STRUCTURE
/src
  /ai
    /prompts
      decodeJD.js
      tailorCV.js
      atsReview.js
      interviewQuestions.js
      recruiterReview.js

    /system
      recruiterSystemPrompt.js
      atsSystemPrompt.js
      interviewCoachPrompt.js

    /schemas
      atsSchema.js
      jdSchema.js
      recruiterReviewSchema.js

    /services
      openrouter.js
      aiRunner.js
      contextBuilder.js

    /memory
      applicationMemory.js

    /evaluators
      atsEvaluator.js
      hallucinationCheck.js

This is scalable and professional.

WHY THIS IS BETTER

Right now:

prompts live inside UI config
impossible to version
impossible to test
impossible to reuse
hard to improve outputs

Moving prompts out gives you:

✅ maintainability
✅ reusable workflows
✅ prompt versioning
✅ better outputs
✅ multi-model support
✅ evaluation support
✅ easier debugging

EXAMPLE: CURRENT VS BETTER
❌ CURRENT

Inside tool object:

buildPrompt: (vals) => `Rewrite my CV...`

This tightly couples:

UI
business logic
AI orchestration

Bad long-term.

✅ BETTER
/ai/prompts/tailorCV.js
export function buildTailorCVPrompt({
  cv,
  jd,
  recruiterInsights,
}) {
  return `
You are a senior recruiter and ATS optimization expert.

TASK:
Rewrite the candidate CV for this role.

RULES:
- Never fabricate experience
- Preserve factual accuracy
- Improve ATS alignment
- Improve readability
- Use measurable impact where possible

JOB DESCRIPTION:
${jd}

CANDIDATE CV:
${cv}

RECRUITER INSIGHTS:
${recruiterInsights}
`;
}
THEN YOUR COMPONENT DOES:
import { buildTailorCVPrompt } from "@/ai/prompts/tailorCV";

Then:

const prompt = buildTailorCVPrompt(values);

Massively cleaner.

EVEN BETTER: USE SYSTEM PROMPTS

You should separate:

SYSTEM
You are a senior recruiter...

from:

TASK
Rewrite this CV...

This improves consistency significantly.

EXAMPLE STRUCTURE
/ai/system/recruiter.js
export const recruiterSystemPrompt = `
You are an elite recruiter with expertise in:
- ATS optimization
- executive hiring
- technical recruiting
- behavioral interviewing

Never fabricate experience.
Always preserve factual accuracy.
`;
/ai/prompts/recruiterReview.js
export function buildRecruiterReviewPrompt(data) {
  return `
Review this application package.

CV:
${data.cv}

COVER LETTER:
${data.cover}

JD:
${data.jd}
`;
}
CREATE A SINGLE AI RUNNER

This is the most important file.

/ai/services/aiRunner.js

This becomes:

ONE entry point for ALL AI calls

Example:

export async function runAI({
  model,
  systemPrompt,
  userPrompt,
  temperature = 0.7,
}) {
  const response = await fetch(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${localStorage.getItem("openrouter_api_key")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "system",
            content: systemPrompt,
          },
          {
            role: "user",
            content: userPrompt,
          },
        ],
      }),
    }
  );

  const data = await response.json();

  return data?.choices?.[0]?.message?.content || "";
}
THIS CHANGES EVERYTHING

Now every tool becomes:

const output = await runAI({
  model,
  systemPrompt: recruiterSystemPrompt,
  userPrompt: buildTailorCVPrompt(values),
});

That’s production architecture.

NEXT LEVEL (HIGHLY RECOMMENDED)

You should also create:

CONTEXT BUILDER

This combines:

resume
JD
prior outputs
recruiter analysis
ATS insights
company notes

into one reusable AI context object.

EXAMPLE
const context = buildApplicationContext(application);

Then every tool gets richer context automatically.

This is one of the biggest quality improvements possible.

BEST LIGHTWEIGHT STACK FOR YOU

Since you don’t want Vercel:

Concern	Recommendation
AI Routing	OpenRouter
Backend	Cloudflare Workers
DB	Supabase
Prompt Engine	Custom
State	Zustand
Validation	Zod
Structured Outputs	Custom schemas
Workflow	Simple orchestrator
Auth	Supabase

This is a strong architecture.

MOST IMPORTANT NEXT STEP

Before adding more AI features:

STOP adding prompts directly into UI components.

That is the critical architectural boundary you should establish now before the app grows further.