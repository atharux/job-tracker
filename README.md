# Forge - AI-Powered Job Application Tracker

A modern, cloud-backed job application tracking platform with AI-powered resume customization. Built with React, Vite, Supabase, and AI.

## ✨ Features

### 📊 Application Tracking
- Track job applications with full details (company, position, status, notes)
- Real-time cloud sync with Supabase
- Status management: Applied → Interview → Offered → Rejected/Accepted
- Filter applications by status
- Export data as CSV or PDF

### 📄 Resume Management
- Store multiple resume versions in the cloud
- Side-by-side resume editor for easy comparison
- Link resumes to specific job applications
- Upload and parse existing resumes (PDF, DOCX, TXT)

### 🤖 AI Resume Assembly
- **Free AI-powered resume customization** using Groq (default)
- Paste any job description and get a tailored resume instantly
- Analyzes job requirements and matches your experience
- Optional: Use Claude AI with your own API key for premium results
- BYOK (Bring Your Own Key) support for unlimited usage

### 🎮 Gamification & Leaderboard
- Earn points for applications, interviews, and offers
- Rank system with achievements
- Daily login streaks
- Compete with other users on the leaderboard
- Celebration animations for milestones

### 🎓 Onboarding & Help
- Interactive tutorial for first-time users
- Contextual tooltips throughout the app
- Help button to replay tutorial anytime

## 🚀 Quick Start

### For Users (No Setup Required)

1. Visit the live app: **[Your App URL]**
2. Sign up with email and password
3. Start tracking applications immediately
4. Use AI Assembly with Groq (free, no API key needed)
5. Optional: Add your own API keys in Settings for unlimited usage

### For Developers

#### Prerequisites
- Node.js 16+
- npm or yarn
- Supabase account (free tier)
- Cloudflare account (for AI proxy worker)

#### Installation

1. Clone the repository:
```bash
git clone https://github.com/atharux/job-tracker.git
cd job-tracker
```

2. Install dependencies:
```bash
npm install
```

3. Create `.env.local` file:
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

4. Set up Supabase database:
   - Run migrations in `supabase/migrations/`
   - See `supabase/SETUP_GUIDE.md` for details

5. Set up Cloudflare Worker (for AI features):
   - See `CLOUDFLARE_WORKER_SETUP.md` for step-by-step guide
   - Add your Groq API key as environment variable
   - Deploy the worker from `cloudflare-worker/ai-proxy.js`

6. Start development server:
```bash
npm run dev
```

## 🎯 Usage Guide

### Application Tracking
1. Click "New Application" to add a job
2. Fill in company, position, date, and status
3. Link a resume version (optional)
4. Track progress as you move through interview stages

### Resume Management
1. Go to "Resumes" view
2. Upload existing resumes or create new ones
3. Open two resumes side-by-side for comparison
4. Edit, save, and download as needed

### AI Resume Assembly
1. Go to "Assembly" view
2. Select a base resume version
3. Paste the job description
4. Click "Assemble Resume"
5. AI analyzes the job and customizes your resume
6. Save the result as a new version

**Default:** Uses Groq (free, fast, no key required)
**Optional:** Add Claude API key in Settings for premium results

### Gamification
- Earn 10 points per application
- Earn 25 points per interview
- Earn 50 points per offer
- Daily login bonuses
- View your rank and compete on the leaderboard

## 🔐 Security & Privacy

- **Supabase RLS**: Row-level security ensures users only see their own data
- **API Keys**: User API keys stored in browser localStorage (never sent to server)
- **Cloudflare Worker**: Proxies AI requests to avoid exposing keys in frontend
- **No tracking**: Your data stays private

## 🛠️ Tech Stack

- **Frontend**: React 18 + Vite
- **Database**: Supabase (PostgreSQL)
- **AI**: Groq (Llama 3.3 70B) + Claude (Sonnet 4)
- **Styling**: Tailwind CSS + Custom CSS
- **Icons**: Lucide React
- **Deployment**: Cloudflare Pages
- **AI Proxy**: Cloudflare Workers

## 📦 Deployment

### Deploy to Cloudflare Pages

1. Push code to GitHub
2. Go to [dash.cloudflare.com](https://dash.cloudflare.com)
3. Pages → Create Application → Connect to Git
4. Select your repository
5. Build settings:
   - Framework: Vite
   - Build command: `npm run build`
   - Output: `dist`
6. Add environment variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
7. Deploy!

### Deploy Cloudflare Worker (AI Proxy)

See `CLOUDFLARE_WORKER_SETUP.md` for detailed instructions.

**Quick version:**
1. Create worker at dash.cloudflare.com
2. Copy code from `cloudflare-worker/ai-proxy.js`
3. Add environment variables:
   - `GROQ_API_KEY` (required for default free AI)
   - `ANTHROPIC_API_KEY` (optional, for fallback)
4. Deploy

## 📁 Project Structure

```
forge/
├── src/
│   ├── components/
│   │   ├── ResumeManager.jsx      # Resume management UI
│   │   ├── ResumeAssembly.jsx     # AI resume customization
│   │   ├── ApiKeySettings.jsx     # User API key management
│   │   ├── OnboardingTutorial.jsx # First-time user guide
│   │   ├── Leaderboard.jsx        # Gamification leaderboard
│   │   └── ...
│   ├── utils/
│   │   ├── smartResumeParser.js   # Resume parsing (PDF/DOCX)
│   │   └── resumeDatabase.js      # Resume CRUD operations
│   ├── App.jsx                    # Main app component
│   ├── supabaseClient.js          # Supabase config
│   └── gamification.js            # Points & achievements
├── cloudflare-worker/
│   └── ai-proxy.js                # AI API proxy
├── supabase/
│   └── migrations/                # Database schema
├── deploy.sh                      # Quick deployment script
└── README.md
```

## 🗄️ Database Schema

### Tables
- `applications` - Job applications
- `resume_versions` - Resume storage
- `gamification_state` - User points and ranks
- `user_profiles` - User settings and preferences

See `supabase/DATABASE_SCHEMA.md` for full schema.

## 🎨 Customization

### Themes
Currently supports dark theme with cyberpunk aesthetic. Theme toggle available in header.

### AI Models
- **Groq**: Llama 3.3 70B (default, free, fast)
- **Claude**: Sonnet 4 (premium, requires API key)

## 🤝 Contributing

Contributions welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## 📝 License

MIT License - see LICENSE file for details

## 🆘 Support

- **Issues**: Open an issue on GitHub
- **Documentation**: Check `/docs` folder
- **Security**: See `SECURITY.md`

## 🙏 Acknowledgments

- Supabase for backend infrastructure
- Groq for free AI inference
- Anthropic for Claude AI
- Cloudflare for hosting and workers

---

**Built with ❤️ for job seekers everywhere**

**Live Demo**: [Your App URL]
**GitHub**: https://github.com/atharux/job-tracker
