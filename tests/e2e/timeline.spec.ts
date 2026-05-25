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
  const taskRegion = page.getByRole("region", {
    name: /launch timeline tasks/i,
  });
  await expect(
    taskRegion.getByRole("article", {
      name: /timeline task: resolve deployment readiness blockers/i,
    }),
  ).toContainText("Source system: Smartsheet");
  await expect(
    taskRegion.getByRole("article", {
      name: /timeline task: verify training asset deployment/i,
    }),
  ).toContainText("Source freshness: Stale");
  const riskRegion = page.getByRole("region", {
    name: /proactive launch risk alerts/i,
  });
  const readinessRiskAlert = riskRegion.getByRole("article", {
    name: /risk alert: review handoff risk for resolve deployment readiness blockers/i,
  });
  await expect(readinessRiskAlert).toContainText("Status: Active");
  await expect(readinessRiskAlert).toContainText("Freshness: Watch");
  await expect(readinessRiskAlert).toContainText("Confidence: high");
  const riskDetailsButton = readinessRiskAlert.getByRole("button", {
    name: /view details for review handoff risk for resolve deployment readiness blockers/i,
  });
  await expect(async () => {
    await riskDetailsButton.click();
    await expect(riskDetailsButton).toHaveAttribute("aria-expanded", "true", {
      timeout: 500,
    });
  }).toPass();
  const riskDetails = readinessRiskAlert.getByRole("region", {
    name: /risk alert details: review handoff risk for resolve deployment readiness blockers/i,
  });
  await expect(riskDetails).toContainText("What changed");
  await expect(riskDetails).toContainText("Linked records");
  await expect(
    riskDetails.getByRole("link", { name: /smartsheet source/i }),
  ).toHaveAttribute("href", "/sources#cardiomax-approved-smartsheet-status");
  await readinessRiskAlert
    .getByRole("button", {
      name: /mark monitoring for review handoff risk for resolve deployment readiness blockers/i,
    })
    .click();
  await expect(readinessRiskAlert).toContainText("Status: Monitoring");
  await expect(
    page.getByRole("region", { name: /latest risk alert audit event/i }),
  ).toContainText("Event type: task.risk_status_updated");
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
  await expect(
    taskRegion.getByRole("article", {
      name: /timeline task: confirm launch tier and scope/i,
    }),
  ).toContainText("Owner role: Launch PM");
  await expect(
    taskRegion.getByRole("article", {
      name: /timeline task: confirm launch tier and scope/i,
    }),
  ).toContainText("Status: Watch");
  await expect(
    taskRegion.getByRole("article", {
      name: /timeline task: confirm launch tier and scope/i,
    }),
  ).toContainText("Freshness: Watch");
  await expect(
    taskRegion.getByRole("article", {
      name: /timeline task: confirm launch tier and scope/i,
    }),
  ).toContainText("Due date: Kickoff date minus 30 days");
  await expect(
    taskRegion.getByRole("article", {
      name: /timeline task: complete deployment handoff review/i,
    }),
  ).toContainText("Dependencies: Depends on Confirm launch tier and scope");
  await expect(
    taskRegion.getByRole("article", {
      name: /timeline task: resolve deployment readiness blockers/i,
    }),
  ).toContainText("Source system: Smartsheet");

  const filterRegion = page.getByRole("region", {
    name: /timeline task filters/i,
  });
  await filterRegion.getByRole("combobox", { name: /status/i })
    .selectOption("watch");
  await expect(
    page.getByRole("region", { name: /active timeline filters/i }),
  ).toContainText("Status: Watch");
  await expect(page.getByText("1 of 5 timeline tasks match current filters."))
    .toBeVisible();
  await expect(
    taskRegion.getByRole("article", {
      name: /timeline task: complete deployment handoff review/i,
    }),
  ).toHaveCount(0);

  await page.getByRole("button", { name: /clear timeline filters/i }).click();
  await expect(page.getByText("5 of 5 timeline tasks shown.")).toBeVisible();
  await page
    .getByRole("button", {
      name: /review details for complete deployment handoff review/i,
    })
    .click();

  const detailsRegion = page.getByRole("region", {
    name: /timeline task details/i,
  });
  await expect(detailsRegion).toContainText("Phase: Launch");
  await expect(detailsRegion).toContainText("Owner: Deployment Lead");
  await expect(detailsRegion).toContainText(
    "Dependency task: Confirm launch tier and scope",
  );
  await expect(
    detailsRegion.getByRole("link", { name: /playbook source/i }),
  ).toHaveAttribute("href", "/sources#cardiomax-tier-2-playbook");

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
