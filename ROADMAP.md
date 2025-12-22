# 🚀 LightWork: High-Impact Evolution Roadmap

This roadmap prioritizes 180 tasks across 9 sectors, sorted by their impact on production readiness, user retention, and technical excellence.

---

## 📈 1. MVP Enhancements (Priority: Critical)
*Focus: Stabilizing the core loop and ensuring the "2-Prompt Rule" is bulletproof.*

1. **Robust Polling & State Sync** (High Impact)
   - *Description*: Replace `setInterval` with a recursive `setTimeout` pattern in `useJobPolling`.
   - *Implementation*: Add exponential backoff (starting at 2s, max 30s) and jitter. Ensure the UI reflects "Reconnecting" if the worker is unreachable.
2. **Atomic Job Ingestion** (High Impact)
   - *Description*: Create the Job record in D1 *before* starting R2 uploads.
   - *Implementation*: Update `handleFilesSelected` to call `createJob` immediately. This provides a Job ID for session recovery even if the browser crashes during upload.
3. **Optimized Base64 Pipeline** (High Impact)
   - *Description*: Move image resizing and Base64 encoding to a Web Worker or `OffscreenCanvas`.
   - *Implementation*: Prevent main-thread blocking during large batch uploads (50+ images) to keep the UI responsive.
4. **Refined Prompt Concatenation** (High Impact)
   - *Description*: Improve how Module System Prompts and Image-Specific Prompts are merged.
   - *Implementation*: Use a structured template: `[System Context] \n\n [Image Specific Instructions]`. Ensure no redundant whitespace or conflicting tokens.
5. **Enhanced Error Mapping** (High Impact)
   - *Description*: Surface specific Gemini API errors (Safety, Quota, Model Busy) to the user.
   - *Implementation*: Update `functions/lib/gemini.ts` to catch specific error codes and map them to user-friendly strings in the `images.error_message` column.
6. **Session Recovery 2.0** (Medium Impact)
   - *Description*: Store the entire `AppState` (selected module, model, and staging images) in `localStorage`.
   - *Implementation*: Allow users to resume a "Setup" state if they accidentally close the tab before hitting "Process."
7. **History Pagination** (Medium Impact)
   - *Description*: Load the Projects sidebar in chunks.
   - *Implementation*: Add `limit` and `offset` to the `getJobs` API. Implement an Intersection Observer in the sidebar to load more as the user scrolls.
8. **Staging Grid Cleanup** (Medium Impact)
   - *Description*: Add a "Clear All" and "Remove Selected" functionality to the staging area.
   - *Implementation*: Allow users to prune their batch before ingestion without refreshing the page.
9. **Refined Model Selection** (Medium Impact)
   - *Description*: Make the model toggle (Flash vs Pro) more prominent and descriptive.
   - *Implementation*: Add a "Recommended" badge to Flash for speed and "High Fidelity" to Pro for quality.
10. **Better Download Naming** (Low Impact)
    - *Description*: Ensure ZIP files are named logically (e.g., `LightWork_Food_2025-12-22.zip`).
    - *Implementation*: Update the client-side JSZip logic to use the Module name and current date.
11. **Improved Image Previews** (Low Impact)
    - *Description*: Use a more efficient canvas-based thumbnail generator.
    - *Implementation*: Generate 200px thumbnails for the grid to reduce memory usage compared to full-res `URL.createObjectURL`.
12. **Module Search** (Low Impact)
    - *Description*: Add a quick-filter to the Module Selector.
    - *Implementation*: A simple text input that filters the `modules` array by name or category.
13. **Better Icon Mapping** (Low Impact)
    - *Description*: Expand the `getModuleIcon` helper to support 20+ categories.
    - *Implementation*: Map more keywords (e.g., "Interior", "Fashion", "Macro") to specific Lucide icons.
14. **Visual Prompt Separator** (Low Impact)
    - *Description*: Show where the Module prompt ends in the Image Editor.
    - *Implementation*: A non-editable "System Context" block at the top of the PromptEditor textarea.
15. **Improved Loading States** (Low Impact)
    - *Description*: Add distinct "Uploading...", "Queued...", and "Processing..." badges.
    - *Implementation*: Map the `images.status` and `jobs.status` more granularly in the UI.
16. **Refined Sidebar Layout** (Low Impact)
    - *Description*: Add a "New Project" button clearly at the top.
    - *Implementation*: Ensure the primary action to start over is always visible and doesn't require clearing the current job manually.
17. **Better Tooling** (Low Impact)
    - *Description*: Add a `db:reset` script to `package.json`.
    - *Implementation*: A script that runs `DELETE FROM jobs; DELETE FROM images;` on the local D1 instance.
18. **Improved Types** (Low Impact)
    - *Description*: Tighten TypeScript interfaces between Frontend and Backend.
    - *Implementation*: Use a shared `types.ts` file to ensure `ImageRecord` and `JobRecord` are identical in both environments.
19. **Grid Layout Refinement** (Low Impact)
    - *Description*: Use CSS Grid `auto-fill` for better responsiveness.
    - *Implementation*: Ensure the grid doesn't have awkward gaps on ultra-wide or mobile screens.
20. **Status Badge Contrast** (Low Impact)
    - *Description*: Fix the "ONLINE" badge contrast issue identified in the audit.
    - *Implementation*: Use a darker green background with white text for better accessibility.

---

## ⚙️ 2. Backend Systems (Priority: High)
*Focus: Scalability, security, and cost-optimization.*

1. **Zombie Job Cleanup (Cron)** (High Impact)
   - *Description*: Automatically fail jobs that have been stuck in "PROCESSING" for too long.
   - *Implementation*: Use a Cloudflare Worker Cron Trigger to check for jobs with `updated_at < (now - 1 hour)` and mark them as FAILED.
2. **R2 Signed URLs** (High Impact)
   - *Description*: Generate temporary download links directly from R2.
   - *Implementation*: Stop proxying image data through the Worker. Use the R2 SDK to generate pre-signed URLs with a 1-hour expiry.
3. **D1 Indexing & Query Optimization** (High Impact)
   - *Description*: Speed up polling and history fetching.
   - *Implementation*: Add indexes to `jobs(status, created_at)` and `images(job_id, status)`.
4. **Worker Rate Limiting** (High Impact)
   - *Description*: Prevent API abuse and cost spikes.
   - *Implementation*: Use Cloudflare's native Rate Limiting or a KV-based counter to limit `upload` and `process` calls per IP.
5. **Atomic D1 Transactions** (High Impact)
   - *Description*: Ensure data consistency during status changes.
   - *Implementation*: Use `DB.batch()` for operations that update both a job and its images simultaneously.
6. **R2 Lifecycle Rules** (Medium Impact)
   - *Description*: Automatically delete old assets to save storage.
   - *Implementation*: Configure R2 to delete objects in the `originals/` and `processed/` prefixes after 30 days.
7. **Multipart Upload Support** (Medium Impact)
   - *Description*: Support images larger than 10MB.
   - *Implementation*: Implement the R2 multipart upload flow in the `upload.ts` function.
8. **Structured JSON Logging** (Medium Impact)
   - *Description*: Better observability in Cloudflare Logs.
   - *Implementation*: Replace `console.log` with a `logger` utility that outputs structured JSON (level, message, requestId, jobId).
9. **Database Migration Runner** (Medium Impact)
   - *Description*: Robust schema updates.
   - *Implementation*: Create a script that tracks applied migrations in a `_migrations` table in D1.
10. **Image Optimization Worker** (Medium Impact)
    - *Description*: Generate WebP thumbnails on-the-fly.
    - *Implementation*: Use a dedicated Worker with `canvas` or `wasm-vips` to resize images from R2 for the UI grid.
11. **Health Check Endpoint** (Medium Impact)
    - *Description*: Monitor system uptime.
    - *Implementation*: `/api/health` should verify D1 read/write and R2 connectivity.
12. **CORS Hardening** (Medium Impact)
    - *Description*: Restrict API access.
    - *Implementation*: Set `Access-Control-Allow-Origin` to the specific production domain in `_worker.ts`.
13. **Request ID Tracing** (Low Impact)
    - *Description*: Trace requests across the stack.
    - *Implementation*: Generate a UUID in the entry middleware and attach it to all logs and response headers.
14. **Environment Parity** (Low Impact)
    - *Description*: Segregate dev/prod secrets.
    - *Implementation*: Ensure `wrangler.toml` uses `[env.production]` for production-specific D1 and R2 bindings.
15. **MIME Type Validation** (Low Impact)
    - *Description*: Strict server-side file checks.
    - *Implementation*: Use a library like `file-type` (Wasm) to verify image headers instead of trusting the `Content-Type` header.
16. **Job Priority Queue** (Low Impact)
    - *Description*: Prioritize smaller batches.
    - *Implementation*: Add a `priority` column to `jobs` and update the processing loop to pick up high-priority tasks first.
17. **Redis Caching (Upstash)** (Low Impact)
    - *Description*: Cache module definitions.
    - *Implementation*: Reduce D1 read load by caching the `modules` table in Redis with a 1-hour TTL.
18. **Webhooks** (Low Impact)
    - *Description*: Notify external systems of job completion.
    - *Implementation*: Add a `webhook_url` to the `jobs` table and POST a JSON payload when the status hits COMPLETED.
19. **Parallel Ingestion Optimization** (Low Impact)
    - *Description*: Faster R2 writes.
    - *Implementation*: Use `Promise.all` for R2 `put` operations within the `upload` endpoint.
20. **Atomic Updates for Images** (Low Impact)
    - *Description*: Prevent race conditions during parallel processing.
    - *Implementation*: Use `UPDATE images SET status = 'PROCESSING' WHERE id = ? AND status = 'PENDING'` to ensure only one worker handles an image.

---

## 🧠 3. User Experience (UX) (Priority: High)
*Focus: Reducing friction and making the tool feel "smart."*

1. **Drag-and-Drop Visual Feedback** (High Impact)
   - *Description*: Highlight the canvas when files are hovered.
   - *Implementation*: Use a global `dragover` listener to show a dashed orange border and "Drop to Start" overlay.
2. **Batch Prompting** (High Impact)
   - *Description*: Apply prompts to multiple images at once.
   - *Implementation*: Add checkboxes to the grid images and a "Bulk Edit Prompt" button in the Command Dock.
3. **Keyboard Shortcuts** (High Impact)
   - *Description*: Power-user controls.
   - *Implementation*: `Cmd+Enter` (Start Job), `Esc` (Cancel/Close), `G` (Toggle Grid), `1-4` (Select Module).
4. **Smart Defaults** (High Impact)
   - *Description*: Auto-select the most used Module.
   - *Implementation*: Store the last used `moduleId` in `localStorage` and default to it on next load.
5. **Undo/Redo for Prompts** (Medium Impact)
   - *Description*: Prevent accidental prompt loss.
   - *Implementation*: Use a simple state history stack for the `PromptEditor`.
6. **Error Recovery: Retry Failed** (Medium Impact)
   - *Description*: Don't restart the whole job for one failure.
   - *Implementation*: A "Retry Failed" button that resets only images with `status = 'FAILED'`.
7. **Onboarding Tour** (Medium Impact)
   - *Description*: Guide new users.
   - *Implementation*: A 3-step overlay using `framer-motion` explaining Module vs Image prompts.
8. **Contextual Help Tooltips** (Medium Impact)
   - *Description*: Explain technical choices.
   - *Implementation*: Add "i" icons next to Gemini models explaining token limits and resolution differences.
9. **Download All (ZIP)** (Medium Impact)
   - *Description*: Single-click export.
   - *Implementation*: Use `jszip` to bundle all images with `status = 'COMPLETED'` into one file.
10. **Auto-Save Prompts** (Medium Impact)
    - *Description*: Save as you type.
    - *Implementation*: Debounce `localStorage` writes for the current editing prompt.
11. **Searchable History** (Medium Impact)
    - *Description*: Find old projects quickly.
    - *Implementation*: A search input in the sidebar that filters the `projects` state.
12. **Image Zoom / Lightbox** (Medium Impact)
    - *Description*: Inspect results.
    - *Implementation*: Click an image to open a full-screen modal with zoom/pan capabilities.
13. **Confirmation Dialogs** (Low Impact)
    - *Description*: Prevent accidental deletions.
    - *Implementation*: Use Radix `AlertDialog` for "Delete Project" actions.
14. **Copy Prompt to Clipboard** (Low Impact)
    - *Description*: Use prompts elsewhere.
    - *Implementation*: A "Copy" button in the `PromptEditor`.
15. **Multi-Select Range** (Low Impact)
    - *Description*: `Shift+Click` support.
    - *Implementation*: Track the last selected index to allow range selection in the grid.
16. **Real-time Connectivity Toast** (Low Impact)
    - *Description*: Notify of offline status.
    - *Implementation*: Use `window.addEventListener('offline')` to show a persistent warning.
17. **Module Previews (Before/After)** (Low Impact)
    - *Description*: Show what a module does.
    - *Implementation*: Hovering a module shows a small GIF or split-view of a sample result.
18. **Upload Queue Detail** (Low Impact)
    - *Description*: Transparency during ingestion.
    - *Implementation*: A small popover showing "File 3 of 10 uploading..." with individual progress bars.
19. **Feedback Loop (Rating)** (Low Impact)
    - *Description*: Help tune prompts.
    - *Implementation*: Thumbs up/down on processed images; store results in a `feedback` table.
20. **Mobile Companion View** (Low Impact)
    - *Description*: Check status on the go.
    - *Implementation*: A responsive layout that hides the editor but shows the grid and progress.

---

## 🌊 4. Fluidity & Performance (Priority: Medium)
*Focus: Making the app feel "instant" and premium.*

1. **View Transitions API** (High Impact)
   - *Description*: Seamless morphing between Setup and Processing states.
   - *Implementation*: Wrap state changes in `document.startViewTransition()`.
2. **GPU Accelerated Animations** (High Impact)
   - *Description*: 60fps UI.
   - *Implementation*: Ensure all `framer-motion` props use `x`, `y`, `scale`, and `opacity` (compositor-only).
3. **Virtual Grid (Lazy Loading)** (High Impact)
   - *Description*: Handle 500+ images without lag.
   - *Implementation*: Use `react-window` or `tanstack-virtual` for the `StagingGrid`.
4. **Optimistic UI Updates** (Medium Impact)
   - *Description*: Instant feedback.
   - *Implementation*: Update the local `images` state to 'PROCESSING' immediately when the user clicks "Start."
5. **Wasm Image Compression** (Medium Impact)
   - *Description*: Ultra-fast client-side resizing.
   - *Implementation*: Use `squoosh` or `sharp-wasm` to resize images before upload.
6. **Reduced Bundle Size** (Medium Impact)
   - *Description*: Faster initial load.
   - *Implementation*: Audit `package.json` and use `import type` where possible.
7. **Memoization Audit** (Medium Impact)
   - *Description*: Prevent unnecessary re-renders.
   - *Implementation*: Use `React.memo` for `ImageCard` and `useMemo` for complex grid filtering.
8. **Font Optimization** (Medium Impact)
   - *Description*: Zero layout shift.
   - *Implementation*: Use `font-display: swap` and pre-connect to font origins.
9. **Debounced Inputs** (Medium Impact)
   - *Description*: Smooth typing.
   - *Implementation*: Debounce the `updateImagePrompt` API call by 500ms.
10. **Asset Pre-fetching** (Low Impact)
    - *Description*: Load next images early.
    - *Implementation*: Pre-fetch the first 5 images of the next project in the history list.
11. **Service Worker Caching** (Low Impact)
    - *Description*: Offline project viewing.
    - *Implementation*: Cache API responses for `getJobs` and `getJob` using Workbox.
12. **Reduced Main Thread Work** (Low Impact)
    - *Description*: Keep UI responsive.
    - *Implementation*: Move ZIP generation to a Web Worker.
13. **Efficient State Management** (Low Impact)
    - *Description*: Avoid prop drilling.
    - *Implementation*: Migrate global state (projects, activeJob) to `Zustand`.
14. **Fast Refresh Optimization** (Low Impact)
    - *Description*: Better DX.
    - *Implementation*: Ensure all components are exported as named functions for Vite HMR.
15. **Image Srcset** (Low Impact)
    - *Description*: Save bandwidth.
    - *Implementation*: Provide `thumbnail`, `preview`, and `original` URLs from the backend.
16. **Worker KV for Config** (Low Impact)
    - *Description*: Fast config reads.
    - *Implementation*: Store module definitions in KV for sub-millisecond access.
17. **Minified API Payloads** (Low Impact)
    - *Description*: Smaller JSON.
    - *Implementation*: Use a `fields` query param to return only necessary data.
18. **Brotli Compression** (Low Impact)
    - *Description*: Smaller assets.
    - *Implementation*: Ensure Cloudflare is configured to serve all assets with Brotli.
19. **CSS-in-JS Removal** (Low Impact)
    - *Description*: Static styles only.
    - *Implementation*: Ensure 100% Tailwind coverage; remove any remaining `style={{}}` props.
20. **Skeleton Screen Refinement** (Low Impact)
    - *Description*: Better perceived speed.
    - *Implementation*: Match skeleton shapes exactly to the `ImageCard` layout.

---

## 🎨 5. User Interface (UI) (Priority: Medium)
*Focus: Aesthetics and brand identity.*

1. **Dynamic Glassmorphism** (High Impact)
   - *Description*: Premium backdrop blur.
   - *Implementation*: Use `backdrop-blur-xl` and `bg-white/70` for the Command Dock.
2. **International Orange Accents** (High Impact)
   - *Description*: Brand consistency.
   - *Implementation*: Use `#FF4F00` for primary buttons, progress bars, and active states.
3. **Micro-Interactions** (High Impact)
   - *Description*: Tactile feel.
   - *Implementation*: Add a subtle `whileTap={{ scale: 0.95 }}` to all buttons.
4. **Skeleton States** (Medium Impact)
   - *Description*: Content-aware loading.
   - *Implementation*: Replace the generic spinner with pulsing gray boxes in the grid.
5. **Typography Hierarchy** (Medium Impact)
   - *Description*: Editorial feel.
   - *Implementation*: Use `Manrope` for headings and `Inter` for UI text. Implement a fluid scale.
6. **Custom Scrollbars** (Medium Impact)
   - *Description*: Polished look.
   - *Implementation*: Style `::-webkit-scrollbar` to be thin and match the Luminous Stone palette.
7. **Status Indicators (Live)** (Medium Impact)
   - *Description*: Real-time feel.
   - *Implementation*: A pulsing orange dot next to active jobs in the sidebar.
8. **Image Comparison Slider** (Medium Impact)
   - *Description*: Show value.
   - *Implementation*: A "Before/After" slider component for the lightbox view.
9. **Empty State Illustrations** (Medium Impact)
   - *Description*: Friendly UI.
   - *Implementation*: Custom SVG illustrations for "No Projects Found."
10. **Theme Toggle (Deep Stone)** (Medium Impact)
    - *Description*: Dark mode.
    - *Implementation*: A dark variant of the Luminous Stone theme using `#111827` as the canvas.
11. **Color-Coded Badges** (Low Impact)
    - *Description*: Quick scanning.
    - *Implementation*: Gray (Pending), Orange (Processing), Green (Done), Red (Fail).
12. **Command Dock Transitions** (Low Impact)
    - *Description*: Fluid layout.
    - *Implementation*: Animate the height and width of the dock when switching modes.
13. **Grid Density Toggle** (Low Impact)
    - *Description*: User preference.
    - *Implementation*: Switch between 3-column (Comfortable) and 6-column (Compact) views.
14. **Breadcrumb Navigation** (Low Impact)
    - *Description*: Context awareness.
    - *Implementation*: `Projects > Food Batch #12` at the top of the canvas.
15. **High-Contrast Tooltips** (Low Impact)
    - *Description*: Accessibility.
    - *Implementation*: Use Radix `Tooltip` with a dark background and sharp corners.
16. **Progress Bar Detail** (Low Impact)
    - *Description*: Informative.
    - *Implementation*: Show "4/12 Images Processed" inside the bar.
17. **Custom Module Icons** (Low Impact)
    - *Description*: Unique identity.
    - *Implementation*: A consistent set of 2px stroke icons for all modules.
18. **Custom Focus Rings** (Low Impact)
    - *Description*: Accessibility.
    - *Implementation*: A 2px orange ring with 2px offset for all interactive elements.
19. **Modal Overlays** (Low Impact)
    - *Description*: Consistent entry.
    - *Implementation*: Use a "Slide up from bottom" animation for all dialogs.
20. **Responsive Sidebar Rail** (Low Impact)
    - *Description*: Space efficiency.
    - *Implementation*: Collapse the sidebar to icons-only on screens < 1200px.

---

## 💎 6. Code Quality (Priority: Medium)
*Focus: Maintainability and developer happiness.*

1. **Unit Testing (Vitest)** (High Impact)
   - *Description*: Test core logic.
   - *Implementation*: Add tests for `promptUtils.ts` and `statusMapper.ts`.
2. **Integration Testing (Playwright)** (High Impact)
   - *Description*: Test the happy path.
   - *Implementation*: A script that uploads an image, waits for processing, and checks the result.
3. **Strict TypeScript** (High Impact)
   - *Description*: Prevent bugs.
   - *Implementation*: Enable `noImplicitAny` and `strictNullChecks` in `tsconfig.json`.
4. **Zod Validation** (High Impact)
   - *Description*: Safe API boundaries.
   - *Implementation*: Validate all `req.json()` payloads in Cloudflare Functions.
5. **CI/CD Pipeline** (Medium Impact)
   - *Description*: Automate quality.
   - *Implementation*: GitHub Action to run `lint`, `tsc`, and `test` on every PR.
6. **Component Documentation** (Medium Impact)
   - *Description*: Knowledge sharing.
   - *Implementation*: Use JSDoc for all component props and complex hooks.
7. **Consistent Naming Audit** (Medium Impact)
   - *Description*: Readability.
   - *Implementation*: Ensure all DB fields are `snake_case` and all JS variables are `camelCase`.
8. **Error Boundaries** (Medium Impact)
   - *Description*: Resilience.
   - *Implementation*: Wrap the `StagingGrid` and `Sidebar` in React Error Boundaries.
9. **Modular Worker Structure** (Medium Impact)
   - *Description*: Clean backend.
   - *Implementation*: Split `_worker.ts` into `routes/`, `middleware/`, and `services/`.
10. **Custom Hook Extraction** (Medium Impact)
    - *Description*: Clean components.
    - *Implementation*: Move logic for `useProjects`, `useModules`, and `useImageUpload` out of `Dashboard.tsx`.
11. **API Versioning** (Low Impact)
    - *Description*: Future-proofing.
    - *Implementation*: Prefix all routes with `/api/v1/`.
12. **Centralized Constants** (Low Impact)
    - *Description*: No magic strings.
    - *Implementation*: Move all API URLs and timeout values to `src/lib/constants.ts`.
13. **Shared Types** (Low Impact)
    - *Description*: Single source of truth.
    - *Implementation*: Use a `shared/` folder for types used by both Vite and Wrangler.
14. **Prettier Enforcement** (Low Impact)
    - *Description*: Consistent style.
    - *Implementation*: Add a `.prettierrc` and run it on pre-commit via `husky`.
15. **Security Audit** (Low Impact)
    - *Description*: Safety.
    - *Implementation*: Run `npm audit` and resolve all high-risk vulnerabilities.
16. **Performance Monitoring** (Low Impact)
    - *Description*: Real-world data.
    - *Implementation*: Integrate Sentry for error tracking and performance vitals.
17. **Architecture ADRs** (Low Impact)
    - *Description*: Decision tracking.
    - *Implementation*: Create `docs/adr/001-two-prompt-rule.md` to explain the logic.
18. **Dependency Pruning** (Low Impact)
    - *Description*: Lean project.
    - *Implementation*: Remove unused Radix primitives and dev dependencies.
19. **Standardized Exports** (Low Impact)
    - *Description*: Consistency.
    - *Implementation*: Use named exports exclusively.
20. **Git Squash Policy** (Low Impact)
    - *Description*: Clean history.
    - *Implementation*: Enforce "Squash and Merge" on GitHub.

---

## 🧹 7. Code Cleanup (Priority: Low)
*Focus: Removing technical debt.*

1. **Refactor Dashboard.tsx** (High Impact)
   - *Description*: Break down the 600-line file.
   - *Implementation*: Extract `Sidebar`, `Canvas`, `CommandDock`, and `EditorOverlay` into separate files.
2. **Remove Dead Code** (High Impact)
   - *Description*: Leaner codebase.
   - *Implementation*: Delete unused UI components in `src/components/ui/`.
3. **Standardize Icons** (Medium Impact)
   - *Description*: Visual consistency.
   - *Implementation*: Ensure all icons are imported from `lucide-react` and have consistent sizing.
4. **CSS Variable Consolidation** (Medium Impact)
   - *Description*: Clean styles.
   - *Implementation*: Move all Tailwind 4 variables into a single `:root` block in `index.css`.
5. **Remove Console Logs** (Medium Impact)
   - *Description*: Production readiness.
   - *Implementation*: Use a build-time plugin to strip `console.log` from production.
6. **Standardize API Wrapper** (Medium Impact)
   - *Description*: Clean requests.
   - *Implementation*: Create a `client.ts` that handles base URLs, headers, and error parsing.
7. **Consolidate Migrations** (Medium Impact)
   - *Description*: Clean DB start.
   - *Implementation*: Merge `001` and `002` into a single `initial_schema.sql`.
8. **Audit Package.json** (Low Impact)
   - *Description*: Remove bloat.
   - *Implementation*: Move build tools to `devDependencies`.
9. **Refactor Types** (Low Impact)
   - *Description*: Remove duplicates.
   - *Implementation*: Ensure `Module` and `Job` interfaces are defined only once.
10. **Standardize File Paths** (Low Impact)
    - *Description*: Clean imports.
    - *Implementation*: Use `@/` alias for all internal imports.
11. **Cleanup Public Folder** (Low Impact)
    - *Description*: Remove junk.
    - *Implementation*: Delete unused placeholder images.
12. **Refactor Gemini Logic** (Low Impact)
    - *Description*: Clean AI code.
    - *Implementation*: Move prompt construction into a dedicated `PromptBuilder` class.
13. **Standardize Error Handling** (Low Impact)
    - *Description*: Predictable errors.
    - *Implementation*: Use a custom `AppError` class with status codes.
14. **Cleanup Wrangler Config** (Low Impact)
    - *Description*: Clean config.
    - *Implementation*: Remove commented-out sections in `wrangler.toml`.
15. **Refactor Hooks Cleanup** (Low Impact)
    - *Description*: Prevent leaks.
    - *Implementation*: Ensure all `useEffect` hooks have proper cleanup functions.
16. **Standardize Props Interface** (Low Impact)
    - *Description*: Consistency.
    - *Implementation*: Use `interface` instead of `type` for all component props.
17. **Cleanup Readme** (Low Impact)
    - *Description*: Accurate docs.
    - *Implementation*: Ensure all setup scripts match `package.json`.
18. **Refactor Inline Styles** (Low Impact)
    - *Description*: 100% Tailwind.
    - *Implementation*: Replace any remaining `style={{}}` with Tailwind classes.
19. **Standardize Exports** (Low Impact)
    - *Description*: Consistency.
    - *Implementation*: Use named exports exclusively.
20. **Cleanup Git History** (Low Impact)
    - *Description*: Clean history.
    - *Implementation*: Squash messy development commits.

---

## 🛠️ 8. Quality of Life (QoL) (Priority: Low)
*Focus: Small wins that make users smile.*

1. **Recent Prompts Dropdown** (Medium Impact)
2. **Auto-Naming Projects** (Medium Impact)
3. **Browser Notifications** (Medium Impact)
4. **Dark/Light Auto-Switch** (Medium Impact)
5. **Export Metadata (JSON)** (Low Impact)
6. **Drag-to-Reorder Images** (Low Impact)
7. **Module "Favorites"** (Low Impact)
8. **Estimated Cost/Token Usage** (Low Impact)
9. **Direct Link Sharing** (Low Impact)
10. **Image Metadata Viewer** (Low Impact)
11. **Bulk Delete History** (Low Impact)
12. **Custom User Modules** (Low Impact)
13. **Progressive Image Loading** (Low Impact)
14. **Subtle Sound Effects** (Low Impact)
15. **Auto-Scroll to Active** (Low Impact)
16. **Clipboard Paste Upload** (Low Impact)
17. **Mobile Companion View** (Low Impact)
18. **Multi-Language Support** (Low Impact)
19. **System Status Page** (Low Impact)
20. **Integrated Feedback Widget** (Low Impact)

---

## 🌟 9. New Features (Priority: Low)
*Focus: Expanding the product's capabilities.*

1. **Multi-Model Comparison** (Medium Impact)
2. **AI Inpainting Brush** (Medium Impact)
3. **Video-to-Frames Batch** (Medium Impact)
4. **Style Reference Upload** (Medium Impact)
5. **Collaborative Projects** (Low Impact)
6. **Custom Output Formats** (Low Impact)
7. **Resolution Upscaling (4K)** (Low Impact)
8. **Face Restoration Toggle** (Low Impact)
9. **Background Removal Step** (Low Impact)
10. **Automatic Watermarking** (Low Impact)
11. **API Access Keys** (Low Impact)
12. **Scheduled Processing** (Low Impact)
13. **Smart AI Cropping** (Low Impact)
14. **Color Grading LUTs** (Low Impact)
15. **PDF Contact Sheet Export** (Low Impact)
16. **Cloud Sync (G-Drive)** (Low Impact)
17. **Prompt Template Library** (Low Impact)
18. **Interactive AI Chat Tweak** (Low Impact)
19. **Batch Renaming Patterns** (Low Impact)
20. **Usage Analytics Dashboard** (Low Impact)
