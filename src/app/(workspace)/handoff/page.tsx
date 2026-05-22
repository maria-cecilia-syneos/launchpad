import { HandoffRequestPanel } from "@/components/launchpad/HandoffRequestPanel";
import { defaultWorkspaceSession } from "@/domain/workspace";

export default function HandoffPage() {
  return <HandoffRequestPanel session={defaultWorkspaceSession} />;
}
