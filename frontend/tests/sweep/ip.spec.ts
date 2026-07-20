import { test, expect, type APIRequestContext, type Page } from "@playwright/test"

// Impact-points check: an active user (sim.njeri, 220 global IP) — does the UI
// show their ward/constituency/county reputation, or is it empty?
const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1"

async function login(page: Page, request: APIRequestContext, email: string, path: string) {
  const res = await request.post(`${API}/auth/dev/login`, { data: { email } })
  const t = (await res.json()).data.accessToken
  const uid = JSON.parse(Buffer.from(t.split(".")[1], "base64").toString()).sub
  await page.addInitScript(({ tok, id }) => {
    localStorage.setItem("access_token", tok as string)
    localStorage.setItem(`ujamaa_wizard_seen_${id}`, "1")
    localStorage.setItem(`ca_seen_${id}`, "1")
  }, { tok: t, id: uid })
  await page.goto(path)
  await page.waitForLoadState("networkidle")
  await page.addStyleTag({ content: ".driver-overlay,.driver-popover{display:none !important;pointer-events:none !important}" })
  await page.keyboard.press("Escape").catch(() => {})
}

test("active user's reputation is shown in the UI", async ({ page, request }) => {
  // Dashboard: topbar should show the global IP chip (220).
  await login(page, request, "sim.njeri@kayole.test", "/dashboard")
  await page.waitForTimeout(1500)
  await page.screenshot({ path: "test-results/ip-dashboard-topbar.png", fullPage: false })

  // Profile → Activity tab: the Ward Reputation / hierarchy card.
  await login(page, request, "sim.njeri@kayole.test", "/profile")
  await page.getByRole("button", { name: /Activity/i }).first().click().catch(() => {})
  await page.waitForTimeout(1500)
  await page.screenshot({ path: "test-results/ip-profile-activity.png", fullPage: true })

  const body = (await page.locator("body").innerText()).replace(/\s+/g, " ")
  console.log("\n=== PROFILE TEXT (IP-relevant) ===")
  for (const line of body.split(" ")) { /* noop to keep tsc quiet */ void line }
  console.log(body.slice(0, 1200))

  // The user HAS 220 global IP — assert it appears somewhere in the UI.
  expect(body).toContain("220")
})
