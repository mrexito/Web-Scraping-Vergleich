import {useTranslations} from 'next-intl';
import {Link} from '@/i18n/navigation';

export function Footer() {
  const t = useTranslations();

  return (
    <footer className="mt-24 border-t border-border bg-surface/40">
      <div className="mx-auto max-w-[1280px] px-6 py-14 lg:px-12">
        <div className="grid gap-10 md:grid-cols-3">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t('footer.project')}
            </h3>
            <ul className="mt-4 space-y-1.5 text-sm">
              <li>{t('footer.thesis')}</li>
              <li className="text-muted-foreground">{t('footer.institution')}</li>
              <li className="text-muted-foreground">{t('footer.subject')}</li>
            </ul>
          </div>
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t('footer.pages')}
            </h3>
            <ul className="mt-4 space-y-1.5 text-sm">
              <li>
                <Link href="/" className="text-muted-foreground hover:text-foreground">
                  {t('nav.comparison')}
                </Link>
              </li>
              <li>
                <Link href="/zap-info" className="text-muted-foreground hover:text-foreground">
                  {t('nav.zapInfo')}
                </Link>
              </li>
              <li>
                <Link href="/about" className="text-muted-foreground hover:text-foreground">
                  {t('nav.about')}
                </Link>
              </li>
              <li>
                <Link href="/contact" className="text-muted-foreground hover:text-foreground">
                  {t('nav.contact')}
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t('footer.legal')}
            </h3>
            <ul className="mt-4 space-y-1.5 text-sm text-muted-foreground">
              <li>{t('footer.imprint')}</li>
              <li>{t('footer.privacy')}</li>
              <li>{t('footer.sources')}</li>
            </ul>
          </div>
        </div>
        <p className="mt-12 border-t border-border pt-6 text-xs text-muted-foreground">
          {t('footer.copy', {year: new Date().getFullYear()})}
        </p>
      </div>
    </footer>
  );
}
