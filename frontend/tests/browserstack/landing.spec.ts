import { test, expect } from "@playwright/test"

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"

test.describe("Landing page", () => {
  test("loads and shows hero section", async ({ page }) => {
    await page.goto(BASE_URL)
    await expect(page).toHaveTitle(/Ujamaa/i)
    await expect(page.locator("h1")).toBeVisible()
  })

  test("Sign In link navigates to auth", async ({ page }) => {
    await page.goto(BASE_URL)
    await page.getByRole("link", { name: /sign in/i }).click()
    await expect(page).toHaveURL(/auth/)
  })
})

test.describe("Auth flow", () => {
  test("magic link form is present", async ({ page }) => {
    await page.goto(`${BASE_URL}/auth/callback`)
    await expect(page.getByRole("textbox", { name: /email/i })).toBeVisible()
  })
})

test.describe("PWA basics", () => {
  test("manifest is served", async ({ page }) => {
    const res = await page.request.get(`${BASE_URL}/manifest.json`)
    expect(res.status()).toBe(200)
    const json = await res.json()
    expect(json.name).toBeTruthy()
  })
})
