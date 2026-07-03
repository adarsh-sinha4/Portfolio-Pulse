export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-24 text-ink-muted">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-line border-t-brand" />
      {label && <p className="text-sm">{label}</p>}
    </div>
  );
}

export function ErrorState({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-rose-300/50 bg-rose-50 p-6 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
      <p className="font-medium">Something went wrong</p>
      <p className="mt-1 opacity-80">{message}</p>
    </div>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-dashed border-line bg-surface-2 p-8 text-center text-sm text-ink-muted">
      {message}
    </div>
  );
}
