import { expect, test } from "@playwright/test";

test("requests, completes, and marks a reusable Digital Handoff Artifact ready", async ({
  page,
}) => {
  await page.goto("/handoff");

  await expect(
    page.getByRole("heading", { exact: true, name: "Handoff" }),
  ).toBeVisible();
  const requestForm = page.getByRole("form", {
    name: /request reusable handoff/i,
  });
  await expect(requestForm).toBeVisible();

  await requestForm.getByRole("textbox", { name: /handoff purpose/i })
    .fill("Add updated deployment training dependency.");
  await requestForm.getByRole("textbox", { name: /requested timing/i })
    .fill("Before deployment kickoff");
  await requestForm.getByRole("checkbox", {
    name: /cardiomax approved asset library/i,
  }).check();
  await requestForm.getByRole("button", { name: /request handoff/i }).click();

  await expect(page.getByRole("status")).toContainText(
    "Appended reusable Digital Handoff Artifact",
  );
  const artifact = page.getByRole("article", {
    name: /digital handoff artifact/i,
  });
  await expect(artifact).toContainText(
    "Responsible owner: Deployment Solutions",
  );
  await expect(
    artifact.getByText("Previously handed-off context").first(),
  ).toBeVisible();
  await expect(artifact.getByText("New request update")).toBeVisible();
  await expect(artifact.getByText("State: Current").first()).toBeVisible();
  await expect(artifact.getByText("State: Stale").first()).toBeVisible();
  await expect(artifact.getByText("State: Missing").first()).toBeVisible();
  await expect(artifact.getByText("State: Superseded").first()).toBeVisible();
  await expect(artifact.getByText("State: Conflicting").first()).toBeVisible();
  await expect(
    page.getByRole("region", { name: /latest audit event/i }),
  ).toContainText("Action: Appended");
  await expect(
    page.getByRole("region", { name: /latest audit event/i }),
  ).toContainText("Correlation ID:");

  await page.getByRole("textbox", { name: /commitments content/i }).fill(
    "Updated kickoff material commitment supersedes the prior handoff note.",
  );
  await page.getByRole("combobox", { name: /commitments state/i })
    .selectOption("superseded");
  await page.getByRole("button", { name: /save draft/i }).click();

  await expect(page.getByRole("status")).toContainText(
    "Saved draft Digital Handoff Artifact",
  );
  await expect(artifact).toContainText("Status: Draft");
  await expect(artifact).toContainText("State: Superseded");
  await expect(
    page.getByRole("region", { name: /latest audit event/i }),
  ).toContainText("Action: Updated");

  await page.getByRole("textbox", { name: /commitments content/i }).fill("");
  await page.getByRole("button", { name: /mark ready for review/i }).click();

  const readinessAlert = page.getByRole("alert").filter({
    hasText: /commitments are required/i,
  });
  await expect(readinessAlert).toContainText(
    "Commitments are required before receiving-team readiness review.",
  );
  await expect(readinessAlert).toContainText(
    "Open questions remain a readiness risk",
  );

  await page.getByRole("textbox", { name: /commitments content/i }).fill(
    "Deploy kickoff materials before the June kickoff window.",
  );
  await page.getByRole("combobox", { name: /commitments state/i })
    .selectOption("current");
  await page.getByRole("combobox", { name: /open questions state/i })
    .selectOption("current");
  await page.getByRole("textbox", { name: /open questions content/i }).fill(
    "No open questions remain for kickoff readiness.",
  );
  await page.getByRole("button", { name: /mark ready for review/i }).click();

  await expect(page.getByRole("status")).toContainText(
    "Marked Digital Handoff Artifact ready for review",
  );
  await expect(artifact).toContainText("Status: Ready for review");
  await expect(
    page.getByRole("region", { name: /latest audit event/i }),
  ).toContainText("Action: Ready for review");
});
