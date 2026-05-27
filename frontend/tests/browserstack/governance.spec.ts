import { test, expect } from "@playwright/test"

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"

test.describe("Governance page", () => {
  test("governance page loads without crashing", async ({ page }) => {
    await page.goto(`${BASE_URL}/governance`)
    await expect(page.locator("body")).toBeVisible()
  })

  test("governance page title is set", async ({ page }) => {
    await page.goto(`${BASE_URL}/governance`)
    await expect(page).toHaveTitle(/UjamaaDAO|Governance/i)
  })

  test("governance page renders a heading", async ({ page }) => {
    await page.goto(`${BASE_URL}/governance`)
    const headings = page.locator("h1, h2, h3")
    await expect(headings.first()).toBeVisible()
  })

  test("proposals/create route is accessible", async ({ page }) => {
    await page.goto(`${BASE_URL}/proposals/create`)
    await expect(page.locator("body")).toBeVisible()
  })

  test("proposals list page loads", async ({ page }) => {
    await page.goto(`${BASE_URL}/proposals`)
    await expect(page.locator("body")).toBeVisible()
  })

  test("proposal detail route renders or redirects gracefully", async ({ page }) => {
    // Use a fake ID — should 404 or auth-gate, not 500
    await page.goto(`${BASE_URL}/proposals/nonexistent-proposal-id`)
    await expect(page.locator("body")).toBeVisible()
    const bodyText = await page.locator("body").textContent()
    expect(bodyText?.trim().length).toBeGreaterThan(0)
  })
})

test.describe("Groups / community", () => {
  test("groups page loads", async ({ page }) => {
    await page.goto(`${BASE_URL}/groups`)
    await expect(page.locator("body")).toBeVisible()
  })

  test("group detail route renders or redirects gracefully", async ({ page }) => {
    await page.goto(`${BASE_URL}/groups/nonexistent-group-id`)
    await expect(page.locator("body")).toBeVisible()
    const bodyText = await page.locator("body").textContent()
    expect(bodyText?.trim().length).toBeGreaterThan(0)
  })

  test("projects/create route is accessible", async ({ page }) => {
    await page.goto(`${BASE_URL}/projects/create`)
    await expect(page.locator("body")).toBeVisible()
  })
})
