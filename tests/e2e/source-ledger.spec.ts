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
  await expect(page.getByText("CARDIOMAX Approved Smartsheet Status"))
    .toBeVisible();
  await expect(page.getByText("CARDIOMAX Tier 2 Launch Playbook"))
    .toBeVisible();
  await expect(page.getByRole("heading", { name: "CARDIOMAX Approved Asset Library" }))
    .toBeVisible();
  await expect(page.getByRole("heading", { name: "CARDIOMAX Approved Message House" }))
    .toBeVisible();
  await expect(page.getByRole("heading", { name: "CARDIOMAX Approved Clinical Claim Set" }))
    .toBeVisible();
  await expect(page.getByRole("heading", { name: "CARDIOMAX Value Proposition Brief" }))
    .toBeVisible();
  await expect(page.getByRole("heading", { name: "CARDIOMAX Field Training Deck" }))
    .toBeVisible();
  await expect(page.getByRole("heading", { name: "CARDIOMAX Learning Module Facilitator Guide" }))
    .toBeVisible();
  await expect(page.getByRole("heading", { name: "CARDIOMAX Quick Reference Guide" }))
    .toBeVisible();
  await expect(page.getByText("CARDIOMAX Deployment Handoff")).toBeVisible();
  await expect(page.getByText("Source system: SharePoint").first())
    .toBeVisible();
  await expect(page.getByText("Source system: Teams")).toBeVisible();
  await expect(page.getByText("Source system: ECRM/Salesforce"))
    .toBeVisible();
  await expect(page.getByText("Source system: Smartsheet").first())
    .toBeVisible();
  await expect(page.getByText("Source system: Playbook")).toBeVisible();
  await expect(page.getByText("Source system: Asset").first()).toBeVisible();
  await expect(page.getByText("Source system: Handoff artifact")).toBeVisible();
  await expect(page.getByText("Source-link health: Healthy").first())
    .toBeVisible();
  await expect(page.getByText("Freshness: Fresh").first()).toBeVisible();
  await expect(page.getByText("Ingestion: Complete").first()).toBeVisible();
  await expect(page.getByText("Approval: Stale")).toBeVisible();
  await expect(page.getByText("Ingestion: Stale").first()).toBeVisible();
});

test("searches, filters, and inspects Source Ledger details", async ({
  page,
}) => {
  await page.goto("/sources");

  await page.getByRole("searchbox", { name: /search sources/i })
    .fill("salesforce");
  await expect(
    page.getByRole("status", { name: /source result count/i }),
  ).toContainText("1 of 20 source records match current filters");
  await expect(page.getByText("CARDIOMAX Salesforce Launch Context"))
    .toBeVisible();
  await expect(page.getByText("CARDIOMAX Launch Plan")).toHaveCount(0);

  await page.getByRole("button", { name: /clear filters/i }).click();
  await page.getByRole("combobox", { name: /freshness filter/i })
    .selectOption("stale");
  const smartsheetResult = page.getByRole("article", {
    name: /cardiomax smartsheet status/i,
  });
  await expect(smartsheetResult).toBeVisible();
  await expect(smartsheetResult.getByText("Matched freshness.")).toBeVisible();

  await smartsheetResult.getByRole("button", {
    name: /show details for cardiomax smartsheet status/i,
  }).click();
  await expect(smartsheetResult.getByText(/source id:/i)).toBeVisible();
  await expect(smartsheetResult.getByText(/registered:/i)).toBeVisible();
  await expect(smartsheetResult.getByText(/next useful action:/i)).toBeVisible();
});

test("finds approved content for training use", async ({ page }) => {
  await page.goto("/sources");

  await page
    .getByRole("searchbox", { name: /search sources/i })
    .fill("value proposition");
  await page
    .getByRole("textbox", { name: /launch or workstream filter/i })
    .fill("cardiomax");
  await page
    .getByRole("combobox", { name: /approval filter/i })
    .selectOption("approved");

  const result = page.getByRole("article", {
    name: /cardiomax value proposition brief/i,
  });

  await expect(result).toBeVisible();
  await expect(result).toContainText("Approved for use: Approved for training use");
  await expect(result).toContainText("Content category: Value proposition");
  await expect(result).toContainText("Launch or workstream: CARDIOMAX Launch");
  await expect(result).toContainText("Last refreshed:");
  await result
    .getByRole("button", {
      name: /show details for cardiomax value proposition brief/i,
    })
    .click();
  await expect(
    result.getByRole("link", {
      name: /authorized source link: cardiomax value proposition brief/i,
    }),
  ).toHaveAttribute("href", "/sources#cardiomax-value-proposition-brief");
});

test("finds impacted training assets and replacement guidance", async ({
  page,
}) => {
  await page.goto("/sources");

  await page
    .getByRole("searchbox", { name: /search sources/i })
    .fill("changed claim");
  await page
    .getByRole("textbox", { name: /launch or workstream filter/i })
    .fill("cardiomax");

  const result = page.getByRole("article", {
    name: /cardiomax field training deck/i,
  });

  await expect(result).toBeVisible();
  await expect(result).toContainText("Changed claim");
  await expect(result).toContainText("Module 2 speaker notes");
  await expect(result).toContainText("CARDIOMAX Approved Clinical Claim Set");

  await result
    .getByRole("button", {
      name: /show details for cardiomax field training deck/i,
    })
    .click();
  await expect(result.getByText(/approved replacement source:/i).first())
    .toBeVisible();
});

test("explains no impacted training asset matches without approved-source copy", async ({
  page,
}) => {
  await page.goto("/sources");

  await page
    .getByRole("searchbox", { name: /search sources/i })
    .fill("changed pricing phrase");

  await expect(page.getByText(/No impacted training assets found/i))
    .toBeVisible();
  await expect(page.getByText(/not yet ingested/i)).toBeVisible();
  await expect(page.getByText(/Missing approved source/i)).toHaveCount(0);
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
    page.getByText("Restricted source details are hidden.").first(),
  ).toBeVisible();
  await expect(page.getByText("Source system: Restricted").first()).toBeVisible();

  await page.getByRole("searchbox", { name: /search sources/i })
    .fill("commercial");
  await expect(
    page.getByRole("status", { name: /source result count/i }),
  ).toContainText("0 of 20 source records match current filters");
  await expect(
    page.getByText("Restricted commercial launch plan"),
  ).toHaveCount(0);
  await expect(page.getByText("Commercial Strategy")).toHaveCount(0);
});
