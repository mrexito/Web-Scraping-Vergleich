"use client";
import {useState} from 'react';
import {Mail, Building2, GraduationCap} from 'lucide-react';
import {useTranslations} from 'next-intl';
import {PageShell} from '@/components/lovable/page-shell';

function Row({label, value}: {label: string; value: React.ReactNode}) {
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
  const t = useTranslations('contact');
  const [form, setForm] = useState({name: '', email: '', message: ''});
  const [sent, setSent] = useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const subject = encodeURIComponent(t('formSubject', {name: form.name}));
    const body = encodeURIComponent(
      t('formBody', {name: form.name, email: form.email, message: form.message})
    );
    window.location.href = `mailto:martt8@bfh.ch?subject=${subject}&body=${body}`;
    setSent(true);
  };

  return (
    <PageShell title={t('title')} subtitle={t('subtitle')}>
      <div className="mx-auto mt-10 max-w-[720px]">
        <div className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
          <h3 className="text-base font-semibold">{t('projectTitle')}</h3>
          <p className="mt-2 text-sm text-muted-foreground">{t('projectBody')}</p>
          <div className="mt-4">
            <Row
              label={t('rowInstitution')}
              value={
                <span className="inline-flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  {t('rowInstitutionValue')}
                </span>
              }
            />
            <Row
              label={t('rowProgram')}
              value={
                <span className="inline-flex items-center gap-2">
                  <GraduationCap className="h-4 w-4 text-muted-foreground" />
                  {t('rowProgramValue')}
                </span>
              }
            />
            <Row
              label={t('rowEmail')}
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
          <h2 className="text-xl font-semibold tracking-tight">{t('reportTitle')}</h2>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{t('reportBody')}</p>
        </section>

        <section className="mt-10 mb-12">
          <h2 className="text-xl font-semibold tracking-tight">{t('formTitle')}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{t('formSubtitle')}</p>
          <form onSubmit={submit} className="mt-4 space-y-3">
            <input
              required
              value={form.name}
              onChange={(e) => setForm({...form, name: e.target.value})}
              placeholder={t('formName')}
              className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
            />
            <input
              required
              type="email"
              value={form.email}
              onChange={(e) => setForm({...form, email: e.target.value})}
              placeholder={t('formEmail')}
              className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
            />
            <textarea
              required
              rows={4}
              value={form.message}
              onChange={(e) => setForm({...form, message: e.target.value})}
              placeholder={t('formMessage')}
              className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
            />
            <button
              type="submit"
              className="inline-flex items-center justify-center rounded-[10px] bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-all hover:shadow-[0_0_24px_var(--accent-glow)]"
            >
              {t('formSend')}
            </button>
            {sent && (
              <p className="text-xs text-success">{t('formSent')}</p>
            )}
          </form>
        </section>
      </div>
    </PageShell>
  );
}
