type WorkspaceSurfacePlaceholderProps = {
  title: string;
  description: string;
};

export function WorkspaceSurfacePlaceholder({
  title,
  description,
}: WorkspaceSurfacePlaceholderProps) {
  return (
    <section
      aria-labelledby={`${title.toLowerCase().replaceAll(" ", "-")}-title`}
      className="rounded-lg border border-border bg-card p-6 shadow-sm"
    >
      <p className="mb-2 text-sm font-medium text-syneos-teal">
        Workspace surface
      </p>
      <h2
        className="text-2xl font-semibold tracking-normal"
        id={`${title.toLowerCase().replaceAll(" ", "-")}-title`}
      >
        {title}
      </h2>
      <p className="mt-3 max-w-2xl text-base leading-7 text-muted-foreground">
        {description}
      </p>
    </section>
  );
}
