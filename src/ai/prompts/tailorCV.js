export function buildTailorCVPrompt({ cv, jd }) {
  return `Rewrite this CV for the role below. Never fabricate experience.

Produce:
- Optimized Summary
- Optimized Experience Bullets
- Skills Section (ATS-ready)
- ATS Improvements Checklist
- Final Recommendations

CV:
${cv}

JD:
${jd}`;
}