import { test, expect, type Page, type APIRequestContext } from "@playwright/test"

// Cross-geography scope sweep — drives the REAL frontend.
//   U1 Boito (Konoin, Bomet)  ─┐ same constituency
//   U2 Chepchabas (Konoin)    ─┘ different ward
//   U3 Chebunyo (Chepalungu, Bomet)  same county, diff constituency
//   U4 Airbase (Kamukunji, Nairobi)  different county
//
// Run: cd frontend && npx playwright test tests/sweep/scope.spec.ts --project=chromium

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1"

const U = {
  boito: "geo.boito@sweep.test",
  chepchabas: "geo.chepchabas@sweep.test",
  chebunyo: "geo.chebunyo@sweep.test",
  airbase: "geo.airbase@sweep.test",
}

// Unique markers so we can search the rendered feed.
const RUN = Date.now().toString().slice(-6)
const POST = {
  ward: `SWEEP-WARD-${RUN} boito-ward-only`,
  constituency: `SWEEP-CONST-${RUN} konoin-constituency`,
  county: `SWEEP-COUNTY-${RUN} bomet-county`,
  national: `SWEEP-NATIONAL-${RUN} all-kenya`,
}

async function token(request: APIRequestContext, email: string): Promise<string> {
  const res = await request.post(`${API}/auth/dev/login`, { data: { email } })
  expect(res.ok(), `dev/login ${email}`).toBeTruthy()
  return (await res.json()).data.accessToken
}

function userIdFromJwt(jwt: string): string {
  return JSON.parse(Buffer.from(jwt.split(".")[1], "base64").toString()).sub as string
}

async function loginAndOpenFeed(page: Page, request: APIRequestContext, email: string) {
  const t = await token(request, email)
  const uid = userIdFromJwt(t)
  await page.addInitScript(
    ({ tok, id }) => {
      localStorage.setItem("access_token", tok as string)
      localStorage.removeItem("refresh_token")
      // Pre-dismiss the one-time onboarding welcome overlay (intended for real
      // first-timers; it would otherwise intercept all clicks in automation).
      localStorage.setItem(`ujamaa_wizard_seen_${id}`, "1")
      localStorage.setItem(`ca_seen_${id}`, "1")
    },
    { tok: t, id: uid },
  )
  await page.goto("/dashboard")
  await page.waitForLoadState("networkidle")
  // Neutralise the driver.js contextual-tour overlay that auto-fires for
  // first-timers and intercepts all pointer events. (FINDING: every major
  // section auto-starts a tour; stacked on the welcome wizard for new users.)
  await page.addStyleTag({
    content: ".driver-overlay,.driver-popover,.driver-active-element{display:none !important;pointer-events:none !important}",
  })
  await page.keyboard.press("Escape").catch(() => {})
}

// Select a scope pill by stable testid (pill-ward|constituency|county|national).
async function selectPill(page: Page, tier: string): Promise<boolean> {
  const pill = page.locator(`[data-testid="pill-${tier}"]`).first()
  if ((await pill.count()) === 0) return false
  await pill.click()
  return true
}

// Compose a post at the given scope tier through the UI.
async function composeAt(page: Page, tier: string, text: string) {
  await selectPill(page, tier)
  const textarea = page.locator('[data-testid="compose-input"]')
  await textarea.waitFor({ state: "visible" })
  await textarea.click()
  await textarea.fill(text)
  const post = page.locator('[data-testid="compose-post"]')
  await post.click()
  await textarea.waitFor({ state: "visible" }) // box stays; content clears on success
  await page.waitForTimeout(700)
}

// Switch to a scope tier and report whether `marker` is visible in the feed.
async function visibleAt(page: Page, tier: string, marker: string): Promise<boolean> {
  if (!(await selectPill(page, tier))) return false
  await page.waitForTimeout(700)
  return (await page.getByText(marker, { exact: false }).count()) > 0
}

test("compose 4 scoped posts as U1 (Boito) through the UI", async ({ page, request }) => {
  await loginAndOpenFeed(page, request, U.boito)
  await page.screenshot({ path: `test-results/sweep-u1-feed.png`, fullPage: true })

  await composeAt(page, "ward", POST.ward)
  await composeAt(page, "constituency", POST.constituency)
  await composeAt(page, "county", POST.county)
  await composeAt(page, "national", POST.national)

  await page.screenshot({ path: `test-results/sweep-u1-after-compose.png`, fullPage: true })
})

const TIERS = ["ward", "constituency", "county", "national"]
const MARK = { ward: `SWEEP-WARD-${RUN}`, const: `SWEEP-CONST-${RUN}`, county: `SWEEP-COUNTY-${RUN}`, national: `SWEEP-NATIONAL-${RUN}` }

test("scope visibility matrix (pill × post) across U1–U4", async ({ page, request }) => {
  const result: Record<string, Record<string, Record<string, boolean>>> = {}

  for (const email of Object.values(U)) {
    await loginAndOpenFeed(page, request, email)
    const short = email.split("@")[0]
    result[short] = {}
    for (const tier of TIERS) {
      result[short][tier] = {}
      for (const [mk, marker] of Object.entries(MARK)) {
        result[short][tier][mk] = await visibleAt(page, tier, marker)
      }
    }
    await page.screenshot({ path: `test-results/sweep-${short}-${RUN}.png`, fullPage: true })
  }

  console.log("\n=== PILL × POST VISIBILITY (true = post visible at that pill) ===")
  console.log(JSON.stringify(result, null, 2))

  // ── True scope boundaries, per the hierarchical-cascade model ──
  // 1. WARD ISOLATION: U2 (Chepchabas) ward feed must NOT show U1's Boito ward post.
  expect(result["geo.chepchabas"].ward.ward,
    "ward isolation: Chepchabas ward feed must not show a Boito ward post").toBeFalsy()
  // 2. CONSTITUENCY ISOLATION: U3 (Chepalungu) constituency feed must NOT show the Konoin constituency post or the Boito ward post.
  expect(result["geo.chebunyo"].constituency.const,
    "constituency isolation: Chepalungu feed must not show a Konoin constituency post").toBeFalsy()
  expect(result["geo.chebunyo"].constituency.ward,
    "constituency isolation: Chepalungu feed must not show a Konoin ward post").toBeFalsy()
  // 3. COUNTY ISOLATION: U4 (Nairobi) must see none of the Bomet posts at any pill.
  expect(result["geo.airbase"].county.county,
    "county isolation: Nairobi county feed must not show a Bomet county post").toBeFalsy()
  // 4. CASCADE DOWN: U2 ward feed should show the constituency + county + national posts it belongs to.
  expect(result["geo.chepchabas"].ward.const, "cascade: Chepchabas ward feed should show its Konoin constituency post").toBeTruthy()
  expect(result["geo.chepchabas"].ward.county, "cascade: Chepchabas ward feed should show its Bomet county post").toBeTruthy()
  // 5. NATIONAL: everyone sees national everywhere.
  expect(result["geo.airbase"].national.national, "national must be visible to the Nairobi user").toBeTruthy()
})
