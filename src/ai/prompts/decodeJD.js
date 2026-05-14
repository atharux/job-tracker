export function buildDecodeJDPrompt({ jd }) {
  return `Analyze this job description and extract:
- Role Summary
- Core Responsibilities  
- Required Skills
- ATS Keywords
- Hidden Signals
- Hiring Priorities
- Recommended Resume Focus

Use tables where useful. Be specific and recruiter-focused.

JD:
${jd}`;
}