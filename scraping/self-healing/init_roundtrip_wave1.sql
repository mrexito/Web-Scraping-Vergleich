-- =====================================================================
-- init_roundtrip_wave1.sql
-- =====================================================================
-- Initialisiert scraper_registry-Einträge für die 4 SGAI-Scraper aus
-- Welle 1 des Self-Healing-Roundtrip-Rollouts.
--
-- Provider:
--   2  Lern-Forum.ch        (2 Prompts: meta, courses)
--   9  Schlaumacher         (1 Prompt:  overview)
--   11 Lernterrasse         (1 Prompt:  main)
--   12 LearningCube         (2 Prompts: overview, course)
--
-- Hinweis zum Pattern:
-- Jeder Scraper hat genau EINEN Registry-Eintrag mit field_name='prompts'.
-- current_value enthält ein JSON-Objekt mit ALLEN Sub-Prompts dieses
-- Scrapers (z.B. {"meta": "...", "courses": "..."}). Damit kann der
-- Self-Healing-Loop einzelne Sub-Prompts gezielt verbessern, ohne mehrere
-- Tabellen-Einträge pro Provider verwalten zu müssen.
--
-- Ausführung: Supabase SQL Editor → New Query → einfügen → Run.
-- Idempotent: ältere Einträge werden gelöscht und neu gesetzt.
-- =====================================================================

-- ---------------------------------------------------------------------
-- ALTE EINTRÄGE LÖSCHEN (auch das bisherige 'main_prompt'-Pattern der
-- ersten 2 Scraper, falls sie später auch auf 'prompts' umgestellt werden)
-- ---------------------------------------------------------------------
DELETE FROM scraper_registry
 WHERE scraper_method = 'scrapegraphai'
   AND provider_id IN (2, 9, 11, 12)
   AND field_name IN ('prompts', 'main_prompt');


-- ---------------------------------------------------------------------
-- Provider 2 — Lern-Forum.ch (meta + courses)
-- ---------------------------------------------------------------------
INSERT INTO scraper_registry (provider_id, scraper_method, field_name, current_value, fallback_value, last_updated_by, notes)
VALUES (
  2, 'scrapegraphai', 'prompts',
  $${"meta":"Du bist ein Datenextraktions-Assistent. Extrahiere NUR Metadaten:\n- aufsatzkorrektur, einstufungstest, e_learning, pruefungsarchiv, beratungsgespraech, lernunterlagen, pruefungssimulation, einzelkurse, unterstuetzung_ausserhalb (alle als bool)\n- unterstuetzung_ausserhalb: true wenn Nachholoptionen, Aufholstunden, Hausaufgabenbetreuung, Wiederholung verpasster Lektionen oder Unterstützung ausserhalb der Unterrichtszeiten angeboten wird\n- max_teilnehmer: Zahl\n- standorte: Liste\nAntworte NUR mit reinem JSON: {\"metadata\": {...}}","courses":"Extrahiere ALLE Kurstermine von dieser Seite. Antworte auf Deutsch.\nFür jeden Kurs: title (Deutsch), weekday (deutscher Wochentag: Montag/Dienstag/Mittwoch/Donnerstag/Freitag/Samstag/Sonntag), course_time, location, start_date (TT.MM.JJJJ), end_date, price_chf (Zahl), availability (ausgebucht/viele), is_online (bool).\nAntworte NUR mit reinem JSON: {\"courses\": [...]}"}$$,
  $${"meta":"Du bist ein Datenextraktions-Assistent. Extrahiere NUR Metadaten:\n- aufsatzkorrektur, einstufungstest, e_learning, pruefungsarchiv, beratungsgespraech, lernunterlagen, pruefungssimulation, einzelkurse, unterstuetzung_ausserhalb (alle als bool)\n- unterstuetzung_ausserhalb: true wenn Nachholoptionen, Aufholstunden, Hausaufgabenbetreuung, Wiederholung verpasster Lektionen oder Unterstützung ausserhalb der Unterrichtszeiten angeboten wird\n- max_teilnehmer: Zahl\n- standorte: Liste\nAntworte NUR mit reinem JSON: {\"metadata\": {...}}","courses":"Extrahiere ALLE Kurstermine von dieser Seite. Antworte auf Deutsch.\nFür jeden Kurs: title (Deutsch), weekday (deutscher Wochentag: Montag/Dienstag/Mittwoch/Donnerstag/Freitag/Samstag/Sonntag), course_time, location, start_date (TT.MM.JJJJ), end_date, price_chf (Zahl), availability (ausgebucht/viele), is_online (bool).\nAntworte NUR mit reinem JSON: {\"courses\": [...]}"}$$,
  'manual',
  'Lern-Forum.ch: 2 Sub-Prompts (meta + courses) als JSON-Objekt im current_value.'
);


-- ---------------------------------------------------------------------
-- Provider 9 — Schlaumacher (overview)
-- ---------------------------------------------------------------------
INSERT INTO scraper_registry (provider_id, scraper_method, field_name, current_value, fallback_value, last_updated_by, notes)
VALUES (
  9, 'scrapegraphai', 'prompts',
  $${"overview":"Du bist ein Datenextraktions-Assistent für eine Vergleichsplattform von Gymi-Vorbereitungskursen.\n\nExtrahiere ALLE Kurse von dieser Seite. Für jeden Kurs gib zurück:\n- title: Kursname (z.B. \"Langzeitgymnasium: Vorbereitung Start September: Mittwoch\")\n- course_type: \"langgymi\" oder \"kurzgymi\"\n- weekday: Wochentag(e) auf Deutsch\n- course_time: Kurszeit (z.B. \"13:30-16:30\")\n- start_date: TT.MM.JJJJ\n- end_date: TT.MM.JJJJ\n- price_chf: Gesamtpreis als Zahl\n- location: Kursort\n- course_url: URL des Kurses falls vorhanden\n- availability: \"ausgebucht\" wenn ausgebucht, sonst \"viele\"\n\nExtrahiere ausserdem Anbieter-Metadaten:\n- aufsatzkorrektur, einstufungstest, e_learning, pruefungsarchiv, beratungsgespraech, lernunterlagen, pruefungssimulation, einzelkurse, unterstuetzung_ausserhalb (alle als bool)\n- unterstuetzung_ausserhalb: true wenn Nachholoptionen, Aufholstunden, Hausaufgabenbetreuung, Wiederholung verpasster Lektionen oder Unterstützung ausserhalb der Unterrichtszeiten angeboten wird\n- max_teilnehmer: Zahl\n- standorte: Liste\n\nAntworte NUR mit reinem JSON: {\"courses\": [...], \"metadata\": {...}}"}$$,
  $${"overview":"Du bist ein Datenextraktions-Assistent für eine Vergleichsplattform von Gymi-Vorbereitungskursen.\n\nExtrahiere ALLE Kurse von dieser Seite. Für jeden Kurs gib zurück:\n- title: Kursname (z.B. \"Langzeitgymnasium: Vorbereitung Start September: Mittwoch\")\n- course_type: \"langgymi\" oder \"kurzgymi\"\n- weekday: Wochentag(e) auf Deutsch\n- course_time: Kurszeit (z.B. \"13:30-16:30\")\n- start_date: TT.MM.JJJJ\n- end_date: TT.MM.JJJJ\n- price_chf: Gesamtpreis als Zahl\n- location: Kursort\n- course_url: URL des Kurses falls vorhanden\n- availability: \"ausgebucht\" wenn ausgebucht, sonst \"viele\"\n\nExtrahiere ausserdem Anbieter-Metadaten:\n- aufsatzkorrektur, einstufungstest, e_learning, pruefungsarchiv, beratungsgespraech, lernunterlagen, pruefungssimulation, einzelkurse, unterstuetzung_ausserhalb (alle als bool)\n- unterstuetzung_ausserhalb: true wenn Nachholoptionen, Aufholstunden, Hausaufgabenbetreuung, Wiederholung verpasster Lektionen oder Unterstützung ausserhalb der Unterrichtszeiten angeboten wird\n- max_teilnehmer: Zahl\n- standorte: Liste\n\nAntworte NUR mit reinem JSON: {\"courses\": [...], \"metadata\": {...}}"}$$,
  'manual',
  'Schlaumacher: 1 Sub-Prompt (overview).'
);


-- ---------------------------------------------------------------------
-- Provider 11 — Lernterrasse (main)
-- ---------------------------------------------------------------------
INSERT INTO scraper_registry (provider_id, scraper_method, field_name, current_value, fallback_value, last_updated_by, notes)
VALUES (
  11, 'scrapegraphai', 'prompts',
  $${"main":"Du bist ein Datenextraktions-Assistent. Extrahiere alle Kurszeilen aus den Tabellen.\n\nJede Tabelle hat Spalten: Kurs, Stufe, Kurstag, Beginn am, Preis (Fr.), Anmeldung.\n\nFür jeden Kurs (Tabellenzeile):\n- course_name: Name und Zeitraum (z.B. \"Kurs A August-Februar\")\n- stufe: Schulstufe\n- weekday: Nur Wochentag (z.B. \"Mittwoch\", \"Samstag\", \"Di & Do\")\n- course_time: Nur Uhrzeit (z.B. \"14:00-16:55\")\n- start_date: TT.MM.JJJJ\n- end_date: TT.MM.JJJJ oder null\n- price_chf: Zahl\n- availability: \"ausgebucht\" wenn AUSGEBUCHT, sonst \"viele\"\n- kursabschnitt: z.B. \"Teil I-III\"\n\nEinmalig Anbieter-Metadaten:\n- aufsatzkorrektur, einstufungstest, e_learning, pruefungsarchiv, beratungsgespraech, lernunterlagen, pruefungssimulation, unterstuetzung_ausserhalb (alle als bool)\n- unterstuetzung_ausserhalb: true wenn Nachholoptionen, Aufholstunden, Hausaufgabenbetreuung, Wiederholung verpasster Lektionen oder Unterstützung ausserhalb der Unterrichtszeiten angeboten wird\n- max_teilnehmer: Zahl\n\nAntworte NUR mit reinem JSON: {\"courses\": [...], \"metadata\": {...}}"}$$,
  $${"main":"Du bist ein Datenextraktions-Assistent. Extrahiere alle Kurszeilen aus den Tabellen.\n\nJede Tabelle hat Spalten: Kurs, Stufe, Kurstag, Beginn am, Preis (Fr.), Anmeldung.\n\nFür jeden Kurs (Tabellenzeile):\n- course_name: Name und Zeitraum (z.B. \"Kurs A August-Februar\")\n- stufe: Schulstufe\n- weekday: Nur Wochentag (z.B. \"Mittwoch\", \"Samstag\", \"Di & Do\")\n- course_time: Nur Uhrzeit (z.B. \"14:00-16:55\")\n- start_date: TT.MM.JJJJ\n- end_date: TT.MM.JJJJ oder null\n- price_chf: Zahl\n- availability: \"ausgebucht\" wenn AUSGEBUCHT, sonst \"viele\"\n- kursabschnitt: z.B. \"Teil I-III\"\n\nEinmalig Anbieter-Metadaten:\n- aufsatzkorrektur, einstufungstest, e_learning, pruefungsarchiv, beratungsgespraech, lernunterlagen, pruefungssimulation, unterstuetzung_ausserhalb (alle als bool)\n- unterstuetzung_ausserhalb: true wenn Nachholoptionen, Aufholstunden, Hausaufgabenbetreuung, Wiederholung verpasster Lektionen oder Unterstützung ausserhalb der Unterrichtszeiten angeboten wird\n- max_teilnehmer: Zahl\n\nAntworte NUR mit reinem JSON: {\"courses\": [...], \"metadata\": {...}}"}$$,
  'manual',
  'Lernterrasse: 1 Sub-Prompt (main).'
);


-- ---------------------------------------------------------------------
-- Provider 12 — LearningCube (overview + course)
-- ---------------------------------------------------------------------
INSERT INTO scraper_registry (provider_id, scraper_method, field_name, current_value, fallback_value, last_updated_by, notes)
VALUES (
  12, 'scrapegraphai', 'prompts',
  $${"overview":"Du bist ein Datenextraktions-Assistent.\nExtrahiere Anbieter-Metadaten von dieser Gymivorbereitung-Übersichtsseite.\nInterpretiere die Texte semantisch — es müssen nicht die exakten Begriffe vorkommen.\n\nGib zurück:\n- aufsatzkorrektur: true wenn Aufsatztraining, Aufsatzkorrektur oder Schreibtraining erwähnt wird\n- einstufungstest: true wenn Einstufungstest, Standortbestimmung oder Lernstand ermitteln erwähnt wird\n- e_learning: true wenn Online-Kurs, E-Learning oder digitale Lernmittel erwähnt wird\n- pruefungsarchiv: true wenn alte Prüfungen oder Prüfungsarchiv erwähnt wird\n- beratungsgespraech: true wenn Beratungsgespräch oder Erstgespräch erwähnt wird\n- lernunterlagen: true wenn Lernmaterial oder Lehrmittel inbegriffen\n- pruefungssimulation: true wenn Simulationsprüfung oder Probeprüfung erwähnt wird\n- einzelkurse: true wenn Einzelunterricht angeboten wird\n- unterstuetzung_ausserhalb: true wenn Nachholoptionen, Aufholstunden, Hausaufgabenbetreuung, Wiederholung verpasster Lektionen oder Unterstützung ausserhalb der Unterrichtszeiten angeboten wird\n- max_teilnehmer: maximale Gruppengrösse als Zahl (z.B. 3)\n- standort: Kursort (z.B. \"Meilen\")\n\nAntworte NUR mit reinem JSON: {\"metadata\": {...}}","course":"Du bist ein Datenextraktions-Assistent. Extrahiere ALLE Kursinformationen von dieser Kursseite.\nEs können mehrere Kurstermine auf einer Seite sein (z.B. Mittwoch und Samstag).\n\nFür jeden Kurs/Termin gib zurück:\n- course_name: Name des Kurses\n- course_type: \"langgymi\" oder \"kurzgymi\"\n- weekday: Wochentag auf Deutsch\n- course_time: Kurszeit (z.B. \"17:30-19:30\")\n- start_date: Startdatum im Format TT.MM.JJJJ\n- end_date: Enddatum im Format TT.MM.JJJJ\n- location: Kursort (z.B. \"Meilen\")\n- price_chf: Preis in CHF als Zahl\n- max_teilnehmer: Maximale Teilnehmerzahl als Zahl\n- availability: \"ausgebucht\" wenn ausgebucht, sonst \"viele\"\n\nGib ausserdem einmalig Anbieter-Metadaten zurück (dieselben Felder wie oben, inkl. unterstuetzung_ausserhalb).\n\nAntworte NUR mit reinem JSON: {\"courses\": [{...}], \"metadata\": {...}}"}$$,
  $${"overview":"Du bist ein Datenextraktions-Assistent.\nExtrahiere Anbieter-Metadaten von dieser Gymivorbereitung-Übersichtsseite.\nInterpretiere die Texte semantisch — es müssen nicht die exakten Begriffe vorkommen.\n\nGib zurück:\n- aufsatzkorrektur: true wenn Aufsatztraining, Aufsatzkorrektur oder Schreibtraining erwähnt wird\n- einstufungstest: true wenn Einstufungstest, Standortbestimmung oder Lernstand ermitteln erwähnt wird\n- e_learning: true wenn Online-Kurs, E-Learning oder digitale Lernmittel erwähnt wird\n- pruefungsarchiv: true wenn alte Prüfungen oder Prüfungsarchiv erwähnt wird\n- beratungsgespraech: true wenn Beratungsgespräch oder Erstgespräch erwähnt wird\n- lernunterlagen: true wenn Lernmaterial oder Lehrmittel inbegriffen\n- pruefungssimulation: true wenn Simulationsprüfung oder Probeprüfung erwähnt wird\n- einzelkurse: true wenn Einzelunterricht angeboten wird\n- unterstuetzung_ausserhalb: true wenn Nachholoptionen, Aufholstunden, Hausaufgabenbetreuung, Wiederholung verpasster Lektionen oder Unterstützung ausserhalb der Unterrichtszeiten angeboten wird\n- max_teilnehmer: maximale Gruppengrösse als Zahl (z.B. 3)\n- standort: Kursort (z.B. \"Meilen\")\n\nAntworte NUR mit reinem JSON: {\"metadata\": {...}}","course":"Du bist ein Datenextraktions-Assistent. Extrahiere ALLE Kursinformationen von dieser Kursseite.\nEs können mehrere Kurstermine auf einer Seite sein (z.B. Mittwoch und Samstag).\n\nFür jeden Kurs/Termin gib zurück:\n- course_name: Name des Kurses\n- course_type: \"langgymi\" oder \"kurzgymi\"\n- weekday: Wochentag auf Deutsch\n- course_time: Kurszeit (z.B. \"17:30-19:30\")\n- start_date: Startdatum im Format TT.MM.JJJJ\n- end_date: Enddatum im Format TT.MM.JJJJ\n- location: Kursort (z.B. \"Meilen\")\n- price_chf: Preis in CHF als Zahl\n- max_teilnehmer: Maximale Teilnehmerzahl als Zahl\n- availability: \"ausgebucht\" wenn ausgebucht, sonst \"viele\"\n\nGib ausserdem einmalig Anbieter-Metadaten zurück (dieselben Felder wie oben, inkl. unterstuetzung_ausserhalb).\n\nAntworte NUR mit reinem JSON: {\"courses\": [{...}], \"metadata\": {...}}"}$$,
  'manual',
  'LearningCube: 2 Sub-Prompts (overview + course).'
);


-- ---------------------------------------------------------------------
-- VERIFIKATION — alle Welle-1-Einträge anzeigen
-- ---------------------------------------------------------------------
SELECT
  provider_id,
  scraper_method,
  field_name,
  LENGTH(current_value)             AS chars,
  jsonb_object_keys(current_value::jsonb) AS sub_keys,
  last_updated_by,
  last_updated_at
FROM scraper_registry
WHERE scraper_method = 'scrapegraphai'
  AND provider_id IN (2, 9, 11, 12)
ORDER BY provider_id, sub_keys;