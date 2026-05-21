import { LaunchWorkspaceShell } from "@/components/launchpad/LaunchWorkspaceShell";
import { defaultWorkspaceSession } from "@/domain/workspace";

export default function WorkspaceLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <LaunchWorkspaceShell session={defaultWorkspaceSession}>
      {children}
    </LaunchWorkspaceShell>
  );
}
