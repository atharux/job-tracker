export function buildFullApplicationPackPrompt({ background, jd }) {
  return `Create a complete application pack using only real experience. Produce:

1. CV Summary (3–4 sentences, ATS-optimized)
2. Key Skills List (10 bullets, matched to JD)
3. Cover Letter (under 400 words)
4. 5 Likely Interview Questions + strong answer outlines
5. 3 Questions to ask the interviewer
6. Recruiter LinkedIn DM (under 100 words)
7. Follow-up email (post-interview, under 150 words)

Background:
${background}

JD:
${jd}`;
}