import type { ReactNode } from "react";

export function PageShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children?: ReactNode;
}) {
  return (
    <div className="mx-auto max-w-[1280px] px-6 pt-16 pb-8 lg:px-12 lg:pt-24">
      <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">{title}</h1>
      {subtitle && (
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-muted-foreground">{subtitle}</p>
      )}
      {children}
    </div>
  );
}
