# ✨ LightWork

> **Cinematic Utility AI Image Processor**  
> High-fidelity batch image refinement using Google's Gemini Multimodal models.

LightWork is a professional-grade workspace designed for photographers, retouchers, and creative directors. It bridges the gap between raw generative AI and structured asset workflows, allowing for consistent, high-volume image enhancement without the "slot machine" randomness of typical AI tools.

## Core Capabilities

### ⚡ Batch Intelligence
Stop prompting one image at a time. LightWork uses a **Global Context** system (Modules) to apply consistent art direction across entire photoshoots. Define your "System Context" once, and process hundreds of assets with unified lighting, color grading, and composition rules.

### 🎛️ Specialized Modules
The application comes equipped with engineered presets for commercial photography workflows:
- **Food**: Plating enhancement, "Golden Hour" relighting, and macro sharpening.
- **Product**: E-commerce studio cleanup, infinite white backgrounds, and material synthesis.
- **Real Estate**: "Flambient" blending simulation, vertical straightening, and virtual staging.
- **Portrait**: Frequency separation simulation and studio lighting reconstruction.

### 🚀 Dual-Engine Processing
- **FAST Mode**: Powered by `gemini-2.5-flash-image`. Near-instant feedback for composition and lighting checks.
- **PRO Mode**: Powered by `gemini-3-pro-image-preview`. Maximum resolution, complex reasoning, and "thinking" capabilities for difficult restoration tasks.

### 🔍 Precision Inspector
- **Smart Rename**: Auto-generate SEO-friendly filenames based on image content using vision analysis.
- **Magic Polish**: AI-enhanced prompt refinement to convert rough ideas into technical instructions.
- **Comparison View**: Professional split-slider (A/B) to verify pixel-level changes against the original source.

## Architecture

LightWork is built on a modern, serverless stack designed for edge performance and data security:

- **Frontend**: React 19 + Tailwind CSS (deployed on Cloudflare Pages).
- **Backend**: Cloudflare Functions (Edge Workers) for secure API proxying.
- **Database**: Cloudflare D1 (SQLite at the edge) for persistent job state and metadata.
- **Storage**: Cloudflare R2 (S3-compatible) for secure, low-latency asset hosting.
- **AI**: Google GenAI SDK integration with Gemini 2.5 and 3.0 models.

---

*Designed for speed, built for fidelity.*