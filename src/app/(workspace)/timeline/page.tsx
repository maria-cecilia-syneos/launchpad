import { LaunchPlanStarterPanel } from "@/components/launchpad/LaunchPlanStarterPanel";
import { defaultWorkspaceSession } from "@/domain/workspace";

export default function TimelinePage() {
  return <LaunchPlanStarterPanel session={defaultWorkspaceSession} />;
}
