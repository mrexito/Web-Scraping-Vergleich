import { Header } from '@/components/lovable/header';

export default function PreviewHeaderPage() {
  return (
    <>
      <Header />

      <main className="mx-auto w-full max-w-[1280px] px-6 py-12 lg:px-12">

        {/* Sektion 1: Hero-ähnlicher Test-Bereich */}
        <section className="mb-16">
          <p className="mb-2 text-xs font-mono text-muted-foreground uppercase tracking-widest">
            Test 1 — Header über Hero-Content
          </p>
          <h1 className="text-4xl font-semibold tracking-tight mb-3">
            Finde den passenden Gymi-Vorbereitungskurs.
          </h1>
          <p className="text-lg text-muted-foreground">
            Vergleiche 12 Anbieter im Kanton Zürich nach deinen Prioritäten.
          </p>
          <p className="mt-4 text-sm text-muted-foreground">
            → Prüfe: Ist der Header sticky? Ändert sich das Backdrop-Blur beim Scrollen?
          </p>
        </section>

        {/* Sektion 2: Light/Dark Token-Test */}
        <section className="mb-16">
          <p className="mb-2 text-xs font-mono text-muted-foreground uppercase tracking-widest">
            Test 2 — Token-Check Light / Dark
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-lg border border-border bg-surface p-4">
              <p className="text-xs text-muted-foreground mb-1">bg-surface / text-muted-foreground</p>
              <p className="font-medium text-foreground">Normaler Text</p>
            </div>
            <div className="rounded-lg border border-border bg-card p-4">
              <p className="text-xs text-muted-foreground mb-1">bg-card / text-foreground</p>
              <p className="font-medium text-foreground">Card-Text</p>
            </div>
            <div className="rounded-lg border border-primary/30 bg-primary/10 p-4">
              <p className="text-xs text-primary mb-1">bg-primary/10 / text-primary</p>
              <p className="font-medium text-primary">Primärfarbe</p>
            </div>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            → Klicke den Moon/Sun-Button im Header. Alle Farben müssen korrekt wechseln.
          </p>
        </section>

        {/* Sektion 3: Active-State Test */}
        <section className="mb-16">
          <p className="mb-2 text-xs font-mono text-muted-foreground uppercase tracking-widest">
            Test 3 — Active-State Navigation
          </p>
          <div className="rounded-lg border border-border bg-surface p-4">
            <p className="text-sm text-foreground mb-2">
              Du bist aktuell auf <code className="bg-muted px-1 rounded text-xs">/preview-header</code>.
              Diese Route ist nicht in der Nav — kein Item sollte aktiv sein.
            </p>
            <p className="text-sm text-muted-foreground">
              → Navigiere zu <strong>/</strong>, <strong>/zap-info</strong>, <strong>/about</strong> und <strong>/contact</strong>.
              Das jeweilige Nav-Item muss hervorgehoben sein (bg-surface + text-foreground).
            </p>
          </div>
        </section>

        {/* Langer Dummy-Content zum Testen des Scroll-Effekts */}
        <section>
          <p className="mb-4 text-xs font-mono text-muted-foreground uppercase tracking-widest">
            Test 4 — Scroll-Effekt (Header-Backdrop)
          </p>
          <p className="text-sm text-muted-foreground mb-8">
            → Scrolle nach unten. Der Header-Hintergrund muss nach ~8px Scroll von
            <code className="bg-muted px-1 rounded text-xs mx-1">bg-background/40</code>
            auf
            <code className="bg-muted px-1 rounded text-xs mx-1">bg-background/80</code>
            wechseln und der Border sichtbar werden.
          </p>
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="mb-4 h-16 rounded-lg bg-surface border border-border flex items-center px-4">
              <span className="text-sm text-muted-foreground">Scroll-Platzhalter {i + 1}</span>
            </div>
          ))}
        </section>

      </main>
    </>
  );
}
