# API Serverless Functions

This directory contains serverless functions for the Resume Builder feature.

## Setup

### Vercel Deployment

1. Install Vercel CLI:
```bash
npm install -g vercel
```

2. Set environment variable:
```bash
vercel env add ANTHROPIC_API_KEY
```

3. Deploy:
```bash
vercel
```

### Netlify Deployment

1. Create `netlify.toml` in project root:
```toml
[build]
  functions = "api"

[functions]
  node_bundler = "esbuild"
```

2. Set environment variable in Netlify dashboard:
   - Go to Site settings > Environment variables
   - Add `ANTHROPIC_API_KEY` with your Claude API key

3. Deploy via Netlify CLI or Git integration

### Local Development

1. Create `.env` file in project root:
```
ANTHROPIC_API_KEY=your_api_key_here
```

2. Run with Vercel dev server:
```bash
vercel dev
```

Or with Netlify dev server:
```bash
netlify dev
```

## Endpoints

### POST /api/parse-resume

Parses resume content using Claude AI.

**Request:**
```json
{
  "content": "Resume text content..."
}
```

**Response (Success):**
```json
{
  "success": true,
  "data": {
    "summary": "...",
    "experience": [...],
    "education": [...],
    "skills": {...},
    "certifications": [...]
  }
}
```

**Response (Error):**
```json
{
  "error": "Error message",
  "allowManualEntry": true
}
```

## Security

- API key is stored securely in environment variables
- Never expose the API key in client-side code
- The serverless function acts as a secure proxy
