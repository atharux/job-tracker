export function getRecommendedModel(toolTitle) {
  const map = {
    "Decode Job Description":      "meta-llama/llama-4-maverick:free",
    "Tailor Your CV":              "meta-llama/llama-4-maverick:free",
    "Strengthen Bullet Points":    "qwen/qwen3-235b-a22b:free",
    "Write a Cover Letter":        "google/gemma-3-27b-it:free",
    "Assess Role Fit":             "meta-llama/llama-4-maverick:free",
    "Improve ATS Alignment":       "meta-llama/llama-4-maverick:free",
    "Predict Interview Questions": "meta-llama/llama-4-maverick:free",
    "Build STAR Answers":          "qwen/qwen3-235b-a22b:free",
    "Recruiter-Style Review":      "meta-llama/llama-4-maverick:free",
    "Full Application Pack":       "meta-llama/llama-4-maverick:free",
  };

  return map[toolTitle] || "openrouter/free";
}