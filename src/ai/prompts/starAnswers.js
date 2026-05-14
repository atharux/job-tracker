export function buildSTARAnswersPrompt({ background, jd }) {
  return `Create 8 STAR interview answers from this background for this role.

Cover: leadership, problem-solving, teamwork, conflict, ownership, failure, achievement, adaptability.

For each answer use this structure:
**Situation:** ...
**Task:** ...
**Action:** ...
**Result:** ...

Keep each answer under 200 words.

Background:
${background}

JD:
${jd}`;
}