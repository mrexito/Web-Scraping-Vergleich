"use client";
import { useState } from 'react';
import { Mail, Building2, GraduationCap } from 'lucide-react';
import { PageShell } from '@/components/lovable/page-shell';

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 border-t border-border py-3 sm:flex-row sm:items-center sm:gap-4">
      <div className="w-40 shrink-0 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="text-sm">{value}</div>
    </div>
  );
}

export default function KontaktPage() {
  const [form, setForm] = useState({ name: "", email: "", message: "" });
  const [sent, setSent] = useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const subject = encodeURIComponent(`Feedback Vergleichsportal — ${form.name}`);
    const body = encodeURIComponent(
      `Name: ${form.name}\nE-Mail: ${form.email}\n\nNachricht:\n${form.message}`
    );
    window.location.href = `mailto:martt8@bfh.ch?subject=${subject}&body=${body}`;
    setSent(true);
  };

  return (
    <PageShell
      title="Kontakt"
      subtitle="Bei Fragen, Anregungen oder Feedback zum Vergleichsportal."
    >
      <div className="mx-auto mt-10 max-w-[720px]">
        <div className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
          <h3 className="text-base font-semibold">Bachelor Thesis</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Vergleichsportal für Gymi-Vorbereitungskurse im Kanton Zürich — entwickelt im Rahmen
            einer Bachelor Thesis an der Berner Fachhochschule.
          </p>
          <div className="mt-4">
            <Row
              label="Institution"
              value={
                <span className="inline-flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  Berner Fachhochschule (BFH)
                </span>
              }
            />
            <Row
              label="Studiengang"
              value={
                <span className="inline-flex items-center gap-2">
                  <GraduationCap className="h-4 w-4 text-muted-foreground" />
                  Wirtschaftsinformatik · Departement Wirtschaft
                </span>
              }
            />
            <Row
              label="E-Mail"
              value={
                <a
                  href="mailto:martt8@bfh.ch"
                  className="inline-flex items-center gap-1.5 text-primary hover:underline"
                >
                  <Mail className="h-3.5 w-3.5" />
                  martt8@bfh.ch
                </a>
              }
            />
          </div>
        </div>

        <section className="mt-10">
          <h2 className="text-xl font-semibold tracking-tight">Fehler melden</h2>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Falls du fehlerhafte oder veraltete Daten entdeckst, melde uns dies bitte über das
            Formular unten oder direkt per E-Mail. Wir aktualisieren die Daten so schnell wie möglich.
          </p>
        </section>

        <section className="mt-10 mb-12">
          <h2 className="text-xl font-semibold tracking-tight">Feedback-Formular</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Beim Senden öffnet sich dein E-Mail-Programm mit ausgefüllter Nachricht.
          </p>
          <form onSubmit={submit} className="mt-4 space-y-3">
            <input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Name"
              className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
            />
            <input
              required
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="E-Mail"
              className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
            />
            <textarea
              required
              rows={4}
              value={form.message}
              onChange={(e) => setForm({ ...form, message: e.target.value })}
              placeholder="Nachricht"
              className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
            />
            <button
              type="submit"
              className="inline-flex items-center justify-center rounded-[10px] bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-all hover:shadow-[0_0_24px_var(--accent-glow)]"
            >
              Senden
            </button>
            {sent && (
              <p className="text-xs text-success">
                Dein E-Mail-Programm wurde geöffnet. Sende die Nachricht ab, um sie an uns zu schicken.
              </p>
            )}
          </form>
        </section>
      </div>
    </PageShell>
  );
}
