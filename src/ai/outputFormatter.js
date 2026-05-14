export function formatOutput({ toolId, content }) {
  let out = content.trim();

  // Normalize multiple blank lines
  out = out.replace(/\n{3,}/g, '\n\n');

  // Tool-specific post-processing
  const toolRules = {
    1: (s) => s, // Decode JD — tables, leave as-is
    3: (s) => s.replace(/^[-•]\s*/gm, '• '), // Normalize bullet style
    7: (s) => s, // Interview questions — leave grouped
    8: (s) => s, // STAR answers — leave structured
  };

  return (toolRules[toolId] || ((s) => s))(out);
}