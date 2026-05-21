import Link from "next/link";
import { Bot, ShieldCheck } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  canAccessSurface,
  type WorkspaceSession,
  workspaceSurfaces,
} from "@/domain/workspace";

type LaunchWorkspaceShellProps = {
  children: React.ReactNode;
  session: WorkspaceSession;
};

export function LaunchWorkspaceShell({
  children,
  session,
}: LaunchWorkspaceShellProps) {
  const visibleSurfaces = workspaceSurfaces.filter((surface) =>
    canAccessSurface(session.user.role, surface),
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      <a
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-card focus:px-4 focus:py-2 focus:text-foreground focus:shadow"
        href="#workspace-main"
      >
        Skip to workspace content
      </a>

      <header
        aria-label="Launch workspace context"
        className="border-b border-border bg-card"
      >
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-4 lg:flex-row lg:items-center lg:justify-between lg:px-6">
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium text-syneos-orange">
              LaunchPad
            </p>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <h1 className="text-2xl font-semibold tracking-normal">
                {session.launch.name}
              </h1>
              <span className="rounded-full border border-border px-3 py-1 text-sm font-medium">
                Status: {session.launch.statusLabel}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              {session.launch.sourceFreshnessLabel}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm">
              <ShieldCheck aria-hidden="true" className="h-4 w-4" />
              Role-filtered view: {session.user.roleLabel}
            </span>
            <Link
              aria-label="Open Agent"
              className="inline-flex min-h-11 items-center gap-2 rounded-md bg-syneos-orange px-4 py-2 text-sm font-semibold text-white hover:bg-syneos-dark-gray"
              href="/agent"
            >
              <Bot aria-hidden="true" className="h-4 w-4" />
              Open Agent
            </Link>
          </div>
        </div>

        <nav
          aria-label="Primary workspace navigation"
          className="border-t border-border"
        >
          <ul className="mx-auto flex w-full max-w-7xl gap-1 overflow-x-auto px-4 py-2 lg:px-6">
            {visibleSurfaces.map((surface) => (
              <li key={surface.href}>
                <Link
                  className={cn(
                    "block min-h-11 rounded-md px-3 py-2 text-sm font-medium text-foreground hover:bg-syneos-orange/10 hover:text-syneos-dark-gray",
                  )}
                  href={surface.href}
                  title={surface.description}
                >
                  {surface.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </header>

      <main
        className="mx-auto w-full max-w-7xl px-4 py-6 lg:px-6"
        id="workspace-main"
      >
        {children}
      </main>
    </div>
  );
}
