import { test, expect } from "@playwright/test";

test.describe("Auth Phase 1", () => {
  test("logged-out users are redirected from protected routes", async ({ page }) => {
    await page.goto("/home");
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole("heading", { name: "Turner Family Principles" })).toBeVisible();
  });

  test("login page shows magic link form", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Email me a magic link" }),
    ).toBeVisible();
  });

  test("invalid email shows validation error", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill("not-an-email");
    await page.getByRole("button", { name: "Email me a magic link" }).click();
    // Browser native validation or our message
    const alert = page.getByRole("alert");
    const nativeInvalid = await page.getByLabel("Email").evaluate(
      (el: HTMLInputElement) => !el.checkValidity(),
    );
    expect(nativeInvalid || (await alert.count()) > 0).toBeTruthy();
  });

  test("callback without code redirects with error", async ({ page }) => {
    await page.goto("/auth/callback");
    await expect(page).toHaveURL(/\/login\?error=callback_failed/);
  });

  test("discuss is protected", async ({ page }) => {
    await page.goto("/discuss");
    await expect(page).toHaveURL(/\/login/);
  });
});
