-- =====================================================================
-- init_avidii_roundtrip.sql
-- =====================================================================
-- Initialisiert den scraper_registry-Eintrag für Avidii (Provider 3,
-- ScrapeGraphAI, main_prompt).
--
-- Dies aktiviert den Self-Healing-Roundtrip:
--   sGAI_avidiiScraper.py liest beim Start mittels load_prompt()
--   den Wert aus dieser Tabelle und nutzt ihn statt HARDCODED_PROMPT.
--
-- Ausführung: Supabase SQL Editor → New Query → einfügen → Run.
-- =====================================================================

-- Bestehenden Eintrag löschen (falls vorhanden), damit das Script
-- idempotent ist und mehrfach ausgeführt werden kann.
DELETE FROM scraper_registry
 WHERE provider_id    = 3
   AND scraper_method = 'scrapegraphai'
   AND field_name     = 'main_prompt';

-- Neuen Eintrag setzen.
-- WICHTIG: current_value und fallback_value sind hier INITIAL gleich.
-- Sobald der Self-Healing-Loop einen verbesserten Prompt schreibt,
-- wird current_value überschrieben, fallback_value bleibt als Notausstieg.
INSERT INTO scraper_registry (
    provider_id,
    scraper_method,
    field_name,
    current_value,
    fallback_value,
    last_updated_by,
    notes
) VALUES (
    3,
    'scrapegraphai',
    'main_prompt',
    -- Identisch mit HARDCODED_PROMPT in sGAI_avidiiScraper.py
    $$Du bist ein Datenextraktions-Assistent. Extrahiere alle Kurszeilen aus dieser Webseite.

Für jeden Kurs gib folgende Felder zurück:
- course_name: Name des Kurses (z.B. "Gruppenkurs Mittwoch", "Einzelkurs")
- weekday: Wochentag (z.B. "Mittwoch")
- course_time: Uhrzeit (z.B. "14:00-17:30")
- location: Kursort (z.B. "Zürich", "Online")
- start_date: Startdatum im Format TT.MM.JJJJ (z.B. "27.08.2025")
- end_date: Enddatum im Format TT.MM.JJJJ falls vorhanden (z.B. "15.04.2026")
- price_chf: Gruppenpreis in CHF als Zahl (z.B. 2950). Nur Gruppenpreise, keine Einzelstundenpreise.
- availability: Verfügbarkeitsstatus (z.B. "Freie Plätze", "Wenige Plätze", "Ausgebucht")
- is_online: true wenn Kurs online stattfindet, sonst false

Gib auch folgende Anbieter-Metadaten zurück:
- aufsatzkorrektur: true wenn Aufsatztraining oder Aufsatzkorrektur erwähnt wird
- einstufungstest: true wenn Standortbestimmung oder Einstufungstest erwähnt wird
- e_learning: true wenn Lerncockpit, Google Classroom oder E-Learning erwähnt wird
- pruefungsarchiv: true wenn alte Prüfungen oder Prüfungstraining erwähnt wird
- beratungsgespraech: true wenn Erstgespräch oder Beratungsgespräch erwähnt wird
- lernunterlagen: true wenn Kursmaterial oder Lernmaterial erwähnt wird
- pruefungssimulation: true wenn Prüfungssimulation oder Testprüfung erwähnt wird
- einzelkurse: true wenn Einzelunterricht oder Privatnachhilfe angeboten wird
- unterstuetzung_ausserhalb: true wenn Nachholoptionen, Aufholstunden, Hausaufgabenbetreuung, Wiederholung verpasster Lektionen oder Unterstützung ausserhalb der Unterrichtszeiten angeboten wird
- max_teilnehmer: maximale Gruppengrösse als Zahl (z.B. 8)
- standorte: kommagetrennte Liste aller Standorte (z.B. "Zürich, Online")

Antworte NUR mit einem JSON-Objekt mit den Feldern "courses" (Liste) und "metadata" (Objekt).$$,
    -- fallback_value: gleicher Initial-Prompt (für Rollback)
    $$Du bist ein Datenextraktions-Assistent. Extrahiere alle Kurszeilen aus dieser Webseite.

Für jeden Kurs gib folgende Felder zurück:
- course_name: Name des Kurses (z.B. "Gruppenkurs Mittwoch", "Einzelkurs")
- weekday: Wochentag (z.B. "Mittwoch")
- course_time: Uhrzeit (z.B. "14:00-17:30")
- location: Kursort (z.B. "Zürich", "Online")
- start_date: Startdatum im Format TT.MM.JJJJ (z.B. "27.08.2025")
- end_date: Enddatum im Format TT.MM.JJJJ falls vorhanden (z.B. "15.04.2026")
- price_chf: Gruppenpreis in CHF als Zahl (z.B. 2950). Nur Gruppenpreise, keine Einzelstundenpreise.
- availability: Verfügbarkeitsstatus (z.B. "Freie Plätze", "Wenige Plätze", "Ausgebucht")
- is_online: true wenn Kurs online stattfindet, sonst false

Gib auch folgende Anbieter-Metadaten zurück:
- aufsatzkorrektur: true wenn Aufsatztraining oder Aufsatzkorrektur erwähnt wird
- einstufungstest: true wenn Standortbestimmung oder Einstufungstest erwähnt wird
- e_learning: true wenn Lerncockpit, Google Classroom oder E-Learning erwähnt wird
- pruefungsarchiv: true wenn alte Prüfungen oder Prüfungstraining erwähnt wird
- beratungsgespraech: true wenn Erstgespräch oder Beratungsgespräch erwähnt wird
- lernunterlagen: true wenn Kursmaterial oder Lernmaterial erwähnt wird
- pruefungssimulation: true wenn Prüfungssimulation oder Testprüfung erwähnt wird
- einzelkurse: true wenn Einzelunterricht oder Privatnachhilfe angeboten wird
- unterstuetzung_ausserhalb: true wenn Nachholoptionen, Aufholstunden, Hausaufgabenbetreuung, Wiederholung verpasster Lektionen oder Unterstützung ausserhalb der Unterrichtszeiten angeboten wird
- max_teilnehmer: maximale Gruppengrösse als Zahl (z.B. 8)
- standorte: kommagetrennte Liste aller Standorte (z.B. "Zürich, Online")

Antworte NUR mit einem JSON-Objekt mit den Feldern "courses" (Liste) und "metadata" (Objekt).$$,
    'init_script',
    'Initial-Prompt für Avidii. Wird vom Self-Healing-Loop überschrieben.'
);

-- Verifizieren
SELECT
    provider_id,
    scraper_method,
    field_name,
    LEFT(current_value, 80) AS preview,
    last_updated_by,
    last_updated_at
FROM scraper_registry
WHERE provider_id = 3
  AND scraper_method = 'scrapegraphai';