import { defineConfig, devices } from "@playwright/test"

export default defineConfig({
  testDir: "./tests/browserstack",
  timeout: 30000,
  retries: 1,
  use: {
    baseURL: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  // Local browser runs (no BrowserStack)
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile-chrome", use: { ...devices["Pixel 7"] } },
  ],
})
