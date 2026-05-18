-- =====================================================================
-- init_roundtrip_wave3.sql
-- =====================================================================
-- Initialisiert scraper_registry-Einträge für die 3 SGAI-Scraper aus
-- Welle 3 des Self-Healing-Roundtrip-Rollouts.
--
-- Provider:
--   4  Learning Culture       (5 Prompts: meta + 4 Kursarten)
--   7  Schule Zürich Nord     (overview + 2 PDF-Prompts)
--   8  Open Learning Space    (overview + kursseite)
--
-- Mit Welle 3 ist die SGAI-Roundtrip-Coverage komplett: 12/12 Scraper.
--
-- Ausführung: Supabase SQL Editor → New Query → einfügen → Run.
-- Idempotent: ältere Einträge werden gelöscht und neu gesetzt.
-- =====================================================================

DELETE FROM scraper_registry
 WHERE scraper_method = 'scrapegraphai'
   AND provider_id IN (4, 7, 8)
   AND field_name IN ('prompts', 'main_prompt');



-- ---------------------------------------------------------------------
-- Provider 4 — Learning Culture
-- meta + langgymi_kurse + kurzgymi_t1 + kurzgymi_t2 + probezeit (5 eigenständige Prompts)
-- ---------------------------------------------------------------------
INSERT INTO scraper_registry (provider_id, scraper_method, field_name, current_value, fallback_value, last_updated_by, notes)
VALUES (
  4, 'scrapegraphai', 'prompts',
  $${"meta": "Du bist ein Datenextraktions-Assistent. Extrahiere NUR die Metadaten (keine Kurse):\n- aufsatzkorrektur, einstufungstest, e_learning, pruefungsarchiv, beratungsgespraech, lernunterlagen, pruefungssimulation, einzelkurse, unterstuetzung_ausserhalb (alle als bool)\n- unterstuetzung_ausserhalb: true wenn Nachholoptionen, Aufholstunden, Hausaufgabenbetreuung, Wiederholung verpasster Lektionen oder Unterst\u00fctzung ausserhalb der Unterrichtszeiten angeboten wird\n- max_teilnehmer: Zahl\n- standorte: Liste\nAntworte NUR mit reinem JSON: {\"metadata\": {...}}", "langgymi_kurse": "Du bist ein Datenextraktions-Assistent. Extrahiere ALLE Kurstermine, Kurse oder Anmelde-Eintr\u00e4ge die auf dieser Seite erscheinen \u2014 egal wie sie genannt sind (z.B. 'Kurs', 'Vorbereitungskurs', 'Teil 1', 'Teil 1+', 'Teil 2', 'Intensivkurs', 'Sportferienkurs', 'Simulationspr\u00fcfung', 'Themenkurs', oder einfach nur Datums-/Zeit-Angaben in einer Tabelle).\n\nTypische Hinweise auf einen Kurs: Wochentag + Uhrzeit + Datum + Preis + Ort.\nWenn du eine Tabelle mit Anmelde-Buttons siehst, extrahiere JEDE Zeile.\n\nF\u00fcr jeden Kurs gib zur\u00fcck:\n- title: Was der Kurs auf der Seite hei\u00dft (z.B. 'Teil 1', 'Kurs A', 'Vorbereitungskurs', 'Intensivkurs Herbstferien'). Wenn kein Name erkennbar: 'Gymivorbereitung'.\n- weekday: Wochentag (Montag, Mittwoch, Samstag, ...)\n- course_time: Kurszeit (z.B. '13:30 - 16:45')\n- location: Ort (z.B. 'Z\u00fcrich Stadelhofen', 'Winterthur', 'Horgen')\n- start_date, end_date: Format TT.MM.JJJJ\n- price_chf: Preis als Zahl\n- availability: 'ausgebucht' wenn ausgebucht, sonst 'viele'\n\nWICHTIG: Auch wenn die Kursnamen nicht 'Teil 1+/1/2' sind \u2014 extrahiere trotzdem alles. Lieber zu viele Kurse als zu wenige.\nAntworte NUR mit reinem JSON: {\"courses\": [...]}", "kurzgymi_t1": "Extrahiere ALLE Teil 1+ und Teil 1 Kurstermine.\nF\u00fcr jeden: title (Teil 1+ oder Teil 1), weekday, course_time, location, start_date, end_date (TT.MM.JJJJ), price_chf (Teil 1+: 3190, Teil 1: 1890), availability.\nAntworte NUR mit reinem JSON: {\"courses\": [...]}", "kurzgymi_t2": "Extrahiere die Teil 2 Kurstermine.\nF\u00fcr jeden: title (Teil 2), weekday, course_time, location, start_date, end_date, price_chf (~2110), availability.\nAntworte NUR mit reinem JSON: {\"courses\": [...]}", "probezeit": "Extrahiere ALLE Probezeit-Kurse. F\u00fcr jeden:\n- title (z.B. 'Langgymi Mathematik')\n- course_type: 'langgymi' oder 'kurzgymi'\n- weekday, course_time, location\n- start_date, end_date (TT.MM.JJJJ)\n- price_chf (~980)\n- availability\n- is_online: false\nAntworte NUR mit reinem JSON: {\"courses\": [...]}"}$$,
  $${"meta": "Du bist ein Datenextraktions-Assistent. Extrahiere NUR die Metadaten (keine Kurse):\n- aufsatzkorrektur, einstufungstest, e_learning, pruefungsarchiv, beratungsgespraech, lernunterlagen, pruefungssimulation, einzelkurse, unterstuetzung_ausserhalb (alle als bool)\n- unterstuetzung_ausserhalb: true wenn Nachholoptionen, Aufholstunden, Hausaufgabenbetreuung, Wiederholung verpasster Lektionen oder Unterst\u00fctzung ausserhalb der Unterrichtszeiten angeboten wird\n- max_teilnehmer: Zahl\n- standorte: Liste\nAntworte NUR mit reinem JSON: {\"metadata\": {...}}", "langgymi_kurse": "Du bist ein Datenextraktions-Assistent. Extrahiere ALLE Kurstermine, Kurse oder Anmelde-Eintr\u00e4ge die auf dieser Seite erscheinen \u2014 egal wie sie genannt sind (z.B. 'Kurs', 'Vorbereitungskurs', 'Teil 1', 'Teil 1+', 'Teil 2', 'Intensivkurs', 'Sportferienkurs', 'Simulationspr\u00fcfung', 'Themenkurs', oder einfach nur Datums-/Zeit-Angaben in einer Tabelle).\n\nTypische Hinweise auf einen Kurs: Wochentag + Uhrzeit + Datum + Preis + Ort.\nWenn du eine Tabelle mit Anmelde-Buttons siehst, extrahiere JEDE Zeile.\n\nF\u00fcr jeden Kurs gib zur\u00fcck:\n- title: Was der Kurs auf der Seite hei\u00dft (z.B. 'Teil 1', 'Kurs A', 'Vorbereitungskurs', 'Intensivkurs Herbstferien'). Wenn kein Name erkennbar: 'Gymivorbereitung'.\n- weekday: Wochentag (Montag, Mittwoch, Samstag, ...)\n- course_time: Kurszeit (z.B. '13:30 - 16:45')\n- location: Ort (z.B. 'Z\u00fcrich Stadelhofen', 'Winterthur', 'Horgen')\n- start_date, end_date: Format TT.MM.JJJJ\n- price_chf: Preis als Zahl\n- availability: 'ausgebucht' wenn ausgebucht, sonst 'viele'\n\nWICHTIG: Auch wenn die Kursnamen nicht 'Teil 1+/1/2' sind \u2014 extrahiere trotzdem alles. Lieber zu viele Kurse als zu wenige.\nAntworte NUR mit reinem JSON: {\"courses\": [...]}", "kurzgymi_t1": "Extrahiere ALLE Teil 1+ und Teil 1 Kurstermine.\nF\u00fcr jeden: title (Teil 1+ oder Teil 1), weekday, course_time, location, start_date, end_date (TT.MM.JJJJ), price_chf (Teil 1+: 3190, Teil 1: 1890), availability.\nAntworte NUR mit reinem JSON: {\"courses\": [...]}", "kurzgymi_t2": "Extrahiere die Teil 2 Kurstermine.\nF\u00fcr jeden: title (Teil 2), weekday, course_time, location, start_date, end_date, price_chf (~2110), availability.\nAntworte NUR mit reinem JSON: {\"courses\": [...]}", "probezeit": "Extrahiere ALLE Probezeit-Kurse. F\u00fcr jeden:\n- title (z.B. 'Langgymi Mathematik')\n- course_type: 'langgymi' oder 'kurzgymi'\n- weekday, course_time, location\n- start_date, end_date (TT.MM.JJJJ)\n- price_chf (~980)\n- availability\n- is_online: false\nAntworte NUR mit reinem JSON: {\"courses\": [...]}"}$$,
  'manual',
  'Learning Culture: 5 Sub-Prompt(s).'
);


-- ---------------------------------------------------------------------
-- Provider 7 — Schule Zürich Nord
-- overview (HTML) + pdf_langgymi + pdf_kurzgymi (3 Prompts; PDFs via pypdf + BFH LLM)
-- ---------------------------------------------------------------------
INSERT INTO scraper_registry (provider_id, scraper_method, field_name, current_value, fallback_value, last_updated_by, notes)
VALUES (
  7, 'scrapegraphai', 'prompts',
  $${"overview": "\nDu bist ein Datenextraktions-Assistent. Extrahiere Anbieter-Metadaten:\n\n- aufsatzkorrektur, einstufungstest, e_learning, pruefungsarchiv, beratungsgespraech,\n  lernunterlagen, pruefungssimulation, einzelkurse, unterstuetzung_ausserhalb (alle als bool)\n- unterstuetzung_ausserhalb: true wenn Nachholoptionen, Aufholstunden, Hausaufgabenbetreuung,\n  Wiederholung verpasster Lektionen oder Unterst\u00fctzung ausserhalb der Unterrichtszeiten\n  angeboten wird\n- max_teilnehmer: Zahl oder null\n- standort: Adresse\n- ausgebuchte_kurse: Liste der als AUSGEBUCHT markierten Kurse\n\nAntworte NUR mit reinem JSON: {\"metadata\": {...}}\n", "pdf_langgymi": "\nExtrahiere alle Kursinformationen aus diesem PDF-Text.\nEs gibt Kurs M (Mittwoch), Kurs S (Samstag), Kurs F (Ferienkurs).\n\nF\u00fcr jeden Kurs:\n- kurs_name: NUR \"Kurs M\", \"Kurs S\" oder \"Kurs F\"\n- course_type: \"langgymi\"\n- weekday: Wochentag (z.B. \"Mittwoch\", \"Samstag\")\n- course_time: Kurszeit (z.B. \"13:30-16:00\")\n- start_date, end_date (TT.MM.JJJJ)\n- price_chf: Zahl\n- availability: \"ausgebucht\" oder \"viele\"\n\nAntworte NUR mit reinem JSON: {\"courses\": [...]}\n\nPDF-Inhalt:\n", "pdf_kurzgymi": "\nExtrahiere alle Kursinformationen aus diesem PDF-Text.\n\nF\u00fcr jeden Kurs:\n- kurs_name: NUR kurze Bezeichnung (z.B. \"Kurzgymi Mittwoch\")\n- course_type: \"kurzgymi\"\n- weekday: Wochentag\n- course_time: Kurszeit\n- start_date, end_date (TT.MM.JJJJ)\n- price_chf: Zahl\n- availability: \"ausgebucht\" oder \"viele\"\n\nAntworte NUR mit reinem JSON: {\"courses\": [...]}\n\nPDF-Inhalt:\n"}$$,
  $${"overview": "\nDu bist ein Datenextraktions-Assistent. Extrahiere Anbieter-Metadaten:\n\n- aufsatzkorrektur, einstufungstest, e_learning, pruefungsarchiv, beratungsgespraech,\n  lernunterlagen, pruefungssimulation, einzelkurse, unterstuetzung_ausserhalb (alle als bool)\n- unterstuetzung_ausserhalb: true wenn Nachholoptionen, Aufholstunden, Hausaufgabenbetreuung,\n  Wiederholung verpasster Lektionen oder Unterst\u00fctzung ausserhalb der Unterrichtszeiten\n  angeboten wird\n- max_teilnehmer: Zahl oder null\n- standort: Adresse\n- ausgebuchte_kurse: Liste der als AUSGEBUCHT markierten Kurse\n\nAntworte NUR mit reinem JSON: {\"metadata\": {...}}\n", "pdf_langgymi": "\nExtrahiere alle Kursinformationen aus diesem PDF-Text.\nEs gibt Kurs M (Mittwoch), Kurs S (Samstag), Kurs F (Ferienkurs).\n\nF\u00fcr jeden Kurs:\n- kurs_name: NUR \"Kurs M\", \"Kurs S\" oder \"Kurs F\"\n- course_type: \"langgymi\"\n- weekday: Wochentag (z.B. \"Mittwoch\", \"Samstag\")\n- course_time: Kurszeit (z.B. \"13:30-16:00\")\n- start_date, end_date (TT.MM.JJJJ)\n- price_chf: Zahl\n- availability: \"ausgebucht\" oder \"viele\"\n\nAntworte NUR mit reinem JSON: {\"courses\": [...]}\n\nPDF-Inhalt:\n", "pdf_kurzgymi": "\nExtrahiere alle Kursinformationen aus diesem PDF-Text.\n\nF\u00fcr jeden Kurs:\n- kurs_name: NUR kurze Bezeichnung (z.B. \"Kurzgymi Mittwoch\")\n- course_type: \"kurzgymi\"\n- weekday: Wochentag\n- course_time: Kurszeit\n- start_date, end_date (TT.MM.JJJJ)\n- price_chf: Zahl\n- availability: \"ausgebucht\" oder \"viele\"\n\nAntworte NUR mit reinem JSON: {\"courses\": [...]}\n\nPDF-Inhalt:\n"}$$,
  'manual',
  'Schule Zürich Nord: 3 Sub-Prompt(s).'
);


-- ---------------------------------------------------------------------
-- Provider 8 — Open Learning Space
-- overview + kursseite (kursseite wird für Langgymi und Kurzgymi geteilt)
-- ---------------------------------------------------------------------
INSERT INTO scraper_registry (provider_id, scraper_method, field_name, current_value, fallback_value, last_updated_by, notes)
VALUES (
  8, 'scrapegraphai', 'prompts',
  $${"overview": "\nDu bist ein Datenextraktions-Assistent f\u00fcr eine Vergleichsplattform von Gymi-Vorbereitungskursen.\n\nExtrahiere ALLE Kurse (Langzeit- und Kurzzeitgymnasium) von dieser Seite.\nF\u00fcr jeden Kurs gib zur\u00fcck:\n- course_type: \"langgymi\" oder \"kurzgymi\"\n- weekday: Wochentag auf Deutsch\n- course_time: Kurszeit (z.B. \"14:00-16:45\")\n- start_date: TT.MM.JJJJ\n- end_date: TT.MM.JJJJ\n- price_chf: Preis als Zahl\n- location: Kursort\n- max_teilnehmer: Zahl\n\nExtrahiere zus\u00e4tzlich Anbieter-Metadaten:\n- aufsatzkorrektur, einstufungstest, e_learning, pruefungsarchiv, beratungsgespraech,\n  lernunterlagen, pruefungssimulation, einzelkurse, unterstuetzung_ausserhalb (alle als bool)\n- unterstuetzung_ausserhalb: true wenn Nachholoptionen, Aufholstunden, Hausaufgabenbetreuung,\n  Wiederholung verpasster Lektionen oder Unterst\u00fctzung ausserhalb der Unterrichtszeiten\n  angeboten wird\n- max_teilnehmer: Zahl\n- standorte: Liste aller Standorte\n\nAntworte NUR mit reinem JSON: {\"courses\": [...], \"metadata\": {...}}\n", "kursseite": "\nDu bist ein Datenextraktions-Assistent. Extrahiere alle Kurse von dieser Seite.\n\nF\u00fcr jeden Kurs gib zur\u00fcck:\n- course_type: \"langgymi\" oder \"kurzgymi\"\n- weekday: Wochentag\n- course_time: Kurszeit\n- start_date: TT.MM.JJJJ\n- end_date: TT.MM.JJJJ\n- price_chf: Zahl\n- location: Kursort\n- max_teilnehmer: Zahl\n- availability: \"ausgebucht\" oder \"viele\"\n\nExtrahiere zus\u00e4tzlich Metadaten (dieselben Felder wie in der \u00dcbersicht, inkl. unterstuetzung_ausserhalb).\n\nAntworte NUR mit reinem JSON: {\"courses\": [...], \"metadata\": {...}}\n"}$$,
  $${"overview": "\nDu bist ein Datenextraktions-Assistent f\u00fcr eine Vergleichsplattform von Gymi-Vorbereitungskursen.\n\nExtrahiere ALLE Kurse (Langzeit- und Kurzzeitgymnasium) von dieser Seite.\nF\u00fcr jeden Kurs gib zur\u00fcck:\n- course_type: \"langgymi\" oder \"kurzgymi\"\n- weekday: Wochentag auf Deutsch\n- course_time: Kurszeit (z.B. \"14:00-16:45\")\n- start_date: TT.MM.JJJJ\n- end_date: TT.MM.JJJJ\n- price_chf: Preis als Zahl\n- location: Kursort\n- max_teilnehmer: Zahl\n\nExtrahiere zus\u00e4tzlich Anbieter-Metadaten:\n- aufsatzkorrektur, einstufungstest, e_learning, pruefungsarchiv, beratungsgespraech,\n  lernunterlagen, pruefungssimulation, einzelkurse, unterstuetzung_ausserhalb (alle als bool)\n- unterstuetzung_ausserhalb: true wenn Nachholoptionen, Aufholstunden, Hausaufgabenbetreuung,\n  Wiederholung verpasster Lektionen oder Unterst\u00fctzung ausserhalb der Unterrichtszeiten\n  angeboten wird\n- max_teilnehmer: Zahl\n- standorte: Liste aller Standorte\n\nAntworte NUR mit reinem JSON: {\"courses\": [...], \"metadata\": {...}}\n", "kursseite": "\nDu bist ein Datenextraktions-Assistent. Extrahiere alle Kurse von dieser Seite.\n\nF\u00fcr jeden Kurs gib zur\u00fcck:\n- course_type: \"langgymi\" oder \"kurzgymi\"\n- weekday: Wochentag\n- course_time: Kurszeit\n- start_date: TT.MM.JJJJ\n- end_date: TT.MM.JJJJ\n- price_chf: Zahl\n- location: Kursort\n- max_teilnehmer: Zahl\n- availability: \"ausgebucht\" oder \"viele\"\n\nExtrahiere zus\u00e4tzlich Metadaten (dieselben Felder wie in der \u00dcbersicht, inkl. unterstuetzung_ausserhalb).\n\nAntworte NUR mit reinem JSON: {\"courses\": [...], \"metadata\": {...}}\n"}$$,
  'manual',
  'Open Learning Space: 2 Sub-Prompt(s).'
);


-- ---------------------------------------------------------------------
-- VERIFIKATION
-- ---------------------------------------------------------------------
SELECT
  provider_id,
  scraper_method,
  field_name,
  LENGTH(current_value)                   AS chars,
  jsonb_object_keys(current_value::jsonb) AS sub_keys,
  last_updated_by,
  last_updated_at
FROM scraper_registry
WHERE scraper_method = 'scrapegraphai'
  AND provider_id IN (4, 7, 8)
ORDER BY provider_id, sub_keys;