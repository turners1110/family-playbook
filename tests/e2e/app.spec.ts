import { test, expect } from "@playwright/test";

/**
 * Product e2e flows require a signed-in Supabase session.
 * Phase 1 focuses auth coverage in auth.spec.ts.
 * Full discussion/decision flows return in a later phase with test users.
 */
test.describe("Product flows (auth required)", () => {
  test.skip(!process.env.E2E_AUTH_READY, "Requires authenticated test session (E2E_AUTH_READY=1)");

  test("placeholder for authenticated product flows", async ({ page }) => {
    await page.goto("/home");
    await expect(page.getByRole("heading", { name: "Home" })).toBeVisible();
  });
});
