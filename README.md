# Job Application Tracker

A modern, cloud-backed job application tracking dashboard built with React, Vite, and Supabase.

## Features

- **Track Applications** — Add, edit, and delete job applications with full details
- **Real-time Sync** — All data automatically syncs to Supabase cloud
- **Status Management** — Track application status: Applied, Interview, Offered, Rejected, Accepted
- **Filter & Search** — Filter applications by status
- **Export Data** — Download applications as CSV or PDF for government agencies
- **Server Farm Aesthetic** — Dark theme dashboard with modern UI
- **Persistent Storage** — Data is safe in the cloud, accessible from any device

## Tech Stack

- **Frontend:** React 18 + Vite
- **Database:** Supabase (PostgreSQL)
- **Styling:** Tailwind CSS
- **Icons:** Lucide React
- **Deployment:** Cloudflare Pages

## Getting Started

### Prerequisites

- Node.js 16+
- npm or yarn
- Supabase account (free tier)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/YOUR_USERNAME/job-tracker.git
cd job-tracker
```

2. Install dependencies:
```bash
npm install
```

3. Create `.env.local` file with your Supabase credentials:
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

4. Start the development server:
```bash
npm run dev
```

5. Open [http://localhost:5173](http://localhost:5173) in your browser

## Usage

### Adding an Application

1. Click **"New Application"** button
2. Fill in:
   - Company name
   - Position title
   - Date applied
   - Contact person (optional)
   - Status (Applied, Interview, Offered, Rejected, Accepted)
   - Notes (optional)
3. Click **"Save"**

### Managing Applications

- **Edit:** Click the pencil icon to edit an application
- **Delete:** Click the trash icon to delete an application
- **Filter:** Use status buttons to filter applications

### Exporting Data

- **CSV:** Click the CSV button to download as spreadsheet (for backup or government submission)
- **PDF:** Click the PDF button to open print dialog and save as PDF

## Deployment

### Deploy to Cloudflare Pages

1. Push your code to GitHub
2. Go to [dash.cloudflare.com](https://dash.cloudflare.com)
3. Click **"Pages"** → **"Connect to Git"**
4. Select your `job-tracker` repository
5. Build settings:
   - Framework: Vite
   - Build command: `npm run build`
   - Build output: `dist`
6. Click **"Deploy"**
7. Add environment variables in Cloudflare:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`

Your app is live and syncs to Supabase automatically.

## Project Structure

```
job-tracker/
├── src/
│   ├── App.jsx              # Main app component
│   ├── App.css              # Styles
│   ├── supabaseClient.js    # Supabase configuration
│   ├── main.jsx             # Entry point
│   └── index.css            # Global styles
├── index.html               # HTML template
├── package.json             # Dependencies
├── vite.config.js           # Vite configuration
└── README.md                # This file
```

## Database Schema

### applications table

| Column | Type | Description |
|--------|------|-------------|
| id | bigint | Primary key |
| company | text | Company name |
| position | text | Job position title |
| date_applied | date | Date application was submitted |
| contact_person | text | Hiring manager or contact info |
| status | text | Application status |
| notes | text | Additional notes |
| created_at | timestamp | Record creation date |

## Stats Dashboard

The dashboard displays real-time stats:
- **Total** — Total number of applications
- **Applied** — Applications in "Applied" status
- **Interviews** — Applications in "Interview" status
- **Offers** — Applications in "Offered" status

## Tips

- Export your data regularly as CSV for backup
- Use the Notes field to track interview dates and follow-ups
- Filter by status to focus on active opportunities
- Submit PDF exports to government agencies (Agentur für Arbeit, etc.)

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+

## License

MIT

## Support

For issues or questions, open an issue on GitHub.

---

**Built with ❤️ for efficient job searching**
