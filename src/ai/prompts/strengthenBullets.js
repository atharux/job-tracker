export function buildStrengthenBulletsPrompt({ role, jd, bullets }) {
  return `Rewrite these CV bullets for this role using action + task + result format.

For each bullet produce a table row:
| Original | Improved | Why It's Stronger |

If metrics are missing insert [ADD METRIC].

Role: ${role}

JD:
${jd}

Bullets:
${bullets}`;
}