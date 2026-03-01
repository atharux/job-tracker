#!/bin/bash

# Quick deployment script for GitHub Pages
# Usage: ./deploy.sh "your commit message"

echo "🚀 Starting deployment..."

# Check if commit message provided
if [ -z "$1" ]; then
    echo "❌ Error: Please provide a commit message"
    echo "Usage: ./deploy.sh \"your commit message\""
    exit 1
fi

# Add all changes
echo "📦 Adding files..."
git add .

# Commit with provided message
echo "💾 Committing changes..."
git commit -m "$1"

# Push to GitHub
echo "🌐 Pushing to GitHub..."
git push

echo "✅ Deployment complete!"
echo "⏳ GitHub Pages will update in 1-2 minutes"
echo "🔗 Check status: https://github.com/$(git config --get remote.origin.url | sed 's/.*github.com[:/]\(.*\)\.git/\1/')/actions"
