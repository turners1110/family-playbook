import { test, expect } from "@playwright/test";

test.describe("Turner Family Principles", () => {
  test("home dashboard loads", async ({ page }) => {
    await page.goto("/home");
    await expect(page.getByRole("heading", { name: "Home" })).toBeVisible({
      timeout: 15000,
    });
    await expect(page.getByText("Turner Family Principles").first()).toBeVisible();
    await expect(page.getByRole("link", { name: "Start a Discussion" })).toBeVisible();
  });

  test("complete a discussion session with shared answer", async ({ page }) => {
    await page.goto("/discuss");
    await expect(page.getByLabel("Session title")).toBeVisible({ timeout: 15000 });
    await page.getByLabel("Session title").fill("E2E session");
    await page.getByRole("button", { name: /Quick/ }).click();
    await Promise.all([
      page.waitForURL(/\/discuss\/session_/, { timeout: 30000 }),
      page.getByRole("button", { name: "Start discussion" }).click(),
    ]);
    await expect(page.getByText(/Question 1 of/)).toBeVisible({ timeout: 20000 });
    await page.getByRole("button", { name: "Shared answer" }).click();
    await page.getByLabel("Shared answer").fill("We will decide together and revisit after birth.");
    await page.getByRole("button", { name: "Save and continue" }).click();
    await expect(page.getByText(/Question 2 of|Session summary/)).toBeVisible({
      timeout: 20000,
    });
  });

  test("create a decision and see playbook content", async ({ page }) => {
    await page.goto("/decisions");
    await expect(page.getByLabel("Title")).toBeVisible({ timeout: 15000 });
    await page.getByLabel("Title").fill("E2E visitor policy");
    await page.getByLabel("Decision statement").fill("Short visits only in week one.");
    await page.getByRole("button", { name: "Create decision" }).click();
    await expect(page.getByRole("link", { name: "E2E visitor policy" })).toBeVisible({
      timeout: 15000,
    });
    await page.goto("/playbook");
    await expect(page.getByRole("heading", { name: "Playbook" })).toBeVisible();
    await expect(page.getByText("E2E visitor policy")).toBeVisible();
  });

  test("question library filters", async ({ page }) => {
    await page.goto("/questions");
    await expect(page.getByLabel("Search questions")).toBeVisible({ timeout: 15000 });
    await page.getByLabel("Search questions").fill("sleep");
    await page.getByRole("button", { name: "Apply filters" }).click();
    await expect(page.getByRole("heading", { name: "Questions" })).toBeVisible();
    await expect(page.locator("a.surface").first()).toBeVisible();
  });
});
