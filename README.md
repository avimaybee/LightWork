# ✨ LightWork

> **Cinematic Utility AI Image Processor**  
> Professional-grade batch image refinement powered by Google's Gemini Multimodal models and Cloudflare's Edge architecture.

LightWork is a high-fidelity workspace designed for photographers, retail brands, and creative directors. It bridges the gap between raw generative AI and structured asset pipelines, allowing for consistent, high-volume image enhancement without the unpredictability of consumer AI tools.

## ⚡ Core Capabilities

### 🍱 Batch Intelligence (Modules)
LightWork uses a **Global Context** system called Modules to apply consistent art direction across entire photoshoots. Define your "System Prompt" once, and process hundreds of assets with unified lighting, color grading, and composition rules.
- **Specialized Presets**: Engineered modules for Food, Product, Portrait, and Real Estate workflows.
- **Custom Modules**: Create and save your own art direction logic to the database for future sessions.

### 🔍 The Precision Inspector
Detailed management for single and multi-selection workflows:
- **Magic Polish**: AI-enhanced prompt refinement to convert rough ideas into technical lighting and composition instructions.
- **Auto-Draft**: Visual analysis of source images to generate base descriptions and editing starting points.
- **Smart Rename**: High-fidelity vision analysis to generate SEO-friendly, descriptive filenames.
- **Comparison View**: Professional lightbox with split-view capabilities to verify pixel-level changes.

### 🚀 Performance & Scale
- **Dual-Engine Processing**:
  - **FAST Mode**: Powered by `gemini-2.5-flash-image` for rapid turnaround and composition checks.
  - **PRO Mode**: Powered by `gemini-3-pro-image-preview` for maximum resolution and complex reasoning.
- **Edge Efficiency**: Client-side image compression reduces token consumption by ~90%, ensuring speed even on limited connections.
- **Rate-Limit Intelligence**: Built-in backoff logic and request spacing to maximize throughput on Google's AI infrastructure.

## 🛠️ Tech Stack

Built on a modern, serverless architecture for maximum performance and cost-efficiency:

- **Frontend**: [React 19](https://react.dev/) + [Tailwind CSS](https://tailwindcss.com/) + [Lucide Icons](https://lucide.dev/).
- **API Layers**: [Cloudflare Pages Functions](https://developers.cloudflare.com/pages/framework-guides/deploy-a-full-stack-site/) (Edge-side TypeScript).
- **Persistent State**: [Cloudflare D1](https://developers.cloudflare.com/d1/) (SQLite at the edge) for projects, jobs, and custom modules.
- **Asset Storage**: [Cloudflare R2](https://developers.cloudflare.com/r2/) (S3-compatible) for secure, low-latency image hosting.
- **AI Engine**: [Google Gemini SDK](https://ai.google.dev/) (2.5 & 3.0 Multimodal models).

## 📂 Project Structure

```text
/
├── components/          # React UI Components (Sidebar, Inspector, CommandDock)
├── functions/           # Cloudflare Pages API Endpoints (D1/R2 Logic)
│   └── api/             # RESTful API (Jobs, Modules, Projects, Process)
├── services/            # Frontend API & Gemini abstraction layers
├── src/                 # Main application entry and global styles
├── types.ts             # Unified TypeScript definitions
└── schema.sql           # Database schema for D1 initialization
```

---

*Designed for speed, built for fidelity.*