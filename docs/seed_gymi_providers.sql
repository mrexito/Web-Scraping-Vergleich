-- Seed für "GymiProviders" im Supabase-Projekt epiekraadwkxbtadzhnp
-- Grund: scrape_runs_provider_id_fkey schlägt fehl, weil die Provider-IDs
-- 1,2,3,4,6 (siehe PROVIDER_ID in scraping/puppeteer/*.ts) noch nicht existieren.
-- Boolean-Felder sind Platzhalter (false) und werden beim nächsten Scraper-Lauf
-- automatisch per .update() mit echten Werten überschrieben.

INSERT INTO "GymiProviders" ("ID", "Name", "URL", "Aufsatzkorrektur", "E-Learning", "Einstufungstest", "Einzelkurse", "Onlinepruefung")
VALUES
  (1, 'Gymivorbereitung Zuerich', ARRAY['https://gymivorbereitung-zuerich.ch'], false, false, false, false, false),
  (2, 'Lern-Forum',               ARRAY['https://www.lern-forum.ch'],           false, false, false, false, false),
  (3, 'Avidii',                   ARRAY['https://avidii.ch'],                   false, false, false, false, false),
  (4, 'Learning Culture',         ARRAY['https://www.learningculture.ch'],      false, false, false, false, false),
  (6, 'Nachhilfe Akademie',       ARRAY['https://nachhilfeakademie.ch'],        false, false, false, false, false)
ON CONFLICT ("ID") DO NOTHING;
