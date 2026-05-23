import { expect, test } from "@playwright/test";

test("starts a launch timeline from an approved Playbook template", async ({
  page,
}) => {
  await page.goto("/timeline");

  await expect(page.getByRole("heading", { name: "Timeline" })).toBeVisible();
  const launchForm = page.getByRole("form", {
    name: /start launch from playbook/i,
  });
  await expect(launchForm).toBeVisible();
  await expect(
    launchForm.getByRole("combobox", { name: /playbook template/i }),
  ).toContainText("Tier 2 Launch Playbook");
  await expect(
    page.getByRole("region", { name: /unavailable playbook templates/i }),
  ).toContainText("CARDIOMAX Tier 1 Draft Playbook");
  await expect(
    page.getByRole("region", { name: /unavailable playbook templates/i }),
  ).toContainText("Restricted Playbook template");
  await expect(page.getByText("Restricted Tier 4 Launch Playbook")).toHaveCount(0);

  await launchForm.getByRole("button", { name: /generate launch plan/i })
    .click();

  await expect(page.getByRole("status")).toContainText(
    "Generated 2 launch tasks for CARDIOMAX Launch",
  );
  const taskRegion = page.getByRole("region", {
    name: /generated launch tasks/i,
  });
  await expect(
    taskRegion.getByRole("article", {
      name: /timeline task: confirm launch tier and scope/i,
    }),
  ).toContainText("Owner role: Launch PM");
  await expect(
    taskRegion.getByRole("article", {
      name: /timeline task: confirm launch tier and scope/i,
    }),
  ).toContainText("Freshness: Watch");
  await expect(
    taskRegion.getByRole("article", {
      name: /timeline task: confirm launch tier and scope/i,
    }),
  ).toContainText("Due date logic: Kickoff date minus 30 days");
  await expect(
    taskRegion.getByRole("article", {
      name: /timeline task: complete deployment handoff review/i,
    }),
  ).toContainText("Dependencies: task-cardiomax-pb-task-1");

  const auditRegion = page.getByRole("region", {
    name: /latest launch generation audit event/i,
  });
  await expect(auditRegion).toContainText("Action: Launch plan generated");
  await expect(auditRegion).toContainText("Event type: launch_plan.generated");
  await expect(auditRegion).toContainText(
    "Playbook source ID: src-cardiomax-tier-2-playbook",
  );
  await expect(auditRegion).toContainText("Correlation ID:");
});
