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
  await expect(page.getByText("CARDIOMAX Tier 2 Launch Playbook"))
    .toBeVisible();
  await expect(page.getByText("CARDIOMAX Approved Asset Library"))
    .toBeVisible();
  await expect(page.getByText("CARDIOMAX Deployment Handoff")).toBeVisible();
  await expect(page.getByText("Source system: SharePoint").first())
    .toBeVisible();
  await expect(page.getByText("Source system: Teams")).toBeVisible();
  await expect(page.getByText("Source system: ECRM/Salesforce"))
    .toBeVisible();
  await expect(page.getByText("Source system: Playbook")).toBeVisible();
  await expect(page.getByText("Source system: Asset")).toBeVisible();
  await expect(page.getByText("Source system: Handoff artifact")).toBeVisible();
  await expect(page.getByText("Source-link health: Healthy").first())
    .toBeVisible();
  await expect(page.getByText("Freshness: Fresh").first()).toBeVisible();
  await expect(page.getByText("Ingestion: Complete").first()).toBeVisible();
  await expect(page.getByText("Approval: Stale")).toBeVisible();
  await expect(page.getByText("Ingestion: Stale")).toBeVisible();
});

test("searches, filters, and inspects Source Ledger details", async ({
  page,
}) => {
  await page.goto("/sources");

  await page.getByRole("searchbox", { name: /search sources/i })
    .fill("salesforce");
  await expect(
    page.getByRole("status", { name: /source result count/i }),
  ).toContainText("1 of 8 source records match current filters");
  await expect(page.getByText("CARDIOMAX Salesforce Launch Context"))
    .toBeVisible();
  await expect(page.getByText("CARDIOMAX Launch Plan")).toHaveCount(0);

  await page.getByRole("button", { name: /clear filters/i }).click();
  await page.getByRole("combobox", { name: /freshness filter/i })
    .selectOption("stale");
  await expect(page.getByText("CARDIOMAX Smartsheet Status")).toBeVisible();
  await expect(page.getByText("Matched freshness.")).toBeVisible();

  await page.getByRole("button", {
    name: /show details for cardiomax smartsheet status/i,
  }).click();
  await expect(page.getByText(/source id:/i)).toBeVisible();
  await expect(page.getByText(/registered:/i)).toBeVisible();
  await expect(page.getByText(/next useful action:/i)).toBeVisible();
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

  await page.getByRole("searchbox", { name: /search sources/i })
    .fill("commercial");
  await expect(
    page.getByRole("status", { name: /source result count/i }),
  ).toContainText("0 of 8 source records match current filters");
  await expect(
    page.getByText("Restricted commercial launch plan"),
  ).toHaveCount(0);
  await expect(page.getByText("Commercial Strategy")).toHaveCount(0);
});
