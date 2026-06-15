import { defineConfig, devices } from "@playwright/test"

// Local-only config for the cross-geography bug sweep (not BrowserStack).
export default defineConfig({
  testDir: "./tests/sweep",
  timeout: 240000,
  retries: 0,
  workers: 1, // sequential — the tests share seeded posts/state
  use: {
    baseURL: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
    trace: "retain-on-failure",
    screenshot: "on",
    video: "retain-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile-chrome", use: { ...devices["Pixel 7"] } },
  ],
})
