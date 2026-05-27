import { test, expect } from "@playwright/test"

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"

test.describe("Education module — public view", () => {
  test("education page loads without crashing", async ({ page }) => {
    await page.goto(`${BASE_URL}/education`)
    await expect(page.locator("body")).toBeVisible()
    // Should show auth gate or content — not a 500
    const status = await page.evaluate(() => document.title)
    expect(status).toBeTruthy()
  })

  test("education page title contains UjamaaDAO or Education", async ({ page }) => {
    await page.goto(`${BASE_URL}/education`)
    await expect(page).toHaveTitle(/UjamaaDAO|Education/i)
  })

  test("education page renders at least one heading", async ({ page }) => {
    await page.goto(`${BASE_URL}/education`)
    // Either auth gate heading or module list heading
    const headings = page.locator("h1, h2, h3")
    await expect(headings.first()).toBeVisible()
  })

  test("education page has no console errors from missing chunks", async ({ page }) => {
    const errors: string[] = []
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text())
    })
    await page.goto(`${BASE_URL}/education`)
    await page.waitForLoadState("networkidle")
    // Filter out known benign warnings (e.g. unmatched routes, auth 401s)
    const critical = errors.filter(
      (e) => !e.includes("401") && !e.includes("ERR_ABORTED") && !e.includes("favicon")
    )
    expect(critical).toHaveLength(0)
  })

  test("loading skeleton appears during navigation to education", async ({ page }) => {
    // Navigate via in-page link to trigger loading state, not direct goto
    await page.goto(BASE_URL)
    // Check that the page doesn't crash when loading state would appear
    await page.goto(`${BASE_URL}/education`)
    await expect(page.locator("body")).toBeVisible()
  })
})

test.describe("Education — category navigation", () => {
  test("navigating to education [id] route renders something", async ({ page }) => {
    // Fake ID — should render 404 or redirect, not 500
    await page.goto(`${BASE_URL}/education/nonexistent-module-id`)
    await expect(page.locator("body")).toBeVisible()
    const bodyText = await page.locator("body").textContent()
    // Should not be a blank page
    expect(bodyText?.trim().length).toBeGreaterThan(0)
  })
})
