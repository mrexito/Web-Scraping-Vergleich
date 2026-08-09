-- Seed für "GymiProviders" im Supabase-Projekt epiekraadwkxbtadzhnp
-- Grund: scrape_runs_provider_id_fkey schlägt fehl, weil die Provider-IDs
-- 1-12 (siehe PROVIDER_ID in scraping/puppeteer/*.ts bzw.
-- scraping/scrapegraphai/sGAI_*.py) noch nicht vollständig existieren.
-- Boolean-Felder sind Platzhalter (false) und werden beim nächsten Scraper-Lauf
-- automatisch per .update() mit echten Werten überschrieben.
--
-- 2026-08-XX: Erweitert um die Provider-IDs 5, 7-12, die beim ScrapeGraphAI-Lauf
-- ebenfalls mit "scrape_runs_provider_id_fkey" fehlschlugen (waren im
-- ursprünglichen Seed nicht enthalten, da dieser nur die zu diesem Zeitpunkt
-- per Puppeteer abgedeckten Anbieter 1,2,3,4,6 berücksichtigte).

INSERT INTO "GymiProviders" ("ID", "Name", "URL", "Aufsatzkorrektur", "E-Learning", "Einstufungstest", "Einzelkurse", "Onlinepruefung")
VALUES
  (1,  'Gymivorbereitung Zuerich',  ARRAY['https://gymivorbereitung-zuerich.ch'],     false, false, false, false, false),
  (2,  'Lern-Forum',                ARRAY['https://www.lern-forum.ch'],               false, false, false, false, false),
  (3,  'Avidii',                    ARRAY['https://avidii.ch'],                       false, false, false, false, false),
  (4,  'Learning Culture',          ARRAY['https://www.learningculture.ch'],          false, false, false, false, false),
  (5,  'Gymivorbereitung Fokus',    ARRAY['https://www.gymivorbereitung-fokus.ch'],   false, false, false, false, false),
  (6,  'Nachhilfe Akademie',        ARRAY['https://nachhilfeakademie.ch'],            false, false, false, false, false),
  (7,  'Schule Zuerich Nord',       ARRAY['https://szn.ch'],                          false, false, false, false, false),
  (8,  'Open Learning Space',       ARRAY['https://www.ols-zuerich.ch'],              false, false, false, false, false),
  (9,  'Schlaumacher',              ARRAY['https://www.schlaumacher.ch'],             false, false, false, false, false),
  (10, 'Logos Lehrerteam',          ARRAY['https://www.logos-lehrerteam.ch'],         false, false, false, false, false),
  (11, 'Lernterrasse',              ARRAY['https://lernterrasse.ch'],                 false, false, false, false, false),
  (12, 'LearningCube',              ARRAY['https://www.learningcube.ch'],             false, false, false, false, false)
ON CONFLICT ("ID") DO NOTHING;
