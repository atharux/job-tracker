export function buildInterviewQuestionsPrompt({ background, jd }) {
  return `Act as the hiring manager. Generate 15 likely interview questions.

Group into:
- Technical (5 questions)
- Behavioural (5 questions)
- Culture Fit (5 questions)

For each question include: what a strong answer must cover.

Background:
${background}

JD:
${jd}`;
}