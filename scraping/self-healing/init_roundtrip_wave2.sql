-- =====================================================================
-- init_roundtrip_wave2.sql
-- =====================================================================
-- Initialisiert scraper_registry-Einträge für die 3 SGAI-Scraper aus
-- Welle 2 des Self-Healing-Roundtrip-Rollouts.
--
-- Provider:
--   5  Gymivorbereitung Fokus  (overview + langgymi, kurzgymi derived)
--   6  Nachhilfe Akademie      (overview + preise_lang, preise_kurz derived)
--   10 Logos Lehrerteam        (metadata + kursdaten + kosten)
--
-- Pattern: 1 Registry-Eintrag pro Scraper mit field_name='prompts' und
-- einem JSON-Objekt im current_value, das alle Sub-Prompts hält.
--
-- WICHTIG zum 'derived prompt'-Pattern:
-- Bei Provider 5 und 6 enthält die Registry nur die LANGGYMI-Variante.
-- Der KURZGYMI-Prompt wird im Python-Code per .replace() generiert. Damit
-- pflegt der Self-Healing-Loop nur EINE Variante; die Symmetrie der
-- Provider-Website-Sprache wird respektiert.
--
-- Ausführung: Supabase SQL Editor → New Query → einfügen → Run.
-- Idempotent: ältere Einträge werden gelöscht und neu gesetzt.
-- =====================================================================

DELETE FROM scraper_registry
 WHERE scraper_method = 'scrapegraphai'
   AND provider_id IN (5, 6, 10)
   AND field_name IN ('prompts', 'main_prompt');



-- ---------------------------------------------------------------------
-- Provider 5 — Gymivorbereitung Fokus
-- overview + langgymi (kurzgymi = derived via String-Replace 'Langzeit'→'Kurzzeit')
-- ---------------------------------------------------------------------
INSERT INTO scraper_registry (provider_id, scraper_method, field_name, current_value, fallback_value, last_updated_by, notes)
VALUES (
  5, 'scrapegraphai', 'prompts',
  $${"overview": "Du bist ein Datenextraktions-Assistent. Extrahiere Anbieter-Metadaten von dieser Seite:\n- aufsatzkorrektur, einstufungstest, e_learning, pruefungsarchiv, beratungsgespraech, lernunterlagen, pruefungssimulation, einzelkurse, unterstuetzung_ausserhalb (alle als bool)\n- unterstuetzung_ausserhalb: true wenn Nachholoptionen, Aufholstunden, Hausaufgabenbetreuung, Wiederholung verpasster Lektionen oder Unterst\u00fctzung ausserhalb der Unterrichtszeiten angeboten wird\n- max_teilnehmer: Zahl\n- standorte: Liste\nAntworte NUR mit reinem JSON: {\"metadata\": {...}}", "langgymi": "Du bist ein Datenextraktions-Assistent. Extrahiere ALLE Kurse und Preise.\nF\u00fcr jeden Kurs:\n- kurs_id: Kurs-Buchstabe\n- weekday: Wochentag (Mittwoch/Samstag/...)\n- course_time: Kurszeit\n- location: echter Standortname (Z\u00fcrich HB, B\u00fclach, Winterthur, Stadelhofen, Wetzikon, Uster, Meilen, Horgen, W\u00e4denswil, Schaffhausen, Online). NIE 'NA' oder 'unbekannt'.\n- is_online: bool\nZus\u00e4tzlich:\n- price_chf, price_online_chf (Zahlen)\n- start_kw, end_kw (Kalenderwochen als Zahl)\n- num_kurstage (Zahl)\nAntworte NUR mit JSON: {\"courses\": [...], \"price_chf\": ..., \"price_online_chf\": ..., \"start_kw\": ..., \"end_kw\": ..., \"num_kurstage\": ...}"}$$,
  $${"overview": "Du bist ein Datenextraktions-Assistent. Extrahiere Anbieter-Metadaten von dieser Seite:\n- aufsatzkorrektur, einstufungstest, e_learning, pruefungsarchiv, beratungsgespraech, lernunterlagen, pruefungssimulation, einzelkurse, unterstuetzung_ausserhalb (alle als bool)\n- unterstuetzung_ausserhalb: true wenn Nachholoptionen, Aufholstunden, Hausaufgabenbetreuung, Wiederholung verpasster Lektionen oder Unterst\u00fctzung ausserhalb der Unterrichtszeiten angeboten wird\n- max_teilnehmer: Zahl\n- standorte: Liste\nAntworte NUR mit reinem JSON: {\"metadata\": {...}}", "langgymi": "Du bist ein Datenextraktions-Assistent. Extrahiere ALLE Kurse und Preise.\nF\u00fcr jeden Kurs:\n- kurs_id: Kurs-Buchstabe\n- weekday: Wochentag (Mittwoch/Samstag/...)\n- course_time: Kurszeit\n- location: echter Standortname (Z\u00fcrich HB, B\u00fclach, Winterthur, Stadelhofen, Wetzikon, Uster, Meilen, Horgen, W\u00e4denswil, Schaffhausen, Online). NIE 'NA' oder 'unbekannt'.\n- is_online: bool\nZus\u00e4tzlich:\n- price_chf, price_online_chf (Zahlen)\n- start_kw, end_kw (Kalenderwochen als Zahl)\n- num_kurstage (Zahl)\nAntworte NUR mit JSON: {\"courses\": [...], \"price_chf\": ..., \"price_online_chf\": ..., \"start_kw\": ..., \"end_kw\": ..., \"num_kurstage\": ...}"}$$,
  'manual',
  'Gymivorbereitung Fokus: 2 Sub-Prompt(s).'
);


-- ---------------------------------------------------------------------
-- Provider 6 — Nachhilfe Akademie
-- overview + preise_lang (preise_kurz = derived via String-Replace 'Langgymnasium'→'Kurzgymnasium')
-- ---------------------------------------------------------------------
INSERT INTO scraper_registry (provider_id, scraper_method, field_name, current_value, fallback_value, last_updated_by, notes)
VALUES (
  6, 'scrapegraphai', 'prompts',
  $${"overview": "\nDu bist ein Datenextraktions-Assistent f\u00fcr eine Vergleichsplattform von Gymi-Vorbereitungskursen.\n\nExtrahiere ALLE Kurse (Langzeit- und Kurzzeitgymnasium, schulbegleitend und Ferienkurse)\naus der \u00dcbersichtstabelle auf dieser Seite.\nF\u00fcr jeden Kurs gib zur\u00fcck:\n- course_type: \"langgymi\" oder \"kurzgymi\"\n- title: Kurzname (z.B. \"Gymivorbereitung Mittwoch\", \"Intensivkurs Herbstferien 1\")\n- weekday: Wochentag auf Deutsch\n- course_time: Kurszeit (z.B. \"14:00-17:15\")\n- start_date: TT.MM.JJJJ\n- end_date: TT.MM.JJJJ (leer wenn nicht vorhanden)\n- location: Kursort\n- kursart: \"schulbegleitend\" oder \"ferienkurs\"\n- availability: \"viele\"\n\nExtrahiere zus\u00e4tzlich Anbieter-Metadaten:\n- aufsatzkorrektur, einstufungstest, e_learning, pruefungsarchiv, beratungsgespraech,\n  lernunterlagen, pruefungssimulation, einzelkurse, unterstuetzung_ausserhalb (alle als bool)\n- unterstuetzung_ausserhalb: true wenn Nachholoptionen, Aufholstunden, Hausaufgabenbetreuung,\n  Wiederholung verpasster Lektionen oder Unterst\u00fctzung ausserhalb der Unterrichtszeiten\n  angeboten wird\n- max_teilnehmer: Zahl\n- standorte: Liste aller Standorte\n\nAntworte NUR mit reinem JSON: {\"courses\": [...], \"metadata\": {...}}\n", "preise_lang": "\nExtrahiere die Preise f\u00fcr Gymivorbereitungskurse Langgymnasium.\n\nGib zur\u00fcck:\n- preis_4er_gruppe_gesamt: Gesamtpreis f\u00fcr 4er-Gruppe als Zahl in CHF\n- preis_2er_gruppe_gesamt: Gesamtpreis f\u00fcr 2er-Gruppe als Zahl in CHF\n- preis_privat_gesamt: Gesamtpreis f\u00fcr Einzelunterricht als Zahl in CHF\n- preis_ferienkurs_gruppe: Preis Ferienkurs Gruppe als Zahl in CHF\n- preis_ferienkurs_privat: Preis Ferienkurs Privat als Zahl in CHF\n- anmeldegebuehr: Anmeldegeb\u00fchr als Zahl in CHF\n\nAntworte NUR mit reinem JSON: {\"preise\": {...}}\n"}$$,
  $${"overview": "\nDu bist ein Datenextraktions-Assistent f\u00fcr eine Vergleichsplattform von Gymi-Vorbereitungskursen.\n\nExtrahiere ALLE Kurse (Langzeit- und Kurzzeitgymnasium, schulbegleitend und Ferienkurse)\naus der \u00dcbersichtstabelle auf dieser Seite.\nF\u00fcr jeden Kurs gib zur\u00fcck:\n- course_type: \"langgymi\" oder \"kurzgymi\"\n- title: Kurzname (z.B. \"Gymivorbereitung Mittwoch\", \"Intensivkurs Herbstferien 1\")\n- weekday: Wochentag auf Deutsch\n- course_time: Kurszeit (z.B. \"14:00-17:15\")\n- start_date: TT.MM.JJJJ\n- end_date: TT.MM.JJJJ (leer wenn nicht vorhanden)\n- location: Kursort\n- kursart: \"schulbegleitend\" oder \"ferienkurs\"\n- availability: \"viele\"\n\nExtrahiere zus\u00e4tzlich Anbieter-Metadaten:\n- aufsatzkorrektur, einstufungstest, e_learning, pruefungsarchiv, beratungsgespraech,\n  lernunterlagen, pruefungssimulation, einzelkurse, unterstuetzung_ausserhalb (alle als bool)\n- unterstuetzung_ausserhalb: true wenn Nachholoptionen, Aufholstunden, Hausaufgabenbetreuung,\n  Wiederholung verpasster Lektionen oder Unterst\u00fctzung ausserhalb der Unterrichtszeiten\n  angeboten wird\n- max_teilnehmer: Zahl\n- standorte: Liste aller Standorte\n\nAntworte NUR mit reinem JSON: {\"courses\": [...], \"metadata\": {...}}\n", "preise_lang": "\nExtrahiere die Preise f\u00fcr Gymivorbereitungskurse Langgymnasium.\n\nGib zur\u00fcck:\n- preis_4er_gruppe_gesamt: Gesamtpreis f\u00fcr 4er-Gruppe als Zahl in CHF\n- preis_2er_gruppe_gesamt: Gesamtpreis f\u00fcr 2er-Gruppe als Zahl in CHF\n- preis_privat_gesamt: Gesamtpreis f\u00fcr Einzelunterricht als Zahl in CHF\n- preis_ferienkurs_gruppe: Preis Ferienkurs Gruppe als Zahl in CHF\n- preis_ferienkurs_privat: Preis Ferienkurs Privat als Zahl in CHF\n- anmeldegebuehr: Anmeldegeb\u00fchr als Zahl in CHF\n\nAntworte NUR mit reinem JSON: {\"preise\": {...}}\n"}$$,
  'manual',
  'Nachhilfe Akademie: 2 Sub-Prompt(s).'
);


-- ---------------------------------------------------------------------
-- Provider 10 — Logos Lehrerteam
-- metadata + kursdaten + kosten (alle eigenständig)
-- ---------------------------------------------------------------------
INSERT INTO scraper_registry (provider_id, scraper_method, field_name, current_value, fallback_value, last_updated_by, notes)
VALUES (
  10, 'scrapegraphai', 'prompts',
  $${"metadata": "\nDu bist ein Datenextraktions-Assistent. Analysiere diese Seite semantisch:\n\n- aufsatzkorrektur: true wenn Aufsatztraining, Aufsatzkurs oder Schreibtraining erw\u00e4hnt wird\n- einstufungstest: true wenn Einstufungstest, Standortbestimmung, Minimalnoten erw\u00e4hnt werden\n- e_learning: true wenn digitales Lehrmittel, E-Learning oder Online-Plattform (z.B. edulo) erw\u00e4hnt wird\n- pruefungsarchiv: true wenn Probepr\u00fcfungen oder Simulationspr\u00fcfungen erw\u00e4hnt werden\n- beratungsgespraech: true wenn Beratung oder Kontakt angeboten wird\n- lernunterlagen: true wenn Lehrmittel, Arbeitsheft oder Kursmaterial inbegriffen ist\n- pruefungssimulation: true wenn Simulationspr\u00fcfung explizit erw\u00e4hnt wird\n- einzelkurse: true wenn Einzelunterricht oder Privatunterricht angeboten werden\n- unterstuetzung_ausserhalb: true wenn Nachholoptionen, Aufholstunden, Hausaufgabenbetreuung, Wiederholung verpasster Lektionen oder Unterst\u00fctzung ausserhalb der Unterrichtszeiten angeboten wird\n- max_teilnehmer: maximale Gruppengr\u00f6sse als Zahl\n- standorte: Liste aller Kursorte\n\nAntworte NUR mit reinem JSON: {\"metadata\": {...}}\n", "kursdaten": "\nExtrahiere alle Kursinformationen. Kurse in 3 Teile (Teil 1, 2, 3) an Mittwoch oder Samstag.\nAusserdem Ferienkurse (Intensivkurse).\n\nF\u00fcr jeden Kursabschnitt:\n- kursabschnitt: \"Teil 1\", \"Teil 2\", \"Teil 3\", \"Herbstferienkurs 1\", etc.\n- kurstyp_intern: \"schulbegleitend\" oder \"ferienkurs\"\n- weekdays: Liste der Wochentage (z.B. [\"Mittwoch\", \"Samstag\"])\n- start_date_mi, end_date_mi (TT.MM.JJJJ, f\u00fcr Mittwochkurse)\n- start_date_sa, end_date_sa (TT.MM.JJJJ, f\u00fcr Samstagkurse)\n- dauer_wochen: Zahl\n\nAntworte NUR mit reinem JSON: {\"kurse\": [...]}\n", "kosten": "\nExtrahiere Preisinformationen:\n- preis_gesamt: Gesamtpreis alle 3 Teile bei Fr\u00fchbuchung als Zahl in CHF\n- preis_regulaer: Regul\u00e4rpreis ohne Rabatt in CHF\n- fruehbucher_rabatt_prozent: Rabatt in Prozent\n- lehrmittel_inbegriffen: bool\n\nAntworte NUR mit reinem JSON: {\"kosten\": {...}}\n"}$$,
  $${"metadata": "\nDu bist ein Datenextraktions-Assistent. Analysiere diese Seite semantisch:\n\n- aufsatzkorrektur: true wenn Aufsatztraining, Aufsatzkurs oder Schreibtraining erw\u00e4hnt wird\n- einstufungstest: true wenn Einstufungstest, Standortbestimmung, Minimalnoten erw\u00e4hnt werden\n- e_learning: true wenn digitales Lehrmittel, E-Learning oder Online-Plattform (z.B. edulo) erw\u00e4hnt wird\n- pruefungsarchiv: true wenn Probepr\u00fcfungen oder Simulationspr\u00fcfungen erw\u00e4hnt werden\n- beratungsgespraech: true wenn Beratung oder Kontakt angeboten wird\n- lernunterlagen: true wenn Lehrmittel, Arbeitsheft oder Kursmaterial inbegriffen ist\n- pruefungssimulation: true wenn Simulationspr\u00fcfung explizit erw\u00e4hnt wird\n- einzelkurse: true wenn Einzelunterricht oder Privatunterricht angeboten werden\n- unterstuetzung_ausserhalb: true wenn Nachholoptionen, Aufholstunden, Hausaufgabenbetreuung, Wiederholung verpasster Lektionen oder Unterst\u00fctzung ausserhalb der Unterrichtszeiten angeboten wird\n- max_teilnehmer: maximale Gruppengr\u00f6sse als Zahl\n- standorte: Liste aller Kursorte\n\nAntworte NUR mit reinem JSON: {\"metadata\": {...}}\n", "kursdaten": "\nExtrahiere alle Kursinformationen. Kurse in 3 Teile (Teil 1, 2, 3) an Mittwoch oder Samstag.\nAusserdem Ferienkurse (Intensivkurse).\n\nF\u00fcr jeden Kursabschnitt:\n- kursabschnitt: \"Teil 1\", \"Teil 2\", \"Teil 3\", \"Herbstferienkurs 1\", etc.\n- kurstyp_intern: \"schulbegleitend\" oder \"ferienkurs\"\n- weekdays: Liste der Wochentage (z.B. [\"Mittwoch\", \"Samstag\"])\n- start_date_mi, end_date_mi (TT.MM.JJJJ, f\u00fcr Mittwochkurse)\n- start_date_sa, end_date_sa (TT.MM.JJJJ, f\u00fcr Samstagkurse)\n- dauer_wochen: Zahl\n\nAntworte NUR mit reinem JSON: {\"kurse\": [...]}\n", "kosten": "\nExtrahiere Preisinformationen:\n- preis_gesamt: Gesamtpreis alle 3 Teile bei Fr\u00fchbuchung als Zahl in CHF\n- preis_regulaer: Regul\u00e4rpreis ohne Rabatt in CHF\n- fruehbucher_rabatt_prozent: Rabatt in Prozent\n- lehrmittel_inbegriffen: bool\n\nAntworte NUR mit reinem JSON: {\"kosten\": {...}}\n"}$$,
  'manual',
  'Logos Lehrerteam: 3 Sub-Prompt(s).'
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
  AND provider_id IN (5, 6, 10)
ORDER BY provider_id, sub_keys;