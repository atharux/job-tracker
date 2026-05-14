export function buildCoverLetterPrompt({ background, jd }) {
  return `Write a tailored, natural cover letter. Structure:
- Opening (hook + role fit signal)
- Experience Alignment (2–3 specific achievements)
- Business Value (what you bring to this company)
- Closing (confident, not desperate)

Keep it under 400 words. No clichés.

Background:
${background}

JD:
${jd}`;
}