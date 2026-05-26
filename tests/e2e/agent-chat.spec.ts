import { expect, test } from "@playwright/test";

test("accepts a natural-language launch question on the Agent surface", async ({
  page,
}) => {
  await page.goto("/agent");

  await expect(page.getByRole("heading", { name: "Agent" })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "CARDIOMAX Launch" }),
  ).toBeVisible();

  await page
    .getByRole("textbox", { name: /ask launchpad/i })
    .fill("Which launch commitments are due this week?");
  await page.getByRole("button", { name: /ask launchpad/i }).click();

  await expect(
    page
      .getByRole("log", { name: "Agent conversation" })
      .getByText("Which launch commitments are due this week?", {
        exact: true,
      }),
  ).toBeVisible();
  await expect(page.getByRole("status")).toContainText(
    "Retrieving launch context for CARDIOMAX Launch",
  );
  await expect(
    page.getByRole("article", { name: /source-backed answer/i }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", {
      name: /^citation 1: cardiomax launch plan from sharepoint$/i,
    }),
  ).toBeVisible();
});

test("asks for clarification instead of fabricating facts", async ({ page }) => {
  await page.goto("/agent");

  await page
    .getByRole("textbox", { name: /ask launchpad/i })
    .fill("What about it?");
  await page.getByRole("button", { name: /ask launchpad/i }).click();

  await expect(page.getByRole("status")).toContainText("Clarification needed");
  await expect(
    page.getByText(/Which launch item should I check/i),
  ).toBeVisible();
});

test("returns a no reliable source state instead of fabricated facts", async ({
  page,
}) => {
  await page.goto("/agent");

  await page
    .getByRole("textbox", { name: /ask launchpad/i })
    .fill("What is the unverified launch rumor?");
  await page.getByRole("button", { name: /ask launchpad/i }).click();

  await expect(page.getByText(/State: No reliable source/i)).toBeVisible();
  await expect(page.getByText(/source gap/i)).toBeVisible();
});

test("submits answer feedback without disrupting the chat session", async ({
  page,
}) => {
  await page.goto("/agent");

  await page
    .getByRole("textbox", { name: /ask launchpad/i })
    .fill("Which launch commitments are due this week?");
  await page.getByRole("button", { name: /ask launchpad/i }).click();

  await expect(
    page.getByRole("article", { name: /source-backed answer/i }),
  ).toBeVisible();
  await page
    .getByRole("radio", { name: /this answer needs work/i })
    .click();
  await page
    .getByRole("checkbox", { name: /missing context/i })
    .click();
  await page
    .getByRole("button", { name: /submit answer feedback/i })
    .click();

  await expect(
    page.getByText(
      "Feedback received. It has been preserved for answer quality review.",
    ),
  ).toBeVisible();
  await expect(
    page
      .getByRole("log", { name: "Agent conversation" })
      .getByText("Which launch commitments are due this week?", {
        exact: true,
      }),
  ).toBeVisible();
});

test("answers source-backed handoff readiness questions", async ({ page }) => {
  await page.goto("/agent");

  await page
    .getByRole("textbox", { name: /ask launchpad/i })
    .fill("What is the handoff readiness status?");
  await page.getByRole("button", { name: /ask launchpad/i }).click();

  await expect(page.getByText(/Handoff readiness needs attention/i))
    .toBeVisible();
  await expect(page.getByText(/State: Missing information/i)).toBeVisible();
  await expect(page.getByText(/Assumptions is Stale/i)).toBeVisible();
  await expect(
    page.getByRole("link", {
      name: /^citation 1: digital handoff artifact from handoff artifact$/i,
    }),
  ).toBeVisible();
});

test("answers source-backed launch execution risk questions", async ({
  page,
}) => {
  await page.goto("/agent");

  await page
    .getByRole("textbox", { name: /ask launchpad/i })
    .fill("Which risks are open?");
  await page.getByRole("button", { name: /ask launchpad/i }).click();

  await expect(page.getByText(/Launch execution and risk status/i))
    .toBeVisible();
  await expect(page.getByText(/State: Source stale/i)).toBeVisible();
  await expect(page.getByText(/3 active risk alerts/i)).toBeVisible();
  await expect(
    page.getByText(/Resolve deployment readiness blockers is owned by Deployment Lead/i),
  ).toBeVisible();
  await expect(
    page.getByRole("link", {
      name: /^citation 1: smartsheet launch task source from smartsheet$/i,
    }),
  ).toBeVisible();
});

test("answers handoff change-history questions with actors and timestamps", async ({
  page,
}) => {
  await page.goto("/agent");

  await page
    .getByRole("textbox", { name: /ask launchpad/i })
    .fill("What changed since the prior handoff review?");
  await page.getByRole("button", { name: /ask launchpad/i }).click();

  await expect(page.getByText(/Handoff change history/i)).toBeVisible();
  await expect(page.getByText(/State: Partial confidence/i)).toBeVisible();
  await expect(page.getByText(/2026-05-21T09:00:00.000Z/i)).toBeVisible();
  await expect(page.getByText(/State: Superseded/i)).toBeVisible();
});
