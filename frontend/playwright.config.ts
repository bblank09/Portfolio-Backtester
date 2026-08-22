import { defineConfig, devices } from "@playwright/test";

// The production build (frontend/dist) is served directly by the FastAPI
// backend on a single origin -- the same setup used in the real Docker
// deployment (see backend/app/main.py's static-serving block) -- rather than
// through Vite's dev server. Run `npm run build` before `npm run test:e2e`.
//
// The second test ("URL updates with a shareable run id...") was previously
// documented here as an unresolved CDP paint-timing flake. That diagnosis
// was wrong: it was a real race in BacktestWorkspace.tsx. Opening a shared
// `?run=` link starts two independent fetches -- the full funds list and
// the one saved run -- and PortfolioStep's "seed two example funds on first
// load" convenience effect fired as soon as the (much larger, slower) funds
// list resolved, regardless of whether a shared run had already loaded. Its
// onAssetsChange call routes through updateRequest(), which unconditionally
// clears `result` -- wiping out the just-loaded shared run. Since the funds
// list reliably takes longer than fetching one run, this lost the race
// almost every time rather than being genuinely flaky. Fixed by passing
// `skipAutoSeed` down to PortfolioStep when the page was opened as a shared
// link (see BacktestWorkspace.tsx).
export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  fullyParallel: false,
  retries: 2,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:8001",
    trace: "retain-on-failure"
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] }
    }
  ],
  webServer: {
    command: "python3 -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8001",
    url: "http://127.0.0.1:8001/api/health",
    reuseExistingServer: true,
    cwd: "..",
    timeout: 30_000
  }
});
