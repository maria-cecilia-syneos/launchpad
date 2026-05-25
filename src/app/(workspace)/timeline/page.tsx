import { LaunchPlanStarterPanel } from "@/components/launchpad/LaunchPlanStarterPanel";
import { createPrototypeSmartsheetStatusTasks } from "@/domain/smartsheet-status";
import { defaultWorkspaceSession } from "@/domain/workspace";

export default function TimelinePage() {
  return (
    <LaunchPlanStarterPanel
      initialIngestedTasks={createPrototypeSmartsheetStatusTasks()}
      session={defaultWorkspaceSession}
    />
  );
}
