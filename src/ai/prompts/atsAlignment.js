export function buildATSAlignmentPrompt({ cv, jd }) {
  return `Perform a full ATS alignment audit.

Produce:
- Keyword Gap Table (present vs missing vs recommended frequency)
- Weak Sections (what will lose ATS points)
- Rewritten Summary (ATS-optimized)
- Top 10 keywords to add and where to place them

CV:
${cv}

JD:
${jd}`;
}