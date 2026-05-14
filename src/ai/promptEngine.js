import { SYSTEM_PROMPT } from "./systemPrompts";
import { TOOL_STRATEGIES } from "./toolStrategies";

export function buildEnhancedPrompt({
  tool,
  userInput,
}) {
  const strategy = TOOL_STRATEGIES[tool.title];

  const structure = strategy?.format
    ?.map((s) => `- ${s}`)
    .join("\n");

  return `
${SYSTEM_PROMPT}

TOOL:
${tool.title}

GOAL:
${strategy?.goal || "Provide high quality career guidance"}

OUTPUT STRUCTURE:
${structure}

USER INPUT:
${userInput}

INSTRUCTIONS:
- Produce high-signal output
- Avoid filler language
- Be specific and strategic
- Use markdown
- Use tables where useful
- Optimize for recruiter readability
`;
}