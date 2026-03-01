# Quick Deployment Guide

## One-Command Deployment

Use the deployment script to push changes to GitHub Pages in seconds:

```bash
./deploy.sh "your commit message"
```

### Examples:

```bash
./deploy.sh "Added onboarding tutorial"
./deploy.sh "Fixed resume manager bug"
./deploy.sh "Updated UI styling"
```

### First Time Setup:

Make the script executable:
```bash
chmod +x deploy.sh
```

### What it does:

1. Adds all changed files
2. Commits with your message
3. Pushes to GitHub
4. Shows you the deployment status link

### Deployment Time:

- GitHub Pages updates in **1-2 minutes** after push
- Check status at: Your repo → Actions tab

## Manual Deployment (Alternative):

If you prefer manual control:

```bash
git add .
git commit -m "your message"
git push
```

## Files to Deploy:

When ready to deploy, just run the script. It will automatically include:
- All modified files in `src/`
- Updated components
- Configuration changes
- New features

## Important Notes:

- The script commits ALL changes (like `git add .`)
- Make sure you've tested locally first (`npm run dev`)
- Check `.gitignore` to ensure sensitive files aren't included
- `.env.local` is automatically excluded (contains API keys)

## Troubleshooting:

**Script won't run:**
```bash
chmod +x deploy.sh
```

**Want to see what will be committed:**
```bash
git status
```

**Made a mistake? Undo last commit (before push):**
```bash
git reset HEAD~1
```

## Quick Reference:

| Command | Purpose |
|---------|---------|
| `./deploy.sh "message"` | Deploy everything |
| `git status` | See what changed |
| `npm run dev` | Test locally first |
| `npm run build` | Test production build |
