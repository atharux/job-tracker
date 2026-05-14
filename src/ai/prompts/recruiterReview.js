export function buildRecruiterReviewPrompt({ cv, cover, jd }) {
  return `Review this application package as a senior recruiter.

Produce:
- Verdict: Shortlist / Maybe / Reject (with confidence %)
- Top 3 Strengths
- Top 3 Weaknesses
- Quick Wins (improvements that take under 30 mins)
- Final Recommendation

CV:
${cv}

Cover Letter:
${cover}

JD:
${jd}`;
}