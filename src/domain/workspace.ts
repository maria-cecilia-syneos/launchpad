export type WorkspaceRole =
  | "project-manager"
  | "launch-coordinator"
  | "launch-team-member"
  | "leader"
  | "admin";

export type LaunchStatus = "on-track" | "watch" | "at-risk" | "blocked";

export type SourceFreshnessState = "fresh" | "watch" | "stale" | "restricted";

export type WorkspaceSurface = {
  href: string;
  label: string;
  description: string;
  adminOnly?: boolean;
};

export type WorkspaceSession = {
  user: {
    name: string;
    role: WorkspaceRole;
    roleLabel: string;
  };
  launch: {
    id: string;
    name: string;
    status: LaunchStatus;
    statusLabel: string;
    sourceFreshness: SourceFreshnessState;
    sourceFreshnessLabel: string;
    lastRefreshedLabel: string;
  };
};

export const workspaceSurfaces: WorkspaceSurface[] = [
  {
    href: "/command-center",
    label: "Command Center",
    description: "Daily launch orientation",
  },
  {
    href: "/agent",
    label: "Agent",
    description: "Conversational launch front door",
  },
  {
    href: "/timeline",
    label: "Timeline",
    description: "Execution and task status",
  },
  {
    href: "/handoff",
    label: "Handoff",
    description: "Cross-functional readiness",
  },
  {
    href: "/sources",
    label: "Sources",
    description: "Source ledger and provenance",
  },
  {
    href: "/portfolio",
    label: "Portfolio",
    description: "Portfolio health and risks",
  },
  {
    href: "/admin",
    label: "Admin",
    description: "Source and system management",
    adminOnly: true,
  },
];

export const defaultWorkspaceSession: WorkspaceSession = {
  user: {
    name: "CeCe Rivera",
    role: "project-manager",
    roleLabel: "Project Manager",
  },
  launch: {
    id: "cardiomax",
    name: "CARDIOMAX Launch",
    status: "watch",
    statusLabel: "Watch",
    sourceFreshness: "fresh",
    sourceFreshnessLabel: "Freshness: refreshed 2 hours ago",
    lastRefreshedLabel: "Source refresh: 2 hours ago",
  },
};

export function canAccessSurface(
  role: WorkspaceRole,
  surface: WorkspaceSurface,
) {
  return !surface.adminOnly || role === "admin";
}
