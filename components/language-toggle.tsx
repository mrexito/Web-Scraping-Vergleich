export function LanguageToggle() {
  return (
    <div className="flex items-center gap-1 rounded-lg border border-border bg-surface p-0.5 text-xs font-medium">
      <button
        className="rounded-md px-2 py-1 bg-background text-foreground shadow-sm"
        aria-pressed={true}
        disabled
      >
        DE
      </button>
      <button
        className="rounded-md px-2 py-1 text-muted-foreground"
        aria-pressed={false}
        disabled
      >
        EN
      </button>
    </div>
  );
}
