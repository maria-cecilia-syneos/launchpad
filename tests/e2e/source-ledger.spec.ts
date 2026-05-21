import { expect, test } from "@playwright/test";

test("shows registered Source Ledger records on the Sources surface", async ({
  page,
}) => {
  await page.goto("/sources");

  await expect(
    page.getByRole("heading", { name: "Source Ledger" }),
  ).toBeVisible();
  await expect(page.getByText("CARDIOMAX Launch Plan")).toBeVisible();
  await expect(page.getByText("CARDIOMAX Teams Decisions")).toBeVisible();
  await expect(page.getByText("CARDIOMAX Salesforce Launch Context"))
    .toBeVisible();
  await expect(page.getByText("Source system: SharePoint").first())
    .toBeVisible();
  await expect(page.getByText("Source system: Teams")).toBeVisible();
  await expect(page.getByText("Source system: ECRM/Salesforce"))
    .toBeVisible();
  await expect(page.getByText("Source-link health: Healthy").first())
    .toBeVisible();
  await expect(page.getByText("Freshness: Fresh").first()).toBeVisible();
  await expect(page.getByText("Ingestion: Complete").first()).toBeVisible();
  await expect(page.getByText("Approval: Stale")).toBeVisible();
  await expect(page.getByText("Ingestion: Stale")).toBeVisible();
});

test("hides source registration and redacts restricted details for non-admin users", async ({
  page,
}) => {
  await page.goto("/sources");

  await expect(
    page.getByRole("button", { name: /register source/i }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: /run ingestion/i }),
  ).toHaveCount(0);
  await expect(
    page.getByText("Restricted commercial launch plan"),
  ).toHaveCount(0);
  await expect(
    page.getByText("Restricted source details are hidden."),
  ).toBeVisible();
  await expect(page.getByText("Source system: Restricted")).toBeVisible();
});
