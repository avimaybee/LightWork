# PRD: BananaBatch v0.1 (The "Set & Forget" Engine)

## 1. System Vision & Logic

BananaBatch is not just an editor; it is a batch-processing pipeline. The "Autonomous" nature is achieved by shifting the responsibility of execution from the User to a Persistent Worker. Even if the user closes their browser, the Cloudflare/Python backend continues to churn through the 7-request-per-minute queue until the job is done.

### Model

This project uses the **`gemini-2.5-flash-image`** model (also known as **"Nano Banana"**).

---

## 2. The "Workflow Module" Architecture

To achieve modularity, each workflow is defined as a **JSON Schema**. Adding a new workflow requires zero code changes to the UI—only adding a new entry to the `modules.json` file.

### Module Schema Definition

| Field                    | Type                                         | Required | Description                                                              |
| :----------------------- | :------------------------------------------- | :------- | :----------------------------------------------------------------------- |
| `id`                     | `string`                                     | Yes      | A unique, kebab-case identifier (e.g., `food-pro-enhancer`).             |
| `name`                   | `string`                                     | Yes      | The human-readable display name for the UI.                              |
| `icon`                   | `string`                                     | Yes      | The name of a Lucide icon (e.g., `Utensils`, `Sparkles`).               |
| `system_instruction`     | `string`                                     | Yes      | The core prompt sent to Gemini defining the AI's persona and task.       |
| `parameters`             | `object`                                     | Yes      | An object containing output settings.                                    |
| `parameters.aspect_ratio`| `enum` (`1:1`, `16:9`, `9:16`, `4:3`, `3:4`) | Yes      | The output aspect ratio for the generated image.                         |
| `parameters.output_format`| `enum` (`webp`, `png`, `jpeg`)              | Yes      | The output file format.                                                  |
| `user_prompt_placeholder`| `string`                                     | No       | Placeholder text for the optional per-image user prompt field.           |

### Module Schema Example

```json
{
  "id": "food-pro-enhancer",
  "name": "Gourmet Plating",
  "icon": "Utensils",
  "system_instruction": "You are a professional food stylist. Enhance the lighting to be warm, increase saturation of natural colors, and ensure the background is slightly out of focus.",
  "parameters": {
    "aspect_ratio": "1:1",
    "output_format": "webp"
  },
  "user_prompt_placeholder": "e.g., Make it look like a rustic Italian dinner"
}
```

---

## 3. The Autonomous "Engine" (Logic Flow)

The engine operates on a **Single-Worker Queue** to strictly honor the 7 RPM limit.

### The "Throttle & Retry" Loop

1.  **Polling**: The Python worker checks the Database (D1) for the next `PENDING` image.
2.  **Rate Limit Guard**: The worker calculates the time since the last request. If < 8.6 seconds (60s / 7 requests), it sleeps until the window clears.
3.  **Execution**: Sends the image + System Prompt + Global Prompt + Individual Prompt to Gemini (`gemini-2.5-flash-image`).
4.  **Success State**: Image is saved to Cloudflare R2; status updated to `COMPLETED`.
5.  **Overload State (503/429)**:
    *   Worker logs a "Model Breath" event.
    *   Status set to `COOLDOWN`.
    *   System pauses for 65 seconds.
    *   Retries the same image.
6.  **Hard Failure State**: After 3 failed attempts, the image is marked `FAILED` and moved to the end of the queue for a final pass.

---

## 4. Technical Stack & Infrastructure (Cloudflare-Centric)

| Component      | Technology                   | Purpose                                                     |
| :------------- | :--------------------------- | :---------------------------------------------------------- |
| Frontend       | React, Tailwind, Shadcn UI   | The staging area and progress dashboard.                    |
| Orchestrator   | FastAPI (Python)             | Handles the logic, queue management, and Gemini API calls.  |
| Database       | Cloudflare D1                | Stores Job IDs, Image metadata, and Status.                 |
| Object Storage | Cloudflare R2                | Stores the raw uploaded images and the generated results.   |
| Deployment     | Cloudflare Pages/Workers     | High-speed, global edge hosting for the frontend.           |
| Task Queue     | FastAPI Background Tasks     | Lightweight queue to process images without blocking the API. |

---

## 5. UI/UX Specifications (The Dashboard)

### A. The "Staging" Grid

*   **Multi-Select**: Shift-click to apply a specific prompt to 10 images at once.
*   **Visual Status Badges**:
    *   `Waiting`: Grey outline.
    *   `Processing`: Pulsing Yellow (Banana) outline.
    *   `Success`: Green checkmark.
    *   `Retrying`: Amber clock icon.
*   **Comparison Slider**: On `COMPLETED` images, hover to see a Before/After "split-screen" slider.

### B. The "Command Center" (Sidebar)

*   **Module Dropdown**: Select from your JSON-defined workflows.
*   **Aspect Ratio Selector**: Allows overriding the module's default aspect ratio for the current job.
*   **Global Prompt Box**: A large text area for instructions that apply to the whole batch.
*   **Estimated Time to Completion (ETC)**: A live countdown (e.g., "14 images left ~ 2.5 minutes").
*   **API Health Meter**: Shows real-time RPM usage (0/7).

---

## 6. Data Persistence & "Set & Forget"

To ensure the app is truly autonomous:

*   **Job IDs**: When a user uploads a batch, they are assigned a unique **UUID v4** Job ID, stored in D1 and client `LocalStorage`.
*   **Session Recovery**: If the user refreshes or returns later, the app checks `LocalStorage` for a Job ID. If found, it pulls the current state from the DB.
*   **Notification (Optional)**: A simple browser "Push Notification" can trigger when the Job Status in D1 reaches 100% completion.

---

## 7. The "Save" Strategy (Manual Export)

Per your requirement, images are not saved to the local machine automatically (to prevent clutter).

*   **The "Vault"**: Processed images live in Cloudflare R2 for 24 hours.
*   **The Export Button**:
    *   **Download Zip**: Triggers a **Python Worker (FastAPI endpoint)** to create a `.zip` archive containing all `COMPLETED` images from R2 and streams it to the user.
    *   **Clean Up**: Once the user downloads or clicks "Clear Job," the R2 bucket and D1 records for that Job ID are purged to save space.

---

## 8. Failure Recovery Scenarios

| Scenario                 | System Response                                                                 |
| :----------------------- | :------------------------------------------------------------------------------ |
| Google API 429           | Pause all processing for 65 seconds. UI shows "Model Overloaded - Resting..."  |
| Internet Connection Lost | The Python backend (on the server) continues processing. User sees updated progress upon reconnection. |
| Image Policy Violation   | Gemini might refuse an image. The system marks it as `REFUSED (Safety)` and moves to the next. |
| Browser Crash            | The queue is in the DB. Simply reopen the app to see the progress.              |

---

## 9. Implementation Roadmap for v.0.1

1.  **Infrastructure Setup**: Link Cloudflare D1 and R2 to the FastAPI backend.
2.  **The "Banana Worker"**: Develop the Python loop that respects the 8.6-second delay (7 RPM).
3.  **JSON Workflow Parser**: Build the logic that injects Module instructions into the Gemini prompt.
4.  **React Dashboard**: Build the grid-based staging area with Shadcn.
5.  **Final Polish**: Implement the "Download as ZIP" functionality.

---

This PRD creates a robust, professional-grade tool that feels like a high-end automation suite while operating entirely within the free ecosystem.