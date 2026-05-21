import { expect, test } from "@playwright/test";

test("routes the app root to the LaunchPad command center", async ({ page }) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", {
      name: /command center/i,
    }),
  ).toBeVisible();
  await expect(page.getByText("CARDIOMAX Launch")).toBeVisible();
});
