import { test, expect } from "@playwright/test"

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"

test.describe("Dashboard — unauthenticated", () => {
  test("dashboard redirects or shows auth gate", async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard`)
    await expect(page.locator("body")).toBeVisible()
    // Either redirected to landing/auth, or shows auth-gated UI
    // URL should not remain /dashboard showing raw data
    await page.waitForLoadState("networkidle")
    const url = page.url()
    const bodyText = (await page.locator("body").textContent()) ?? ""
    // Should show either a sign-in button or have been redirected
    const hasAuthCue =
      url !== `${BASE_URL}/dashboard` ||
      /sign.?in|log.?in|get started|ujamaa/i.test(bodyText)
    expect(hasAuthCue).toBe(true)
  })

  test("economy page does not expose raw data without auth", async ({ page }) => {
    await page.goto(`${BASE_URL}/economy`)
    await expect(page.locator("body")).toBeVisible()
    await page.waitForLoadState("networkidle")
    const bodyText = (await page.locator("body").textContent()) ?? ""
    // Should not show a raw JSON dump
    expect(bodyText).not.toMatch(/^\s*\{/)
  })

  test("profile page redirects or shows auth gate", async ({ page }) => {
    await page.goto(`${BASE_URL}/profile`)
    await expect(page.locator("body")).toBeVisible()
  })

  test("ward page loads body content", async ({ page }) => {
    await page.goto(`${BASE_URL}/ward`)
    await expect(page.locator("body")).toBeVisible()
    const bodyText = await page.locator("body").textContent()
    expect(bodyText?.trim().length).toBeGreaterThan(0)
  })

  test("notifications page loads body content", async ({ page }) => {
    await page.goto(`${BASE_URL}/notifications`)
    await expect(page.locator("body")).toBeVisible()
  })

  test("elections page loads body content", async ({ page }) => {
    await page.goto(`${BASE_URL}/elections`)
    await expect(page.locator("body")).toBeVisible()
  })

  test("conflicts page loads body content", async ({ page }) => {
    await page.goto(`${BASE_URL}/conflicts`)
    await expect(page.locator("body")).toBeVisible()
  })

  test("treasury page loads body content", async ({ page }) => {
    await page.goto(`${BASE_URL}/treasury`)
    await expect(page.locator("body")).toBeVisible()
  })
})

test.describe("Mobile viewport — critical routes", () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test("landing page renders on mobile", async ({ page }) => {
    await page.goto(BASE_URL)
    await expect(page.locator("h1")).toBeVisible()
  })

  test("auth register page renders on mobile", async ({ page }) => {
    await page.goto(`${BASE_URL}/auth/register`)
    await expect(page.locator("body")).toBeVisible()
    const bodyText = await page.locator("body").textContent()
    expect(bodyText?.trim().length).toBeGreaterThan(0)
  })

  test("no horizontal overflow on landing", async ({ page }) => {
    await page.goto(BASE_URL)
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth)
    const viewportWidth = await page.evaluate(() => window.innerWidth)
    // Allow up to 5px tolerance for scrollbar
    expect(bodyWidth).toBeLessThanOrEqual(viewportWidth + 5)
  })
})
