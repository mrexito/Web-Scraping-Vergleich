"use client";
import { Check, ExternalLink, Star, X } from "lucide-react";
import { useEffect } from "react";
import type { Provider } from "@/lib/mock-providers";
import { formatCHF } from "@/lib/format";
import { cn } from "@/lib/utils";

function Stars({ n }: { n: number }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {Array.from({ length: 3 }).map((_, i) => (
        <Star
          key={i}
          className={cn(
            "h-3.5 w-3.5",
            i < n ? "fill-warning text-warning" : "text-border",
          )}
        />
      ))}
    </span>
  );
}

function availLabel(a: Provider["availability"]) {
  if (a === "viele_plaetze") return "Viele Plätze";
  if (a === "wenige_plaetze") return "Wenige Plätze";
  return "Ausgebucht";
}

function ServiceRow({
  label,
  has,
  isNew,
}: {
  label: string;
  has: boolean;
  isNew?: boolean;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border bg-surface/40 px-3 py-2.5">
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "grid h-5 w-5 place-items-center rounded-full",
            has ? "bg-success/15 text-success" : "bg-muted text-muted-foreground",
          )}
        >
          {has ? <Check className="h-3 w-3" strokeWidth={3} /> : <X className="h-3 w-3" strokeWidth={3} />}
        </span>
        <span className="text-sm">{label}</span>
      </div>
      {isNew && (
        <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold tracking-wider text-primary">
          NEU
        </span>
      )}
    </div>
  );
}

export function ProviderSheet({
  provider,
  onClose,
}: {
  provider: Provider | null;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!provider) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [provider, onClose]);

  const open = !!provider;

  return (
    <>
      <div
        onClick={onClose}
        aria-hidden
        className={cn(
          "fixed inset-0 z-50 bg-foreground/30 backdrop-blur-sm transition-opacity duration-200",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={provider?.name ?? ""}
        className={cn(
          "fixed inset-y-0 right-0 z-50 flex w-full max-w-[640px] flex-col border-l border-border bg-background shadow-2xl transition-transform duration-300",
          open ? "translate-x-0" : "translate-x-full",
        )}
      >
        {provider && (
          <>
            <div className="flex items-start justify-between gap-4 border-b border-border px-7 py-5">
              <div>
                <h2 className="text-2xl font-semibold tracking-tight">{provider.name}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{provider.shortDescription}</p>
              </div>
              <button
                onClick={onClose}
                aria-label="Schliessen"
                className="grid h-9 w-9 place-items-center rounded-lg border border-border bg-surface text-muted-foreground transition-colors hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-7 py-6">
              <section>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { k: "Qualität", v: <Stars n={provider.quality} /> },
                    { k: "Teilnehmer", v: <span style={{ fontVariantNumeric: "tabular-nums" }}>{provider.maxParticipants}</span> },
                    { k: "Standort", v: provider.locations.join(", ") },
                    { k: "Verfügbarkeit", v: availLabel(provider.availability) },
                  ].map((it, i) => (
                    <div key={i} className="rounded-xl border border-border bg-surface/40 px-4 py-3">
                      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{it.k}</div>
                      <div className="mt-1.5 text-sm font-medium">{it.v}</div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="mt-8">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Kurse</h3>
                <div className="mt-4 overflow-hidden rounded-xl border border-border">
                  <table className="w-full text-sm">
                    <thead className="bg-surface/60 text-[11px] uppercase tracking-wider text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2.5 text-left font-medium">Kurs</th>
                        <th className="px-3 py-2.5 text-left font-medium">Standort</th>
                        <th className="px-3 py-2.5 text-left font-medium">Tag</th>
                        <th className="px-3 py-2.5 text-left font-medium">Zeit</th>
                        <th className="px-3 py-2.5 text-right font-medium">Preis</th>
                      </tr>
                    </thead>
                    <tbody>
                      {provider.courses.map((c) => (
                        <tr key={c.id} className="border-t border-border">
                          <td className="px-3 py-2.5 font-medium">{c.label}</td>
                          <td className="px-3 py-2.5 text-muted-foreground">{c.location}</td>
                          <td className="px-3 py-2.5 text-muted-foreground">{c.day}</td>
                          <td className="px-3 py-2.5 text-muted-foreground" style={{ fontVariantNumeric: "tabular-nums" }}>{c.time}</td>
                          <td className="px-3 py-2.5 text-right">
                            {c.originalPrice && (
                              <div className="text-[11px] text-muted-foreground line-through" style={{ fontVariantNumeric: "tabular-nums" }}>
                                {formatCHF(c.originalPrice)}
                              </div>
                            )}
                            <div className="font-medium" style={{ fontVariantNumeric: "tabular-nums" }}>{formatCHF(c.price)}</div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className="mt-8">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Leistungen</h3>
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  <ServiceRow label="E-Learning" has={provider.hasELearning} />
                  <ServiceRow label="Einstufungstest" has={provider.hasEinstufungstest} />
                  <ServiceRow label="Prüfungsarchiv" has={provider.hasPruefungsarchiv} />
                  <ServiceRow label="Aufsatzkorrektur" has={provider.hasAufsatzkorrektur} />
                  <ServiceRow label="Lernunterlagen" has={provider.hasLernunterlagen} />
                  <ServiceRow label="Beratungsgespräch" has={provider.hasBeratungsgespraech} />
                  <ServiceRow label="Distance Learning" has={provider.hasDistanceLearning} isNew />
                  <ServiceRow label="Digitale Materialien" has={provider.hasDigitalMaterials} isNew />
                  <ServiceRow label="Nachhol-Möglichkeiten" has={provider.hasCatchUpOptions} isNew />
                </div>
              </section>
            </div>

            <div className="border-t border-border bg-surface/40 px-7 py-5">
              <a
                href={provider.websiteUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex w-full items-center justify-center gap-2 rounded-[10px] bg-primary px-4 py-3 text-sm font-medium text-primary-foreground shadow-sm transition-all hover:opacity-90"
              >
                Zum Anbieter
                <ExternalLink className="h-4 w-4" />
              </a>
              <p className="mt-2 truncate text-center text-xs text-muted-foreground">{provider.websiteUrl}</p>
            </div>
          </>
        )}
      </aside>
    </>
  );
}
