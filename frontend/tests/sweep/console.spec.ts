import { test, type APIRequestContext, type Page } from "@playwright/test"

// Diagnostic: capture console errors / page errors / failed requests on the
// dashboard (the Next.js dev overlay reported "1 issue").
const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1"

async function login(page: Page, request: APIRequestContext, email: string) {
  const t = (await (await request.post(`${API}/auth/dev/login`, { data: { email } })).json()).data.accessToken
  const uid = JSON.parse(Buffer.from(t.split(".")[1], "base64").toString()).sub
  await page.addInitScript(({ tok, id }) => {
    localStorage.setItem("access_token", tok as string)
    localStorage.setItem(`ujamaa_wizard_seen_${id}`, "1")
    localStorage.setItem(`ca_seen_${id}`, "1")
  }, { tok: t, id: uid })
}

test("capture dashboard console/runtime issues", async ({ page, request }) => {
  const errors: string[] = []
  const warnings: string[] = []
  const failed: string[] = []

  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text())
    if (msg.type() === "warning") warnings.push(msg.text())
  })
  page.on("pageerror", (err) => errors.push(`PAGEERROR: ${err.message}`))
  page.on("requestfailed", (req) => failed.push(`${req.method()} ${req.url()} — ${req.failure()?.errorText}`))
  page.on("response", (res) => { if (res.status() >= 400) failed.push(`${res.status()} ${res.request().method()} ${res.url()}`) })

  await login(page, request, "sim.njeri@kayole.test")
  await page.goto("/dashboard")
  await page.waitForLoadState("networkidle")
  await page.waitForTimeout(2500)

  console.log("\n=== CONSOLE ERRORS ===")
  console.log(errors.length ? [...new Set(errors)].join("\n") : "(none)")
  console.log("\n=== FAILED REQUESTS (>=400) ===")
  console.log(failed.length ? [...new Set(failed)].join("\n") : "(none)")
  console.log("\n=== CONSOLE WARNINGS ===")
  console.log(warnings.length ? [...new Set(warnings)].slice(0, 15).join("\n") : "(none)")
})
