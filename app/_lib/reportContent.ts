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


// 1. VOLLSTÄNDIGKEIT 
export const COMPLETENESS_GZ: CompletenessSection = {
  provider: 'Gymivorbereitung Zürich (ID 1)',
  expected_courses: 26,
  rows: [
    { feld: 'Kurse gefunden',  puppeteer: '26 / 26', brightdata: '26 / 26', sgi: '26 / 26' },
    { feld: 'price_chf',       puppeteer: '26 / 26', brightdata: '26 / 26', sgi: '26 / 26' },
    { feld: 'start_date',      puppeteer: '0 / 26',  brightdata: '26 / 26', sgi: '14 / 26',
      note_pup: 'Nicht implementiert', note_sgi: 'Nur langgymi' },
    { feld: 'end_date',        puppeteer: '0 / 26',  brightdata: '26 / 26', sgi: '0 / 26',
      note_pup: 'Nicht implementiert', note_sgi: 'Nicht extrahiert' },
    { feld: 'location',        puppeteer: '26 / 26', brightdata: '26 / 26', sgi: '26 / 26' },
    { feld: 'verfuegbarkeit',  puppeteer: '26 / 26', brightdata: '26 / 26', sgi: '26 / 26' },
  ],
};

export const COMPLETENESS_AVIDII: CompletenessSection = {
  provider: 'Avidii (ID 3)',
  expected_courses: 14,
  rows: [
    { feld: 'Kurse gefunden',  puppeteer: '14 / 14', brightdata: '14 / 14', sgi: '12 / 14',
      note_sgi: '2 Kurse fehlen' },
    { feld: 'price_chf',       puppeteer: '12 / 14', brightdata: '12 / 14', sgi: '12 / 12',
      note_pup: '2 Einzelk. = null', note_bd: '2 Einzelk. = null' },
    { feld: 'start_date',      puppeteer: '12 / 14', brightdata: '7 / 14',  sgi: '12 / 12' },
    { feld: 'end_date',        puppeteer: '12 / 14', brightdata: '7 / 14',  sgi: '12 / 12' },
  ],
};

// 2. GENAUIGKEIT
export const ACCURACY_ROWS: ComparisonRow[] = [
  {
    aspekt: 'Preis Gymivorbereitung Zürich',
    puppeteer: 'CHF 3290 — direkt aus DOM',
    brightdata: 'CHF 3290 — direkt extrahiert',
    sgi: 'CHF 3290 — via LLM',
  },
  {
    aspekt: 'Preis Avidii',
    puppeteer: 'Aus .pricing-box — direkt',
    brightdata: 'Fallback-Preis hardcoded (CHF 2950 / 3650) — Risiko bei Preisänderung',
    sgi: 'Aus Seiteninhalt via LLM',
  },
  {
    aspekt: 'Datumsformat',
    puppeteer: '«27. Aug 2025» → ISO. GZ: start/end_date fehlt!',
    brightdata: 'ISO & DD.MM.JJJJ — korrekt konvertiert',
    sgi: 'DD.MM.JJJJ → ISO. GZ: nur 14/26 befüllt',
  },
  {
    aspekt: 'Verfügbarkeit',
    puppeteer: 'CSS-Farbe + Text — normalisiert korrekt',
    brightdata: 'Link-Text erkannt — Regex bereinigt',
    sgi: 'LLM-Interpretation',
  },
  {
    aspekt: 'Einzelkurs',
    puppeteer: 'price_chf = null',
    brightdata: 'price_chf = null',
    sgi: 'price_chf = null',
  },
  {
    aspekt: 'Online-Kurse',
    puppeteer: 'CSS / Text-Check',
    brightdata: 'Feld «online» direkt vorhanden',
    sgi: 'LLM erkennt Online-Indikatoren',
  },
  {
    aspekt: 'Frühbucherrabatt',
    puppeteer: 'price_regular_chf + discount_valid_until',
    brightdata: 'price_regular_chf + discount_valid_until',
    sgi: 'price_regular_chf + discount_valid_until',
  },
];


// 3. ZUVERLÄSSIGKEIT
export const RELIABILITY_ROWS: ComparisonRow[] = [
  {
    kriterium: 'Häufige Fehlertypen',
    puppeteer: 'INSERT_ERROR (2×), COURSEDETAILS_ERROR, METADATA_ERROR',
    brightdata: 'Timeout-Risiko (120s), Fallback-Preis-Risiko',
    sgi: 'LLM-Halluzination, BFH-VPN Pflicht, Inkonsistente Resultate',
  },
  {
    kriterium: 'Hauptrisiko',
    puppeteer: 'Layout-Änderung → Selektoren brechen',
    brightdata: 'API-Ausfall / Fallback-Preis veraltet',
    sgi: 'LLM-Variabilität — Kurse können fehlen',
  },
  {
    kriterium: 'Konsistenz über Läufe',
    puppeteer: 'Sehr hoch — gleiche Ergebnisse',
    brightdata: 'Hoch — BD-API stabil',
    sgi: 'Mittel — LLM kann variieren',
  },
];

// 4. AUFWAND UND KOSTEN
export const EFFORT_ROWS: ComparisonRow[] = [
  {
    kriterium: 'Code-Zeilen',
    puppeteer: 'Ca. 400 LOC — hohe Komplexität',
    brightdata: 'Ca. 200 LOC — mittlere Komplexität',
    sgi: 'Ca. 150 LOC — niedrige Komplexität',
  },
  {
    kriterium: 'Setup-Aufwand',
    puppeteer: 'Mittel — Puppeteer + Website-Analyse',
    brightdata: 'Hoch — BD-Account + Collector konfigurieren',
    sgi: 'Niedrig — Library + Prompt schreiben',
  },
  {
    kriterium: 'Wartungsaufwand',
    puppeteer: 'Hoch — bei Layout-Änderungen',
    brightdata: 'Mittel — Collector-Schema',
    sgi: 'Niedrig — nur Prompt anpassen',
  },
  {
    kriterium: 'Kosten pro Run',
    puppeteer: 'CHF 0.00 — kostenlos',
    brightdata: 'Kostenpflichtig — pro API-Request',
    sgi: 'CHF 0.00 — BFH LLM kostenlos',
  },
  {
    kriterium: 'Externe Abhängigkeiten',
    puppeteer: 'Keine — nur npm-Packages',
    brightdata: 'BD-Account + API-Token + Collector-ID',
    sgi: 'BFH-VPN + BFH API-Key',
  },
  {
    kriterium: 'Portierbarkeit',
    puppeteer: 'Mittel — Code websitespezifisch',
    brightdata: 'Hoch — Collector konfigurierbar',
    sgi: 'Sehr hoch — nur Prompt ändern',
  },
  {
    kriterium: 'Technologie',
    puppeteer: 'TypeScript / Node.js / Puppeteer',
    brightdata: 'Python / BrightData REST API',
    sgi: 'Python / ScrapeGraphAI + BFH LLM 120B',
  },
];


// 5. PERFORMANCE
export const PERFORMANCE_NOTES: ComparisonRow[] = [
  {
    kriterium: 'Parallelisierung',
    puppeteer: 'Nein — sequenziell pro URL',
    brightdata: 'Ja (API) — alle URLs in einem Call',
    sgi: 'Nein — sequenziell pro URL',
  },
  {
    kriterium: 'Flaschenhals',
    puppeteer: 'networkidle2 — warten auf volles Laden',
    brightdata: 'Polling 10s-Intervall, max. 120s Timeout',
    sgi: 'LLM-Inferenzzeit — 120B Parameter-Modell',
  },
];


// 6. ENTWICKLER-ERFAHRUNG
export const DEVELOPER_EXPERIENCE_ROWS: ComparisonRow[] = [
  {
    kriterium: 'Geschätzte Implementierungszeit (gesamt)',
    puppeteer: 'Ca. 5 Tage für 5 Scraper inkl. Refactoring',
    brightdata: 'Ca. 2 Tage für 2 Scraper inkl. Account-Setup',
    sgi: 'Ca. 3 Tage für 12 Scraper inkl. Prompt-Engineering',
  },
  {
    kriterium: 'Lernkurve',
    puppeteer: 'Steil — viel CSS-Selektor-Wissen nötig',
    brightdata: 'Steil — proprietäres Collector-Konzept',
    sgi: 'Flach — Prompt-Engineering ist intuitiv',
  },
  {
    kriterium: 'Debugging-Erfahrung',
    puppeteer: 'Klar nachvollziehbar — DevTools + Selektor-Test',
    brightdata: 'Schwierig — Black-Box-Verhalten der API',
    sgi: 'Schwierig — LLM liefert manchmal unverständlich anderes Ergebnis',
  },
  {
    kriterium: 'Frustrations-Quellen',
    puppeteer: 'Layout-Änderungen, Cookie-Banner, dynamische Inhalte',
    brightdata: 'Account-Sperrung beim Testing, schwer reproduzierbare Timeouts',
    sgi: 'BFH-VPN-Probleme, LLM-Halluzinationen, JSON-Parsing-Fails',
  },
  {
    kriterium: 'Spass-Faktor',
    puppeteer: 'Mittel — CSS-Detektivarbeit kann fesseln',
    brightdata: 'Niedrig — fühlt sich an wie API-Wrapper',
    sgi: 'Hoch — kreatives Prompt-Engineering, schnelle Resultate',
  },
];

// EINLEITUNG / ABSTRACT

export const REPORT_INTRO = `
Die vorliegende Analyse vergleicht drei Scraping-Methoden, die im Rahmen
meiner Bachelorthesis zur Erstellung eines Vergleichsportals für Gymi-Vorbereitungskurse
zum Einsatz kommen: Puppeteer (browser-automatisiert), Bright Data (Cloud-Service)
und ScrapeGraphAI (LLM-basiert). Die Bewertung folgt fünf Kriterien:
- Vollständigkeit
- Genauigkeit
- Zuverlässigkeit
- Aufwand & Kosten
- Performance
- Entwickler-Erfahrung
`.trim();

export const REPORT_CONCLUSION = `
Die drei Scraping-Methoden weisen unterschiedliche Stärken auf: 
- Puppeteer ist am zuverlässigsten und am genauesten, erfordert aber den höchsten Implementierungs-
und Wartungsaufwand. 
- Bright Data ist am schnellsten und am wartungsärmsten, jedoch
kostenpflichtig und stark abhängig vom externen Service. 
- ScrapeGraphAI hat die flachste Lernkurve und den geringsten Code-Aufwand, ist aber langsamer und
inkonsistenter. 

`.trim();