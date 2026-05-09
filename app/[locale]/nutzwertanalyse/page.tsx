"use client";
import { useMemo, useState } from "react";
import {
  TrendingUp,
  Award,
  Shuffle,
  Package,
  MapPin,
  Laptop,
  ArrowRight,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

type CritKey = "price" | "quality" | "location" | "flex" | "services" | "digital";

interface Criterion {
  key: CritKey;
  label: string;
  description: string;
  icon: LucideIcon;
}

const CRITERIA: Criterion[] = [
  {
    key: "price",
    label: "Preis-Leistungs-Verhältnis",
    description: "Kosten im Verhältnis zum gebotenen Wert",
    icon: TrendingUp,
  },
  {
    key: "quality",
    label: "Qualität des Unterrichts",
    description: "Lehrer-Erfahrung, kleine Klassen, Erfolgsbilanz",
    icon: Award,
  },
  {
    key: "location",
    label: "Standort & Erreichbarkeit",
    description: "Geografie, ÖV-Anbindung, Anzahl Standorte",
    icon: MapPin,
  },
  {
    key: "flex",
    label: "Flexibilität",
    description: "Distance Learning, Catch-up, Termin-Optionen",
    icon: Shuffle,
  },
  {
    key: "services",
    label: "Zusatzleistungen",
    description: "Einstufungstest, Aufsatzkorrektur, Beratung, Lernunterlagen",
    icon: Package,
  },
  {
    key: "digital",
    label: "Digitale Lernumgebung",
    description: "E-Learning Plattform, digitale Materialien, Online-Tools",
    icon: Laptop,
  },
];

const PRESETS: Record<string, Record<CritKey, number>> = {
  balanced: { price: 17, quality: 17, location: 16, flex: 17, services: 17, digital: 16 },
  price:    { price: 40, quality: 15, location: 15, flex: 10, services: 10, digital: 10 },
  quality:  { price: 10, quality: 40, location: 10, flex: 15, services: 15, digital: 10 },
  flex:     { price: 10, quality: 15, location: 10, flex: 35, services: 15, digital: 15 },
};

const PRESET_LABELS: Record<string, string> = {
  balanced: "Ausgewogen",
  price: "Preisbewusst",
  quality: "Qualitätsorientiert",
  flex: "Flexibel",
};

export default function NutzwertanalysePage() {
  const [gymType, setGymType] = useState<"lang" | "kurz">("lang");
  const [weights, setWeights] = useState<Record<CritKey, number>>(PRESETS.balanced);

  const total = useMemo(
    () => Object.values(weights).reduce((s, n) => s + n, 0),
    [weights],
  );

  const totalTone =
    total === 100
      ? "text-success border-success/30 bg-success/10"
      : total < 100
        ? "text-warning border-warning/30 bg-warning/10"
        : "text-destructive border-destructive/30 bg-destructive/10";

  const setW = (k: CritKey, v: number) =>
    setWeights((w) => ({ ...w, [k]: Math.max(0, Math.min(100, v)) }));

  return (
    <main className="mx-auto max-w-[1280px] px-6 pt-12 pb-24 lg:px-12">
      <header>
        <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
          Schritt 2 von 3
        </p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight sm:text-5xl">
          Nutzwertanalyse
        </h1>
        <p className="mt-3 max-w-2xl text-base leading-relaxed text-muted-foreground">
          Multi-Criteria Decision Analysis (MCDA): Gewichte die Kriterien nach deinen Prioritäten —
          die Top-Anbieter werden auf Basis deiner Gewichtung berechnet.
        </p>
      </header>

      {/* Step 1: Gymi-Typ */}
      <section className="mt-12">
        <h2 className="text-lg font-semibold tracking-tight">
          Für welchen Gymnasiums-Typ suchst du einen Kurs?
        </h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {(["lang", "kurz"] as const).map((k) => {
            const active = gymType === k;
            const label = k === "lang" ? "Langzeitgymnasium" : "Kurzzeitgymnasium";
            const sub = k === "lang"
              ? "6 Jahre, Eintritt nach 6. Klasse"
              : "4 Jahre, Eintritt nach 2./3. Sek";
            return (
              <button
                key={k}
                onClick={() => setGymType(k)}
                className={cn(
                  "rounded-2xl border p-5 text-left transition-all",
                  active
                    ? "border-primary bg-primary text-primary-foreground shadow-[0_0_24px_var(--accent-glow)]"
                    : "border-border bg-card hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-[var(--shadow-card-hover)]",
                )}
              >
                <div className="text-base font-semibold">{label}</div>
                <div className={cn("mt-1 text-sm", active ? "text-primary-foreground/80" : "text-muted-foreground")}>
                  {sub}
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Step 2: Presets */}
      <section className="mt-10">
        <h2 className="text-lg font-semibold tracking-tight">Schnellwahl-Presets</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Wähle ein Profil als Startpunkt — du kannst die Gewichtungen anschliessend anpassen.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {(["balanced", "price", "quality", "flex"] as const).map((p) => (
            <button
              key={p}
              onClick={() => setWeights(PRESETS[p])}
              className="rounded-full border border-border bg-surface px-4 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
            >
              {PRESET_LABELS[p]}
            </button>
          ))}
        </div>
      </section>

      {/* Step 3: Slider */}
      <section className="mt-10">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Gewichtung der Kriterien</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Je höher der Wert, desto wichtiger ist dir das Kriterium. Summe muss 100 % ergeben.
            </p>
          </div>
          <div className={cn("shrink-0 rounded-full border px-3 py-1 text-sm font-medium", totalTone)}>
            Total: <span style={{ fontVariantNumeric: "tabular-nums" }}>{total}</span> / 100
          </div>
        </div>

        <div className="mt-6 space-y-3">
          {CRITERIA.map(({ key, label, description, icon: Icon }) => (
            <div
              key={key}
              className="flex flex-wrap items-center gap-4 rounded-xl border border-border bg-card px-4 py-3.5"
            >
              <div className="flex min-w-[260px] flex-1 items-center gap-3">
                <span className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="h-4 w-4" />
                </span>
                <div>
                  <div className="text-sm font-medium">{label}</div>
                  <div className="text-xs text-muted-foreground">{description}</div>
                </div>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={weights[key]}
                onChange={(e) => setW(key, Number(e.target.value))}
                className="h-1.5 flex-1 cursor-pointer accent-[color:var(--primary)]"
              />
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={5}
                  value={weights[key]}
                  onChange={(e) => setW(key, Number(e.target.value))}
                  className="w-16 rounded-md border border-border bg-background px-2 py-1 text-right text-sm outline-none focus:border-primary"
                  style={{ fontVariantNumeric: "tabular-nums" }}
                />
                <span className="text-sm text-muted-foreground">%</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mt-10 flex flex-col items-start gap-2">
        <a
          href={total === 100
            ? `/?w=${weights.price},${weights.quality},${weights.location},${weights.flex},${weights.services},${weights.digital}#vergleich`
            : undefined}
          aria-disabled={total !== 100}
          className={cn(
            "inline-flex items-center gap-2 rounded-[10px] px-5 py-3 text-sm font-medium transition-all",
            total === 100
              ? "bg-primary text-primary-foreground hover:shadow-[0_0_24px_var(--accent-glow)]"
              : "cursor-not-allowed bg-muted text-muted-foreground pointer-events-none",
          )}
        >
          Top-Anbieter berechnen
          <ArrowRight className="h-4 w-4" />
        </a>
        {total !== 100 && (
          <p className="text-xs text-muted-foreground">
            Bitte verteile genau 100 % auf die Kriterien.
          </p>
        )}
      </section>
    </main>
  );
}
