import { test, expect } from "@playwright/test";

test("app shell loads", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/8-Second Story Movie Builder/i);
});
