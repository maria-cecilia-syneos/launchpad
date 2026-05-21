import { expect, test } from "@playwright/test";

test("defaults to Command Center with persistent launch context", async ({
  page,
}) => {
  await page.goto("/");

  await expect(page).toHaveURL(/\/command-center$/);
  await expect(
    page.getByRole("heading", { name: "Command Center" }),
  ).toBeVisible();
  await expect(page.getByText("CARDIOMAX Launch")).toBeVisible();
  await expect(page.getByRole("link", { name: "Open Agent" })).toBeVisible();
  await expect(page.getByRole("link", { name: /admin/i })).toHaveCount(0);
});

test("keeps launch context visible when navigating surfaces", async ({ page }) => {
  await page.goto("/command-center");

  await page.getByRole("link", { name: "Timeline" }).click();

  await expect(page).toHaveURL(/\/timeline$/);
  await expect(
    page.getByRole("heading", { name: "Timeline" }),
  ).toBeVisible();
  await expect(page.getByText("CARDIOMAX Launch")).toBeVisible();
  await expect(page.getByRole("link", { name: "Open Agent" })).toBeVisible();
});

test("keeps the admin route available as a permitted surface target", async ({
  page,
}) => {
  await page.goto("/admin");

  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole("heading", { name: "Admin" })).toBeVisible();
  await expect(page.getByText("CARDIOMAX Launch")).toBeVisible();
  await expect(page.getByRole("link", { name: "Open Agent" })).toBeVisible();
});
