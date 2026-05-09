import Link from 'next/link';

export function Footer() {
  return (
    <footer className="mt-24 border-t border-border bg-surface/40">
      <div className="mx-auto max-w-[1280px] px-6 py-14 lg:px-12">
        <div className="grid gap-10 md:grid-cols-3">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Projekt
            </h3>
            <ul className="mt-4 space-y-1.5 text-sm">
              <li>Bachelor Thesis</li>
              <li className="text-muted-foreground">BFH</li>
              <li className="text-muted-foreground">Wirtschaftsinformatik</li>
            </ul>
          </div>
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Seiten
            </h3>
            <ul className="mt-4 space-y-1.5 text-sm">
              <li>
                <Link href="/" className="text-muted-foreground hover:text-foreground">
                  Vergleich
                </Link>
              </li>
              <li>
                <Link href="/zap-info" className="text-muted-foreground hover:text-foreground">
                  ZAP-Info
                </Link>
              </li>
              <li>
                <Link href="/about" className="text-muted-foreground hover:text-foreground">
                  Über uns
                </Link>
              </li>
              <li>
                <Link href="/contact" className="text-muted-foreground hover:text-foreground">
                  Kontakt
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Rechtliches
            </h3>
            <ul className="mt-4 space-y-1.5 text-sm text-muted-foreground">
              <li>Impressum</li>
              <li>Datenschutz</li>
              <li>Quellenangaben</li>
            </ul>
          </div>
        </div>
        <p className="mt-12 border-t border-border pt-6 text-xs text-muted-foreground">
          © {new Date().getFullYear()} Tami · Bachelor Thesis · Berner Fachhochschule
        </p>
      </div>
    </footer>
  );
}
