import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LaunchWorkspaceShell } from "./LaunchWorkspaceShell";
import {
  defaultWorkspaceSession,
  type WorkspaceSession,
} from "@/domain/workspace";

describe("LaunchWorkspaceShell", () => {
  it("renders launch context, freshness, navigation, and persistent agent access", () => {
    render(
      <LaunchWorkspaceShell session={defaultWorkspaceSession}>
        <h2>Command Center</h2>
      </LaunchWorkspaceShell>,
    );

    expect(
      screen.getByRole("banner", { name: /launch workspace context/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(defaultWorkspaceSession.launch.name)).toBeVisible();
    expect(screen.getByText(/freshness: refreshed/i)).toBeVisible();

    const nav = screen.getByRole("navigation", {
      name: /primary workspace navigation/i,
    });
    expect(within(nav).getByRole("link", { name: /command center/i })).toHaveAttribute(
      "href",
      "/command-center",
    );
    expect(within(nav).getByRole("link", { name: /agent/i })).toHaveAttribute(
      "href",
      "/agent",
    );
    expect(screen.getByRole("link", { name: /open agent/i })).toHaveAttribute(
      "href",
      "/agent",
    );
  });

  it("does not reveal admin navigation for a non-admin role", () => {
    render(
      <LaunchWorkspaceShell session={defaultWorkspaceSession}>
        <h2>Command Center</h2>
      </LaunchWorkspaceShell>,
    );

    expect(
      screen.queryByRole("link", { name: /admin/i }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/restricted source/i)).not.toBeInTheDocument();
  });

  it("reveals the admin route only for an admin role", () => {
    const adminSession: WorkspaceSession = {
      ...defaultWorkspaceSession,
      user: {
        name: "Admin Reviewer",
        role: "admin",
        roleLabel: "Admin",
      },
    };

    render(
      <LaunchWorkspaceShell session={adminSession}>
        <h2>Command Center</h2>
      </LaunchWorkspaceShell>,
    );

    expect(screen.getByRole("link", { name: /admin/i })).toHaveAttribute(
      "href",
      "/admin",
    );
  });
});
