# BananaBatch 🍌

A "Set & Forget" batch image processing pipeline powered by **Gemini 2.5 Flash Image**.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React + Vite + TypeScript + Shadcn UI |
| Backend | Cloudflare Python Workers + FastAPI |
| Database | Cloudflare D1 (SQLite at edge) |
| Storage | Cloudflare R2 (S3-compatible) |

## Prerequisites

- Node.js 18+
- Python 3.12+
- Wrangler CLI

## Quick Start

### 1. Install Wrangler CLI

```bash
npm install -g wrangler
wrangler login
```

### 2. Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

### 3. Backend Setup

```bash
cd backend

# Create .dev.vars for local development
echo "GEMINI_API_KEY=your_api_key_here" > .dev.vars

# Run locally
wrangler dev
```

### 4. Create Cloudflare Resources

```bash
# Create D1 database
wrangler d1 create bananabatch-db

# Create R2 bucket
wrangler r2 bucket create bananabatch-storage
```

Update `backend/wrangler.toml` with the returned database ID.

## Project Structure

```
BananaBatch/
├── frontend/          # React + Vite dashboard
├── backend/           # Cloudflare Python Workers API
├── .Agent/            # Agent skills & workflows
└── Docs/              # PRD and documentation
```

## Rate Limits

- **Gemini API**: 7 RPM → 8.6 second minimum interval
- **Cooldown on 429/503**: 65 seconds pause
- **Max retries**: 3 per image

## License

MIT
