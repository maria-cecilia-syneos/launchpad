import { cn } from "@/lib/utils";

type FoundationStatusProps = {
  className?: string;
};

export function FoundationStatus({ className }: FoundationStatusProps) {
  return (
    <section
      aria-labelledby="foundation-status-title"
      className={cn(
        "mx-auto flex w-full max-w-3xl flex-col gap-6 rounded-lg border border-border bg-card p-8 text-card-foreground shadow-sm",
        className,
      )}
    >
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium text-syneos-orange">
          LaunchPad foundation
        </p>
        <h1
          id="foundation-status-title"
          className="text-3xl font-semibold tracking-normal text-foreground"
        >
          Application scaffold is ready for LaunchPad stories.
        </h1>
      </div>
      <p className="text-base leading-7 text-muted-foreground">
        Next.js App Router, TypeScript, Tailwind CSS, shadcn-compatible
        utilities, architecture folders, and baseline verification tooling are
        in place for the next implementation slice.
      </p>
    </section>
  );
}
