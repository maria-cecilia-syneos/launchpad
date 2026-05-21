import { SourceLedgerPanel } from "@/components/launchpad/SourceLedgerPanel";
import { defaultWorkspaceSession } from "@/domain/workspace";

export default function SourcesPage() {
  return <SourceLedgerPanel session={defaultWorkspaceSession} />;
}
