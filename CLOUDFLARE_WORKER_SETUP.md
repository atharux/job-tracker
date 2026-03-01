# Cloudflare Worker Setup Guide

## Step 1: Create Cloudflare Account

1. Go to https://dash.cloudflare.com/sign-up
2. Sign up (it's free)
3. Verify your email

## Step 2: Create Worker

1. Go to https://dash.cloudflare.com/
2. Click "Workers & Pages" in the left sidebar
3. Click "Create Application"
4. Click "Create Worker"
5. Name it: `ai-proxy` (or any name you like)
6. Click "Deploy"

## Step 3: Edit Worker Code

1. After deployment, click "Edit Code"
2. Delete all the default code
3. Copy the entire contents of `cloudflare-worker/ai-proxy.js`
4. Paste it into the editor
5. Click "Save and Deploy"

## Step 4: Add Environment Variables (Secrets)

1. Go back to your worker dashboard
2. Click "Settings" tab
3. Scroll to "Environment Variables"
4. Click "Add variable"
5. Add these two secrets:

**Variable 1:**
- Name: `ANTHROPIC_API_KEY`
- Value: `your-anthropic-api-key-here`
- Type: Secret (encrypted)

**Variable 2:**
- Name: `GROQ_API_KEY`
- Value: (your Groq API key from https://console.groq.com/)
- Type: Secret (encrypted)

6. Click "Save"

## Step 5: Get Your Worker URL

After deployment, you'll see a URL like:
```
https://ai-proxy.YOUR-SUBDOMAIN.workers.dev
```

Copy this URL - you'll need it for the next step.

## Step 6: Update Your React App

Open `src/components/ResumeAssembly.jsx` and replace the `callClaude` and `callGroq` functions with this:

```javascript
// ─── AI Proxy (via Cloudflare Worker) ───────────────────────────────────────

const WORKER_URL = 'https://ai-proxy.YOUR-SUBDOMAIN.workers.dev'; // Replace with your worker URL

async function callAI(systemPrompt, userMessage, provider = 'claude') {
  const response = await fetch(WORKER_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      provider,
      systemPrompt,
      userMessage,
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error?.message || `API error ${response.status}`);
  }

  const data = await response.json();
  return data.content;
}
```

Then update `handleAnalyze` to use `callAI` instead of `callClaude`:

```javascript
// Change all instances of:
const jobSignalRaw = await callClaude(...)

// To:
const jobSignalRaw = await callAI(..., aiProvider)
```

## Step 7: Test

1. Restart your dev server: `npm run dev`
2. Go to Assembly view
3. Paste a job description
4. Click "Assemble Resume"
5. It should work now!

## Troubleshooting

### Worker not responding
- Check the worker logs in Cloudflare dashboard
- Make sure environment variables are set correctly

### CORS errors
- The worker code already includes CORS headers
- Make sure you deployed the latest code

### API errors
- Check that your API keys are valid
- Check the worker logs for detailed error messages

## Cost

Cloudflare Workers free tier:
- 100,000 requests per day
- More than enough for personal use
- No credit card required

## Security

Your API keys are stored as encrypted secrets in Cloudflare and never exposed to the browser. This is much more secure than having them in your frontend code.

## Next Steps

Once this works, you can:
1. Add rate limiting to the worker
2. Add request logging
3. Add caching for repeated requests
4. Deploy your app to GitHub Pages (it will work in production too)
