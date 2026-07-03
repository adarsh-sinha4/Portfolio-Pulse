export function Card({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-line bg-surface-2 p-5">
      <div className="mb-4">
        <h2 className="text-sm font-semibold">{title}</h2>
        {subtitle && <p className="text-xs text-ink-muted">{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}
