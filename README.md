# ✨ LightWork

> **Cinematic Utility AI Image Processor**  
> High-fidelity batch image refinement using Google's Gemini Nano Banana models.

![LightWork V4 Interface](https://placehold.co/1200x675/F3F4F6/111827?text=LightWork+V4+Interface)

LightWork is a professional-grade batch processing tool designed for speed and precision. It leverages a modern "Cinematic Utility" aesthetic to provide a focused, distraction-free environment for enhancing hundreds of images at once.

## 🚀 Key Features

### 🎨 Cinematic Utility UI
- **Split-Screen Workspace:** Dedicated sidebar for navigation and a massive canvas for asset management.
- **Luminous Stone Theme:** A sophisticated palette of warm grays (#F3F4F6), crisp whites, and "International Orange" (#FF4F00) accents.
- **Projects History:** A persistent sidebar list of previous batches, allowing for seamless session recovery and result review.
- **Glassmorphic Command Dock:** A floating control center that keeps your workspace clutter-free.
- **Fluid Motion:** Spring-physics based animations for a premium feel.

### ⚡ Production-Grade Engine
- **2-Prompt Rule:** Simplified prompt composition using only Module-level and Image-level instructions for maximum precision.
- **Immediate Ingestion:** Jobs are created and images are uploaded to R2 as soon as they are dropped, enabling faster workflows.
- **Parallel Processing:** Handles images concurrently using `Promise.allSettled` to beat serverless timeouts.
- **Smart Concurrency:** Adaptive batch sizing (2 images) to stay within 128MB memory limits.
- **Resilient Architecture:** "Zombie Job" detection automatically recovers stalled tasks if a worker crashes.

### 🧠 AI Capabilities
- **Fast Mode (Nano Banana):** High-throughput, cost-effective processing for drafts.
- **Pro Mode (Nano Banana Pro):** Maximum fidelity up to 4K resolution for final delivery.
- **Specialized Modules:** Pre-tuned workflows for Food, Product, Portrait, and Real Estate.

## 🛠️ Tech Stack

- **Frontend:** React 19, TypeScript, Tailwind CSS, Lucide Icons
- **Design System:** Custom "Cinematic Utility" tokens (Manrope/Inter fonts)
- **Backend:** Cloudflare Pages Functions (Serverless)
- **Database:** Cloudflare D1 (SQLite)
- **Storage:** Cloudflare R2 (Object Storage)
- **AI Provider:** Google Gemini API (Gemini 2.5 Flash Image)

## 🏁 Quick Start

### Prerequisites
- Node.js 18+
- Cloudflare Account (Workers, D1, R2 enabled)
- Google Gemini API Key

### Local Setup

```bash
# 1. Clone & Install
git clone https://github.com/your-username/lightwork.git
cd lightwork
npm install

# 2. Configure Environment
cp .dev.vars.example .dev.vars
# Add your GEMINI_API_KEY to .dev.vars

# 3. Initialize Database (Crucial!)
npm run db:migrate:local

# 4. Start Development Server
npm run pages:dev
```

Visit `http://localhost:8788` to launch the app.

### Deployment

```bash
# Deploy to Cloudflare Pages
npm run pages:deploy
```

## 📐 Architecture

LightWork uses an **on-demand, client-driven** processing model to circumvent serverless execution limits.

1.  **Ingestion:** User drops files -> Uploads to R2 -> Creates 'PENDING' records in D1.
2.  **Orchestration:** Client polls status -> Triggers `/api/process` endpoint if items are pending.
3.  **Execution:**
    *   `/api/process` claims a batch of images (atomic DB lock).
    *   Images are processed in **parallel** (limited concurrency).
    *   Results are streamed back to R2.
    *   Status updated to 'COMPLETED'.
4.  **Recovery:** If a worker dies, the "Zombie Cleanup" logic resets stuck images after 5 minutes.

See [ARCHITECTURE.md](./ARCHITECTURE.md) for deep technical details.

## 📄 License

MIT © 2025 LightWork