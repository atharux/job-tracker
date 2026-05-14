export function buildAssessFitPrompt({ background, jd }) {
  return `Create a role-fit matrix comparing this background to the JD.

Produce tables for:
- Strengths (direct matches)
- Gaps (missing requirements)
- Risk Areas (what a recruiter will flag)
- Competitive Advantages (what sets this candidate apart)
- Interview Strategy (how to address gaps)

Background:
${background}

JD:
${jd}`;
}