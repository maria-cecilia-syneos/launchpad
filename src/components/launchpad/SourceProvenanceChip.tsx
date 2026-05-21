import { FileText, Lock, ShieldCheck } from "lucide-react";

import type { SourceCitation } from "@/domain/answer";

type SourceProvenanceChipProps = {
  citation: SourceCitation;
};

export function SourceProvenanceChip({ citation }: SourceProvenanceChipProps) {
  const Icon = citation.accessState === "restricted" ? Lock : ShieldCheck;

  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-xs font-medium text-foreground">
      <Icon aria-hidden="true" className="h-3.5 w-3.5" />
      <span>Source system: {citation.system}</span>
      <span aria-hidden="true">|</span>
      <FileText aria-hidden="true" className="h-3.5 w-3.5" />
      <span>{citation.sourceType}</span>
      <span aria-hidden="true">|</span>
      <span>Access: {citation.accessState}</span>
    </span>
  );
}
