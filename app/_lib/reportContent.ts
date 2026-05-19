// =====================================================================
// REPORT-CONTENT — i18n-fähige Variante
// =====================================================================
// Die statischen Tabellen-Daten werden zur Laufzeit aus den next-intl
// Translations gelesen. `getReportContent(t)` liefert ein vollständiges
// Content-Objekt für die Render-Komponente in app/[locale]/report/page.tsx.
//
// Die Daten-Strukturen entsprechen weiterhin der MCDA-Analyse-Logik
// (CompletenessSection, ComparisonRow), nur die String-Inhalte werden
// aus de.json / en.json bezogen.
// =====================================================================

// EXPLIZITE TYPEN
export type CompletenessRow = {
  feld: string;
  puppeteer: string;
  brightdata: string;
  sgi: string;
  note_pup?: string;
  note_bd?: string;
  note_sgi?: string;
};

export type CompletenessSection = {
  provider: string;
  expected_courses: number;
  rows: CompletenessRow[];
};

export type ComparisonRow = {
  kriterium?: string;
  aspekt?: string;
  puppeteer: string;
  brightdata: string;
  sgi: string;
};

// Translator-Typ (kompatibel zu next-intl getTranslations()-Rückgabe).
// Wir akzeptieren jede aufrufbare Funktion, die einen i18n-Key auf
// einen String mappt — das deckt sowohl `useTranslations()` aus
// 'next-intl' als auch `getTranslations()` aus 'next-intl/server' ab.
type Translator = (key: string, values?: Record<string, string | number>) => string;

// Zugriffshelfer für Translations mit Array-Index (z.B. "rows.0.aspect").
// next-intl unterstützt Listen-Zugriff via `.0`-Suffix nicht direkt;
// daher rufen wir den Translator pro Index auf.

/**
 * Liefert das vollständige Report-Content-Objekt in der aktuellen
 * Sprache. Wird in app/[locale]/report/page.tsx aufgerufen.
 */
export function getReportContent(t: Translator): {
  completenessGz: CompletenessSection;
  completenessAvidii: CompletenessSection;
  accuracyRows: ComparisonRow[];
  reliabilityRows: ComparisonRow[];
  effortRows: ComparisonRow[];
  performanceNotes: ComparisonRow[];
  developerExperienceRows: ComparisonRow[];
} {
  // --- 1. VOLLSTÄNDIGKEIT ---
  const completenessGz: CompletenessSection = {
    provider: t('report.section1.providerGz'),
    expected_courses: 26,
    rows: [
      { feld: t('report.section1.fields.coursesFound'),  puppeteer: '26 / 26', brightdata: '26 / 26', sgi: '26 / 26' },
      { feld: t('report.section1.fields.priceChf'),      puppeteer: '26 / 26', brightdata: '26 / 26', sgi: '26 / 26' },
      { feld: t('report.section1.fields.startDate'),     puppeteer: '0 / 26',  brightdata: '26 / 26', sgi: '14 / 26',
        note_pup: t('report.section1.notes.notImplemented'),
        note_sgi: t('report.section1.notes.onlyLanggymi') },
      { feld: t('report.section1.fields.endDate'),       puppeteer: '0 / 26',  brightdata: '26 / 26', sgi: '0 / 26',
        note_pup: t('report.section1.notes.notImplemented'),
        note_sgi: t('report.section1.notes.notExtracted') },
      { feld: t('report.section1.fields.location'),      puppeteer: '26 / 26', brightdata: '26 / 26', sgi: '26 / 26' },
      { feld: t('report.section1.fields.verfuegbarkeit'),puppeteer: '26 / 26', brightdata: '26 / 26', sgi: '26 / 26' },
    ],
  };

  const completenessAvidii: CompletenessSection = {
    provider: t('report.section1.providerAvidii'),
    expected_courses: 14,
    rows: [
      { feld: t('report.section1.fields.coursesFound'), puppeteer: '14 / 14', brightdata: '14 / 14', sgi: '12 / 14',
        note_sgi: t('report.section1.notes.twoCoursesMissing') },
      { feld: t('report.section1.fields.priceChf'),     puppeteer: '12 / 14', brightdata: '12 / 14', sgi: '12 / 12',
        note_pup: t('report.section1.notes.twoSingleNull'),
        note_bd:  t('report.section1.notes.twoSingleNull') },
      { feld: t('report.section1.fields.startDate'),    puppeteer: '12 / 14', brightdata: '7 / 14',  sgi: '12 / 12' },
      { feld: t('report.section1.fields.endDate'),      puppeteer: '12 / 14', brightdata: '7 / 14',  sgi: '12 / 12' },
    ],
  };

  // --- Sektion 2-6: Tabellen-Rows aus JSON-Listen lesen ---
  const buildAccuracyRows = (): ComparisonRow[] => {
    return Array.from({ length: 7 }).map((_, i) => ({
      aspekt:     t(`report.section2.rows.${i}.aspect`),
      puppeteer:  t(`report.section2.rows.${i}.puppeteer`),
      brightdata: t(`report.section2.rows.${i}.brightdata`),
      sgi:        t(`report.section2.rows.${i}.sgi`),
    }));
  };

  const buildReliabilityRows = (): ComparisonRow[] => {
    return Array.from({ length: 3 }).map((_, i) => ({
      kriterium:  t(`report.section3.rows.${i}.criterion`),
      puppeteer:  t(`report.section3.rows.${i}.puppeteer`),
      brightdata: t(`report.section3.rows.${i}.brightdata`),
      sgi:        t(`report.section3.rows.${i}.sgi`),
    }));
  };

  const buildEffortRows = (): ComparisonRow[] => {
    return Array.from({ length: 7 }).map((_, i) => ({
      kriterium:  t(`report.section4.rows.${i}.criterion`),
      puppeteer:  t(`report.section4.rows.${i}.puppeteer`),
      brightdata: t(`report.section4.rows.${i}.brightdata`),
      sgi:        t(`report.section4.rows.${i}.sgi`),
    }));
  };

  const buildPerformanceNotes = (): ComparisonRow[] => {
    return Array.from({ length: 2 }).map((_, i) => ({
      kriterium:  t(`report.section5.rows.${i}.criterion`),
      puppeteer:  t(`report.section5.rows.${i}.puppeteer`),
      brightdata: t(`report.section5.rows.${i}.brightdata`),
      sgi:        t(`report.section5.rows.${i}.sgi`),
    }));
  };

  const buildDeveloperExperienceRows = (): ComparisonRow[] => {
    return Array.from({ length: 5 }).map((_, i) => ({
      kriterium:  t(`report.section6.rows.${i}.criterion`),
      puppeteer:  t(`report.section6.rows.${i}.puppeteer`),
      brightdata: t(`report.section6.rows.${i}.brightdata`),
      sgi:        t(`report.section6.rows.${i}.sgi`),
    }));
  };

  return {
    completenessGz,
    completenessAvidii,
    accuracyRows: buildAccuracyRows(),
    reliabilityRows: buildReliabilityRows(),
    effortRows: buildEffortRows(),
    performanceNotes: buildPerformanceNotes(),
    developerExperienceRows: buildDeveloperExperienceRows(),
  };
}