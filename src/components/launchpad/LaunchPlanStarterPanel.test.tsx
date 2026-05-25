import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { createPrototypeLaunchPlanSources } from "@/domain/launch-plan";
import type { NormalizedLaunchTaskRecord } from "@/domain/launch-artifact-ingestion";
import { createPrototypeSmartsheetStatusTasks } from "@/domain/smartsheet-status";
import { defaultWorkspaceSession } from "@/domain/workspace";

import { LaunchPlanStarterPanel } from "./LaunchPlanStarterPanel";

function buildIngestedTaskRecord(
  overrides: Partial<NormalizedLaunchTaskRecord> = {},
): NormalizedLaunchTaskRecord {
  return {
    accessState: "authorized",
    approvalState: "approved",
    blockerState: "none",
    criticalPath: true,
    dependencyIds: [],
    dueDateLabel: "T-14",
    freshnessState: "fresh",
    handoffRelevance: "Deployment readiness",
    ingestionStatus: "complete",
    launchId: defaultWorkspaceSession.launch.id,
    launchTaskRecordId: "launchtask-cardiomax-readiness",
    owningTeam: "Project Management",
    ownerRole: "Project Manager",
    phase: "Launch",
    refreshedAt: "2026-05-21T16:00:00.000Z",
    sourceId: "src-cardiomax-launch-tasks",
    sourceLocationKey: "tasks-cardiomax-launch",
    sourceObjectId: "tasks-cardiomax-launch",
    sourceSystem: "task",
    sourceUrl: "/sources#cardiomax-launch-tasks",
    taskId: "task-readiness-review",
    taskName: "Run readiness review",
    ...overrides,
  };
}

describe("LaunchPlanStarterPanel", () => {
  it("generates launch tasks from an approved Playbook template", async () => {
    const user = userEvent.setup();
    const onAuditEvent = vi.fn();

    render(
      <LaunchPlanStarterPanel
        onAuditEvent={onAuditEvent}
        session={defaultWorkspaceSession}
      />,
    );

    expect(screen.getByRole("heading", { name: "Timeline" })).toBeVisible();
    expect(
      screen.getByRole("form", { name: /start launch from playbook/i }),
    ).toBeVisible();
    expect(
      screen.getByRole("combobox", { name: /playbook template/i }),
    ).toHaveDisplayValue(/Tier 2 Launch Playbook - Tier 2, Tier 3/i);
    const unavailableRegion = screen.getByRole("region", {
      name: /unavailable playbook templates/i,
    });
    expect(within(unavailableRegion).getByText(/cardiomax tier 1 draft playbook/i))
      .toBeVisible();
    expect(within(unavailableRegion).getByText(/template approval is draft/i))
      .toBeVisible();
    expect(within(unavailableRegion).getByText(/cardiomax tier 3 stale playbook/i))
      .toBeVisible();
    expect(within(unavailableRegion).getByText(/restricted playbook template/i))
      .toBeVisible();
    expect(screen.queryByText(/restricted tier 4 launch playbook/i))
      .not.toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: /generate launch plan/i }),
    );

    expect(screen.getByRole("status")).toHaveTextContent(
      /generated 2 launch tasks for cardiomax launch/i,
    );
    const taskRegion = screen.getByRole("region", {
      name: /launch timeline tasks/i,
    });
    const firstTask = within(taskRegion).getByRole("article", {
      name: /timeline task: confirm launch tier and scope/i,
    });
    const secondTask = within(taskRegion).getByRole("article", {
      name: /timeline task: complete deployment handoff review/i,
    });

    expect(firstTask).toHaveTextContent(/phase: mobilize/i);
    expect(firstTask).toHaveTextContent(/owner role: launch pm/i);
    expect(firstTask).toHaveTextContent(/status: watch/i);
    expect(firstTask).toHaveTextContent(/critical path: yes/i);
    expect(firstTask).toHaveTextContent(/blocker: no blocker/i);
    expect(firstTask).toHaveTextContent(
      /due date: kickoff date minus 30 days/i,
    );
    expect(firstTask).toHaveTextContent(
      /handoff relevance: sales to deployment readiness/i,
    );
    expect(firstTask).toHaveTextContent(/source freshness: watch/i);
    expect(firstTask).toHaveTextContent(/freshness: watch/i);
    expect(firstTask).toHaveTextContent(/approval: approved/i);
    expect(secondTask).toHaveTextContent(
      /dependencies: depends on confirm launch tier and scope/i,
    );

    const filtersRegion = screen.getByRole("region", {
      name: /timeline task filters/i,
    });
    await user.selectOptions(
      within(filtersRegion).getByRole("combobox", { name: /status/i }),
      "watch",
    );

    expect(
      screen.getByRole("region", { name: /active timeline filters/i }),
    ).toHaveTextContent(/status: watch/i);
    expect(screen.getByText(/1 of 2 timeline tasks match current filters/i))
      .toBeVisible();
    expect(
      within(taskRegion).getByRole("article", {
        name: /timeline task: confirm launch tier and scope/i,
      }),
    ).toBeVisible();
    expect(
      within(taskRegion).queryByRole("article", {
        name: /timeline task: complete deployment handoff review/i,
      }),
    ).not.toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: /clear timeline filters/i }),
    );
    expect(screen.getByText(/2 of 2 timeline tasks shown/i)).toBeVisible();

    await user.click(
      screen.getByRole("button", {
        name: /review details for complete deployment handoff review/i,
      }),
    );

    const detailsRegion = screen.getByRole("region", {
      name: /timeline task details/i,
    });
    expect(detailsRegion).toHaveTextContent(
      /complete deployment handoff review/i,
    );
    expect(detailsRegion).toHaveTextContent(/phase: launch/i);
    expect(detailsRegion).toHaveTextContent(/owner: deployment lead/i);
    expect(detailsRegion).toHaveTextContent(
      /dependencies: depends on confirm launch tier and scope/i,
    );
    expect(detailsRegion).toHaveTextContent(
      /dependency task: confirm launch tier and scope/i,
    );
    expect(
      within(detailsRegion).getByRole("link", { name: /playbook source/i }),
    ).toHaveAttribute("href", "/sources#cardiomax-tier-2-playbook");

    const auditRegion = screen.getByRole("region", {
      name: /latest launch generation audit event/i,
    });
    expect(auditRegion).toHaveTextContent(/action: launch plan generated/i);
    expect(auditRegion).toHaveTextContent(/event type: launch_plan.generated/i);
    expect(auditRegion).toHaveTextContent(/launch id: cardiomax/i);
    expect(auditRegion).toHaveTextContent(
      /playbook source id: src-cardiomax-tier-2-playbook/i,
    );
    expect(onAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "launch_plan.generated",
        metadata: expect.objectContaining({
          generatedTaskCount: 2,
          selectedLaunchTier: "Tier 2",
        }),
      }),
    );

    await user.clear(screen.getByRole("textbox", { name: /launch id/i }));
    await user.type(screen.getByRole("textbox", { name: /launch id/i }), "new-launch");

    expect(
      screen.getByText(/no generated or ingested launch tasks are available yet/i),
    )
      .toBeVisible();
    expect(
      screen.getByText(/no launch generation audit event has been recorded yet/i),
    ).toBeVisible();
    expect(screen.getByText(/select a timeline task to review normalized metadata/i))
      .toBeVisible();
    expect(screen.queryByRole("article", { name: /timeline task:/i }))
      .not.toBeInTheDocument();
  });

  it("renders ingested-only launch tasks in Timeline Control", async () => {
    const user = userEvent.setup();

    render(
      <LaunchPlanStarterPanel
        initialIngestedTasks={[buildIngestedTaskRecord()]}
        session={defaultWorkspaceSession}
      />,
    );

    const taskRegion = screen.getByRole("region", {
      name: /launch timeline tasks/i,
    });
    const task = within(taskRegion).getByRole("article", {
      name: /timeline task: run readiness review/i,
    });

    expect(task).toHaveTextContent(/owner role: project manager/i);
    expect(task).toHaveTextContent(/due date: t-14/i);
    expect(task).toHaveTextContent(/handoff relevance: deployment readiness/i);
    expect(task).toHaveTextContent(/source system: launch task/i);
    expect(task).toHaveTextContent(/source freshness: fresh/i);

    await user.click(
      within(task).getByRole("button", {
        name: /review details for run readiness review/i,
      }),
    );

    const detailsRegion = screen.getByRole("region", {
      name: /timeline task details/i,
    });
    expect(detailsRegion).toHaveTextContent(/run readiness review/i);
    expect(detailsRegion).toHaveTextContent(/source: ingested launch task list/i);
    expect(detailsRegion).toHaveTextContent(/source system: launch task/i);
    expect(detailsRegion).toHaveTextContent(/source type: launch task/i);
    expect(detailsRegion).toHaveTextContent(/source approval: approved/i);
    expect(detailsRegion).toHaveTextContent(/source access: authorized/i);
    expect(detailsRegion).toHaveTextContent(/source ingestion: complete/i);
    expect(
      within(detailsRegion).getByRole("link", { name: /launch task source/i }),
    ).toHaveAttribute("href", "/sources#cardiomax-launch-tasks");
    expect(
      within(detailsRegion).getByRole("link", { name: /handoff workspace/i }),
    ).toHaveAttribute("href", "/handoff");
  });

  it("surfaces proactive launch risk alerts with details, actions, and audit state", async () => {
    const user = userEvent.setup();

    render(
      <LaunchPlanStarterPanel
        initialIngestedTasks={createPrototypeSmartsheetStatusTasks()}
        session={defaultWorkspaceSession}
      />,
    );

    const alertsRegion = screen.getByRole("region", {
      name: /proactive launch risk alerts/i,
    });
    const alert = within(alertsRegion).getByRole("article", {
      name: /risk alert: review handoff risk for resolve deployment readiness blockers/i,
    });

    expect(alert).toHaveTextContent(/status: active/i);
    expect(alert).toHaveTextContent(/freshness: watch/i);
    expect(alert).toHaveTextContent(/confidence: high/i);
    expect(alert).toHaveTextContent(/deployment lead/i);
    expect(alert).toHaveTextContent(
      /confirm the blocker owner, expected unblock date, and handoff readiness/i,
    );

    await user.click(
      within(alert).getByRole("button", {
        name: /view details for review handoff risk for resolve deployment readiness blockers/i,
      }),
    );

    const details = within(alert).getByRole("region", {
      name: /risk alert details: review handoff risk for resolve deployment readiness blockers/i,
    });
    expect(details).toHaveTextContent(/what changed/i);
    expect(details).toHaveTextContent(/why it matters/i);
    expect(details).toHaveTextContent(/linked records/i);
    expect(
      within(details).getByRole("link", { name: /smartsheet source/i }),
    ).toHaveAttribute("href", "/sources#cardiomax-approved-smartsheet-status");
    expect(
      within(details).getByRole("link", { name: /handoff workspace/i }),
    ).toHaveAttribute("href", "/handoff");

    const dependencyAlert = within(alertsRegion).getByRole("article", {
      name: /risk alert: review dependency impact for verify training asset deployment/i,
    });
    await user.click(
      within(dependencyAlert).getByRole("button", {
        name: /view details for review dependency impact for verify training asset deployment/i,
      }),
    );
    const dependencyDetails = within(dependencyAlert).getByRole("region", {
      name: /risk alert details: review dependency impact for verify training asset deployment/i,
    });
    expect(dependencyDetails).toHaveTextContent(
      /dependency task: resolve deployment readiness blockers/i,
    );
    expect(dependencyDetails).toHaveTextContent(/status: blocked/i);
    expect(dependencyDetails).not.toHaveTextContent(/dependency task ids/i);
    expect(dependencyDetails).not.toHaveTextContent(
      /smartsheet-task-readiness-review/i,
    );

    await user.click(
      within(alert).getByRole("button", {
        name: /mark monitoring for review handoff risk for resolve deployment readiness blockers/i,
      }),
    );

    expect(alert).toHaveTextContent(/status: monitoring/i);
    const auditRegion = screen.getByRole("region", {
      name: /latest risk alert audit event/i,
    });
    expect(auditRegion).toHaveTextContent(
      /event type: task\.risk_status_updated/i,
    );
    expect(auditRegion).toHaveTextContent(/alert status: monitoring/i);
    expect(auditRegion).toHaveTextContent(/task id: smartsheet-task-readiness-review/i);
    expect(auditRegion).toHaveTextContent(/correlation id:/i);
  });

  it("scopes ingested tasks to the active launch and keeps them with generated tasks", async () => {
    const user = userEvent.setup();

    render(
      <LaunchPlanStarterPanel
        initialIngestedTasks={[
          buildIngestedTaskRecord(),
          buildIngestedTaskRecord({
            launchId: "other-launch",
            taskId: "task-other-launch",
            taskName: "Other launch task",
          }),
        ]}
        session={defaultWorkspaceSession}
      />,
    );

    const taskRegion = screen.getByRole("region", {
      name: /launch timeline tasks/i,
    });
    expect(
      within(taskRegion).getByRole("article", {
        name: /timeline task: run readiness review/i,
      }),
    ).toBeVisible();
    expect(
      within(taskRegion).queryByRole("article", {
        name: /timeline task: other launch task/i,
      }),
    ).not.toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: /generate launch plan/i }),
    );

    expect(screen.getByText(/3 of 3 timeline tasks shown/i)).toBeVisible();
    expect(
      within(taskRegion).getByRole("article", {
        name: /timeline task: confirm launch tier and scope/i,
      }),
    ).toBeVisible();
    expect(
      within(taskRegion).getByRole("article", {
        name: /timeline task: run readiness review/i,
      }),
    ).toBeVisible();
    expect(
      within(taskRegion).queryByRole("article", {
        name: /timeline task: other launch task/i,
      }),
    ).not.toBeInTheDocument();
  });

  it("resolves selected dependency details from the full task set when filters hide dependencies", async () => {
    const user = userEvent.setup();

    render(
      <LaunchPlanStarterPanel
        initialIngestedTasks={[
          buildIngestedTaskRecord({
            criticalPath: false,
            handoffRelevance: undefined,
            ownerRole: "Dependency Owner",
            taskId: "task-source-dependency",
            taskName: "Confirm source dependency",
            taskStatus: "complete",
          }),
          buildIngestedTaskRecord({
            dependencyIds: ["task-source-dependency"],
            ownerRole: "Project Manager",
            taskId: "task-dependent-review",
            taskName: "Review dependent task",
          }),
        ]}
        session={defaultWorkspaceSession}
      />,
    );

    const taskRegion = screen.getByRole("region", {
      name: /launch timeline tasks/i,
    });
    await user.click(
      within(taskRegion).getByRole("button", {
        name: /review details for review dependent task/i,
      }),
    );

    const filtersRegion = screen.getByRole("region", {
      name: /timeline task filters/i,
    });
    await user.selectOptions(
      within(filtersRegion).getByRole("combobox", { name: /owner/i }),
      "Project Manager",
    );

    expect(
      within(taskRegion).getByRole("article", {
        name: /timeline task: review dependent task/i,
      }),
    ).toBeVisible();
    expect(
      within(taskRegion).queryByRole("article", {
        name: /timeline task: confirm source dependency/i,
      }),
    ).not.toBeInTheDocument();

    const detailsRegion = screen.getByRole("region", {
      name: /timeline task details/i,
    });
    expect(detailsRegion).toHaveTextContent(
      /dependency task: confirm source dependency/i,
    );
    expect(detailsRegion).not.toHaveTextContent(/missing dependency reference/i);
  });

  it("does not show selected task details after filters hide the selected row", async () => {
    const user = userEvent.setup();

    render(<LaunchPlanStarterPanel session={defaultWorkspaceSession} />);

    await user.click(
      screen.getByRole("button", { name: /generate launch plan/i }),
    );
    await user.click(
      screen.getByRole("button", {
        name: /review details for complete deployment handoff review/i,
      }),
    );

    const detailsRegion = screen.getByRole("region", {
      name: /timeline task details/i,
    });
    expect(detailsRegion).toHaveTextContent(
      /complete deployment handoff review/i,
    );

    const filtersRegion = screen.getByRole("region", {
      name: /timeline task filters/i,
    });
    await user.selectOptions(
      within(filtersRegion).getByRole("combobox", { name: /status/i }),
      "watch",
    );

    expect(detailsRegion).not.toHaveTextContent(
      /complete deployment handoff review/i,
    );
    expect(detailsRegion).toHaveTextContent(
      /select a timeline task to review normalized metadata/i,
    );
  });

  it("shows setup validation and does not create partial tasks", async () => {
    const user = userEvent.setup();
    const onAuditEvent = vi.fn();

    render(
      <LaunchPlanStarterPanel
        onAuditEvent={onAuditEvent}
        session={defaultWorkspaceSession}
      />,
    );

    await user.clear(screen.getByRole("textbox", { name: /launch id/i }));
    await user.click(
      screen.getByRole("button", { name: /generate launch plan/i }),
    );

    expect(screen.getByRole("alert")).toHaveTextContent(/launch id is required/i);
    expect(screen.queryByRole("article", { name: /timeline task:/i }))
      .not.toBeInTheDocument();
    expect(onAuditEvent).not.toHaveBeenCalled();
  });

  it("keeps restricted Playbook details out of the non-admin DOM", () => {
    render(
      <LaunchPlanStarterPanel
        initialSources={createPrototypeLaunchPlanSources()}
        session={defaultWorkspaceSession}
      />,
    );

    const unavailableRegion = screen.getByRole("region", {
      name: /unavailable playbook templates/i,
    });

    expect(within(unavailableRegion).getByText(/restricted playbook template/i))
      .toBeVisible();
    expect(screen.queryByText(/restricted tier 4 launch playbook/i))
      .not.toBeInTheDocument();
    expect(screen.queryByText(/commercial strategy/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/src-restricted-tier-4-playbook/i))
      .not.toBeInTheDocument();
  });
});
