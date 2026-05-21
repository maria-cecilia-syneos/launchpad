import { AgentChatShell } from "@/components/launchpad/AgentChatShell";
import { defaultWorkspaceSession } from "@/domain/workspace";

export default function AgentPage() {
  return <AgentChatShell session={defaultWorkspaceSession} />;
}
