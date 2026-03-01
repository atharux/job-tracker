# Security Guide

## Environment Variables

All sensitive credentials are stored in `.env.local` which is **NEVER** committed to Git.

### Setup Instructions

1. Copy `.env.example` to `.env.local`:
   ```bash
   cp .env.example .env.local
   ```

2. Fill in your actual credentials in `.env.local`

3. **NEVER** commit `.env.local` to Git (it's in `.gitignore`)

## Supabase Security

### Row Level Security (RLS)

All Supabase tables MUST have RLS enabled. Current policies:

- **resume_modules**: Users can only access their own modules
- **user_profiles**: Users can only read/write their own profile
- **resume_versions**: Users can only access their own versions
- **conversation_history**: Users can only access their own conversations

### API Keys

- **Anon Key**: Safe to use in client-side code (protected by RLS)
- **Service Role Key**: NEVER use in client code, only in server-side functions

### Authentication

- All database operations require authenticated user
- Use Supabase Auth for user management
- Enforce email verification for production

## AI Provider Security

### API Key Protection

- Store all AI API keys in environment variables
- Never hardcode API keys in source code
- Use server-side proxy for AI calls in production (optional but recommended)

### Rate Limiting

- Implement client-side rate limiting (10 requests/minute)
- Monitor API usage to prevent abuse
- Set up billing alerts on AI provider dashboards

## GitHub Pages Deployment

### Environment Variables in GitHub

For GitHub Pages deployment, you need to set environment variables as GitHub Secrets:

1. Go to your repository Settings → Secrets and variables → Actions
2. Add the following secrets:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_GROQ_API_KEY` (when ready)
   - `VITE_ANTHROPIC_API_KEY` (when ready)

3. Update your GitHub Actions workflow to use these secrets

### Build Configuration

The build process will inject environment variables at build time. They will be visible in the compiled JavaScript, but this is acceptable for:
- Supabase Anon Key (protected by RLS)
- Public API endpoints

**DO NOT** expose:
- Supabase Service Role Key
- Private API keys
- Database passwords

## Security Checklist

- [x] Environment variables moved to `.env.local`
- [x] `.env.local` added to `.gitignore`
- [x] Hardcoded credentials removed from source code
- [x] `.env.example` created for reference
- [ ] RLS policies enabled on all Supabase tables
- [ ] Email verification enabled in Supabase Auth
- [ ] Rate limiting implemented for AI calls
- [ ] GitHub Secrets configured for deployment
- [ ] Security audit completed before production launch

## What to Do If Keys Are Exposed

If you accidentally commit API keys to Git:

1. **Immediately rotate the keys** in your provider dashboard
2. Update `.env.local` with new keys
3. Remove the commit from Git history:
   ```bash
   git filter-branch --force --index-filter \
   "git rm --cached --ignore-unmatch src/supabaseClient.js" \
   --prune-empty --tag-name-filter cat -- --all
   ```
4. Force push to remote (if already pushed)
5. Notify your team

## Additional Security Measures

### Content Security Policy (CSP)

Add to `index.html`:
```html
<meta http-equiv="Content-Security-Policy" 
      content="default-src 'self'; 
               script-src 'self' 'unsafe-inline'; 
               style-src 'self' 'unsafe-inline'; 
               connect-src 'self' https://*.supabase.co https://api.groq.com https://api.anthropic.com;">
```

### Input Sanitization

- Sanitize all user inputs before processing
- Validate job posting text length and format
- Escape HTML in user-generated content

### HTTPS Only

- Always use HTTPS in production
- Enable HSTS headers
- Redirect HTTP to HTTPS

## Monitoring

- Set up Supabase monitoring for unusual activity
- Monitor AI API usage and costs
- Set up alerts for failed authentication attempts
- Review RLS policy logs regularly
