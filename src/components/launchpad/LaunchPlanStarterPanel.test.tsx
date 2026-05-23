import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { createPrototypeLaunchPlanSources } from "@/domain/launch-plan";
import { defaultWorkspaceSession } from "@/domain/workspace";

import { LaunchPlanStarterPanel } from "./LaunchPlanStarterPanel";

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
      name: /generated launch tasks/i,
    });
    const firstTask = within(taskRegion).getByRole("article", {
      name: /timeline task: confirm launch tier and scope/i,
    });
    const secondTask = within(taskRegion).getByRole("article", {
      name: /timeline task: complete deployment handoff review/i,
    });

    expect(firstTask).toHaveTextContent(/phase: mobilize/i);
    expect(firstTask).toHaveTextContent(/owner role: launch pm/i);
    expect(firstTask).toHaveTextContent(
      /due date logic: kickoff date minus 30 days/i,
    );
    expect(firstTask).toHaveTextContent(/handoff gate: sales to deployment readiness/i);
    expect(firstTask).toHaveTextContent(/freshness: watch/i);
    expect(firstTask).toHaveTextContent(/approval: approved/i);
    expect(secondTask).toHaveTextContent(
      /dependencies: task-cardiomax-pb-task-1/i,
    );

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

    expect(screen.getByText(/no launch tasks have been generated yet/i))
      .toBeVisible();
    expect(
      screen.getByText(/no launch generation audit event has been recorded yet/i),
    ).toBeVisible();
    expect(screen.queryByRole("article", { name: /timeline task:/i }))
      .not.toBeInTheDocument();
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
