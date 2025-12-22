# LightWork - Technical Architecture (V4)

> **Design System:** Cinematic Utility  
> **Engine:** Parallel Serverless Processing

## 1. Design Philosophy: "Cinematic Utility"

LightWork V4 abandons generic SaaS aesthetics for a tool-first design language inspired by professional creative software (Linear, Arc, Lightroom).

### Core Pillars
1.  **Fixed Workspace:** No global scrolling. The app behaves like a desktop application with a fixed sidebar and scrollable internal canvas.
2.  **Luminous Stone:** A palette built on `#F3F4F6` (Stone) and `#FFFFFF` (Paper) with `#FF4F00` (International Orange) for critical actions.
3.  **Object Permanence:** Elements don't just appear; they slide, scale, and spring into place using physics-based transitions.
4.  **Information Density:** High-contrast typography (**Manrope** Display + **Inter** UI) allows for dense information packing without visual clutter.

---

## 2. Frontend Architecture

### Layout Structure
```
┌────────────────────┬───────────────────────────────────────────────┐
│  SIDEBAR (Fixed)   │  MAIN STAGE (Flex / Scrollable)               │
│                    │                                               │
│  ┌──────────────┐  │  ┌─────────────────────────────────────────┐  │
│  │ Logo & Brand │  │  │  Top Bar (Context / Breadcrumbs)        │  │
│  └──────────────┘  │  └─────────────────────────────────────────┘  │
│                    │                                               │
│  ┌──────────────┐  │  ┌─────────────────────────────────────────┐  │
│  │ Module List  │  │  │                                         │  │
│  │ (Navigation) │  │  │  DropZone / Staging Grid                │  │
│  │              │  │  │  (The Canvas)                           │  │
│  └──────────────┘  │  │                                         │  │
│                    │  └─────────────────────────────────────────┘  │
│  ┌──────────────┐  │                                               │
│  │ Status / Ver │  │        [ Floating Command Dock ]              │
│  └──────────────┘  │                                               │
└────────────────────┴───────────────────────────────────────────────┘
```

### Key Components
| Component | Responsibility |
|-----------|----------------|
| `Dashboard.tsx` | App Shell. Manages split-screen layout, global state, and session recovery. |
| `DropZone.tsx` | "Resting state" of the canvas. Ingests files with drag-and-drop physics. |
| `StagingGrid.tsx` | Active state of the canvas. Displays images, status, and results. |
| `CommandCenter.tsx` | Floating Dock. Houses primary actions: Launch, Cancel, Save All. |
| `ModuleSelector.tsx` | Sidebar navigation for selecting AI workflows. |
| `PromptEditor.tsx` | Modal/Sheet for editing module system prompts and per-image instructions. |

---

## 3. Backend Architecture (Cloudflare Pages Functions)

The backend is engineered to survive the harsh constraints of the Cloudflare Workers environment (128MB RAM, 100ms CPU / 100s Wall Time).

### The "2-Prompt" Rule
To ensure professional precision and avoid "prompt drift," LightWork enforces a strict 2-prompt composition:
1.  **Module Prompt:** The base instruction set for the workflow (e.g., "Food Enhancer"). This is editable by the user to tune the overall behavior.
2.  **Image Prompt:** Optional, per-image instructions that are **appended** to the module prompt for specific refinements.

*Note: The legacy "Global Job Prompt" has been removed to simplify the mental model and ensure predictable results.*

### The "Indestructible" Pipeline

1.  **Concurrency Control:**
    *   **Old:** Sequential loop (Timeout Risk 🚨).
    *   **New:** `Promise.allSettled` with `MAX_CONCURRENCY = 2`.
    *   **Why?** Ensures total request time is driven by the *slowest* image (~8s), not the sum of all images (~40s).

2.  **Memory Optimization:**
    *   **Problem:** `fetch` + `base64` + `JSON` for 10MB images explodes memory usage > 128MB.
    *   **Solution:** Custom Linear-Time Base64 Encoder ($O(N)$) in `gemini.ts` avoids string concatenation garbage collection spikes.

3.  **Resiliency ("Zombie Cleanup"):**
    *   Serverless workers can crash silently (OOM, eviction).
    *   **Strategy:** Every `processImages` call checks for items stuck in `PROCESSING` state for > 5 minutes and resets them to `PENDING`.

### Data Model (D1 SQLite)

```sql
-- Jobs: The Container (Projects)
CREATE TABLE jobs (
  id TEXT PRIMARY KEY,
  module_id TEXT NOT NULL,
  model TEXT DEFAULT 'nano_banana', -- 'nano_banana' or 'nano_banana_pro'
  status TEXT,                      -- PENDING, PROCESSING, COMPLETED, FAILED, CANCELLED
  ...timestamps
);

-- Images: The Units of Work
CREATE TABLE images (
  id TEXT PRIMARY KEY,
  job_id TEXT,
  original_key TEXT,    -- R2 Path
  processed_key TEXT,   -- R2 Path
  status TEXT,          -- PENDING, PROCESSING, COMPLETED, FAILED, RETRY_LATER
  specific_prompt TEXT, -- Per-image instructions
  retry_count INTEGER,
  next_retry_at INTEGER -- Exponential Backoff
);
```

---

## 4. Operational Workflows

### Immediate Ingestion
Unlike traditional batch tools that wait for a "Submit" button, LightWork begins work immediately:
1.  **Upload:** Dropping files creates a `PENDING` job and uploads originals to R2 instantly.
2.  **Staging:** Images appear in the grid with local previews while remote records are established.
3.  **Refinement:** Users can edit the module prompt or add per-image instructions *before* launching the batch.

### Batch Processing Loop
The system uses a "Client-Side Pulse" instead of a true background worker (due to Pages limitations).

1.  **Frontend:** `useJobPolling` hook fires every 3s.
2.  **Check:** "Is job processing?" -> Yes.
3.  **Trigger:** `POST /api/process`.
4.  **Backend:**
    *   DB: `UPDATE images SET status='PROCESSING' LIMIT 2 ... RETURNING *` (Atomic Claim).
    *   R2: Fetch 2 images.
    *   Gemini: Generate 2 results parallel using the **2-Prompt Rule**.
    *   R2: Save results.
    *   DB: Update status to `COMPLETED`.
    *   Return: `{ processed: 2 }`.
5.  **Repeat:** Client sees success, fires next pulse immediately.

This architecture allows "infinite" batch sizes on a serverless platform by breaking the work into atomic, stateless chunks.