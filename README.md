# ✨ LightWork

> AI-powered batch image processing using Google's Gemini Nano Banana models

Transform your images in bulk using AI. Upload multiple images, select an enhancement module, and let Gemini do the rest.

## Features

- **Batch Processing** - Upload up to 50 images at once
- **AI Enhancement Modules** - Food plating, product backgrounds, portraits, real estate
- **Two AI Models** - Fast (free) or Pro (paid, higher quality)
- **Real-time Progress** - Watch your images process with live status updates
- **ZIP Download** - Download all processed images in one click

## Tech Stack

- **Frontend**: React 19 + TypeScript + Vite + Tailwind CSS
- **Backend**: Cloudflare Pages Functions
- **Database**: Cloudflare D1 (SQLite)
- **Storage**: Cloudflare R2
- **AI**: Google Gemini API (image generation)

## Quick Start

### Prerequisites

- Node.js 18+
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/)
- Cloudflare account with D1 and R2 set up
- Gemini API key

### Local Development

```bash
# Install dependencies
npm install

# Create .dev.vars with your Gemini API key
cp .dev.vars.example .dev.vars
# Edit .dev.vars and add your GEMINI_API_KEY

# IMPORTANT: Apply database schema locally (required before first run!)
npm run db:migrate:local

# Start dev server with Pages Functions
npm run pages:dev
```

Visit `http://localhost:8788` to use the app.

> ⚠️ **Troubleshooting:** If images stay "PENDING" forever, you likely forgot to run `npm run db:migrate:local`. Stop the server, run the migration, then restart.

### Deployment

```bash
# Build frontend
npm run build

# Apply schema to remote D1
npm run db:migrate

# Deploy to Cloudflare Pages
npm run pages:deploy
```

## AI Models

| Model | Description | Output | Cost |
|-------|-------------|--------|------|
| **Fast** (Nano Banana) | High-volume batch processing | 1024px | Free |
| **Pro** (Nano Banana Pro) | Professional quality output | Up to 4K | Paid |

## Project Structure

```
LightWork/
├── src/                    # Frontend (React)
│   ├── components/         # UI components
│   ├── hooks/              # Custom React hooks
│   ├── lib/                # API client & utilities
│   └── pages/              # Page components
├── functions/              # Backend (Cloudflare Pages Functions)
│   ├── api/                # API endpoints
│   └── lib/                # Gemini service & processor
├── schema.sql              # D1 database schema
├── migrations/             # Database migrations
└── wrangler.toml           # Cloudflare configuration
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `GEMINI_API_KEY` | Your Google Gemini API key |

For local development, add to `.dev.vars`. For production, set in Cloudflare Pages dashboard.

> **Note:** The app was renamed from "BananaBatch" to "LightWork". The D1 database (`bananabatch-db`) and R2 bucket (`bananabatch-storage`) retain the original names to preserve existing data and avoid migration.

## Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start Vite dev server (frontend only) |
| `npm run pages:dev` | Start full stack with Pages Functions |
| `npm run build` | Build for production |
| `npm run pages:deploy` | Deploy to Cloudflare Pages |
| `npm run db:migrate` | Apply schema to remote D1 |
| `npm run db:migrate:local` | Apply schema locally |

## Architecture

See [ARCHITECTURE.md](./ARCHITECTURE.md) for detailed technical documentation.

## License

MIT
