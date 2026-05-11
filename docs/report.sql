-- Diese Datei enthält alle Auswertungs-Queries, die als Datenbasis für die
-- schriftliche Analyse in der Thesis verwendet werden. Jede Query ist
-- selbstständig ausführbar (im Supabase SQL-Editor).



-- QUERY 1: COVERAGE-MATRIX (Vollständigkeit)
-------------------------------------------------------------------
-- Liefert pro Anbieter die Anzahl extrahierter Kurse je Methode.
-- Zentrale Tabelle für die Vollständigkeits-Sektion.

SELECT
    gp."ID"                                                                 AS provider_id,
    gp."Name"                                                               AS provider,
    COUNT(DISTINCT c.id) FILTER (WHERE c.scraper_method = 'puppeteer')      AS puppeteer,
    COUNT(DISTINCT c.id) FILTER (WHERE c.scraper_method = 'brightdata')     AS brightdata,
    COUNT(DISTINCT c.id) FILTER (WHERE c.scraper_method = 'scrapegraphai')  AS scrapegraphai,
    COUNT(DISTINCT c.id)                                                    AS total
FROM "GymiProviders" gp
LEFT JOIN courses c ON c.provider_id = gp."ID"
GROUP BY gp."ID", gp."Name"
ORDER BY gp."ID";


-- QUERY 2: AGGREGATE PRO METHODE (Pflicht — alle Sektionen, Übersicht)
-- =============================================================================
-- Zentrale Performance- und Zuverlässigkeitsmetriken pro Methode.
-- Nutzbar für Sektion 3 (Zuverlässigkeit) und 5 (Performance).

SELECT
    scraper_method,
    COUNT(*)                                                              AS runs_total,
    COUNT(*) FILTER (WHERE status = 'success')                            AS runs_success,
    COUNT(*) FILTER (WHERE status = 'partial')                            AS runs_partial,
    COUNT(*) FILTER (WHERE status = 'failed')                             AS runs_failed,
    ROUND(
      COUNT(*) FILTER (WHERE status = 'success')::numeric / COUNT(*) * 100
    , 1)                                                                  AS success_rate_pct,
    SUM(courses_found)                                                    AS courses_total,
    SUM(error_count)                                                      AS errors_total,
    ROUND(AVG(EXTRACT(EPOCH FROM (finished_at - started_at))))::int       AS avg_duration_s,
    ROUND(
      PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (finished_at - started_at)))
    )::int                                                                AS median_duration_s
FROM scrape_runs
WHERE finished_at IS NOT NULL
GROUP BY scraper_method
ORDER BY scraper_method;


-- =============================================================================
-- QUERY 3: PERFORMANCE-DETAIL (Sektion 5 — Performance)
-- =============================================================================
-- Detail-Performance-Metriken: Min, Max, Quartile, Standardabweichung.
-- Zeigt die Streuung der Laufzeiten pro Methode.

SELECT
    scraper_method,
    COUNT(*)                                                              AS runs,
    ROUND(MIN(EXTRACT(EPOCH FROM (finished_at - started_at))))::int       AS min_s,
    ROUND(
      PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (finished_at - started_at)))
    )::int                                                                AS q1_s,
    ROUND(
      PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (finished_at - started_at)))
    )::int                                                                AS median_s,
    ROUND(AVG(EXTRACT(EPOCH FROM (finished_at - started_at))))::int       AS avg_s,
    ROUND(
      PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (finished_at - started_at)))
    )::int                                                                AS q3_s,
    ROUND(
      PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (finished_at - started_at)))
    )::int                                                                AS p95_s,
    ROUND(MAX(EXTRACT(EPOCH FROM (finished_at - started_at))))::int       AS max_s,
    ROUND(STDDEV(EXTRACT(EPOCH FROM (finished_at - started_at))))::int    AS stddev_s
FROM scrape_runs
WHERE finished_at IS NOT NULL
GROUP BY scraper_method
ORDER BY scraper_method;


-- =============================================================================
-- QUERY 4: FEHLERVERTEILUNG PRO METHODE (Sektion 3 — Zuverlässigkeit)
-- =============================================================================
-- Welche Fehlertypen treten pro Methode wie häufig auf?

SELECT
    sr.scraper_method,
    se.error_type,
    COUNT(*)                                                  AS occurrences,
    COUNT(DISTINCT se.provider_id)                            AS providers_affected,
    COUNT(*) FILTER (WHERE se.fixed_by_ai = true)             AS fixed_by_ai
FROM scrape_errors se
JOIN scrape_runs sr ON sr.id = se.run_id
GROUP BY sr.scraper_method, se.error_type
ORDER BY sr.scraper_method, occurrences DESC;


-- =============================================================================
-- QUERY 5: DREI-WEGE-VERGLEICH AVIDII (Provider 3) — Vollständigkeit + Genauigkeit
-- =============================================================================
-- Detail-Vergleich für Avidii. Avidii ist einer der zwei Anbieter, für die
-- alle drei Scraper-Methoden implementiert sind.

SELECT
    scraper_method,
    COUNT(*)                                                          AS courses_found,
    COUNT(*) FILTER (WHERE price_chf IS NOT NULL)                     AS price_filled,
    COUNT(*) FILTER (WHERE start_date IS NOT NULL)                    AS start_date_filled,
    COUNT(*) FILTER (WHERE end_date IS NOT NULL)                      AS end_date_filled,
    COUNT(*) FILTER (WHERE location IS NOT NULL AND location <> '')   AS location_filled,
    COUNT(*) FILTER (WHERE verfuegbarkeit IS NOT NULL)                AS availability_filled,
    ROUND(AVG(price_chf))::int                                        AS avg_price_chf,
    MIN(price_chf)                                                    AS min_price_chf,
    MAX(price_chf)                                                    AS max_price_chf,
    COUNT(DISTINCT location)                                          AS unique_locations
FROM courses
WHERE provider_id = 3
GROUP BY scraper_method
ORDER BY scraper_method;


-- =============================================================================
-- QUERY 6: DREI-WEGE-VERGLEICH GYMIVORBEREITUNG ZÜRICH (Provider 1)
-- =============================================================================
-- Detail-Vergleich für Gymivorbereitung Zürich.
-- Zweiter Anbieter mit allen drei Methoden.

SELECT
    scraper_method,
    COUNT(*)                                                          AS courses_found,
    COUNT(*) FILTER (WHERE price_chf IS NOT NULL)                     AS price_filled,
    COUNT(*) FILTER (WHERE price_regular_chf IS NOT NULL)             AS price_regular_filled,
    COUNT(*) FILTER (WHERE discount_valid_until IS NOT NULL)          AS discount_filled,
    COUNT(*) FILTER (WHERE start_date IS NOT NULL)                    AS start_date_filled,
    COUNT(*) FILTER (WHERE end_date IS NOT NULL)                      AS end_date_filled,
    COUNT(*) FILTER (WHERE location IS NOT NULL AND location <> '')   AS location_filled,
    COUNT(*) FILTER (WHERE is_online = true)                          AS online_courses,
    ROUND(AVG(price_chf))::int                                        AS avg_price_chf,
    COUNT(DISTINCT location)                                          AS unique_locations,
    COUNT(DISTINCT course_type)                                       AS course_types
FROM courses
WHERE provider_id = 1
GROUP BY scraper_method
ORDER BY scraper_method;


-- =============================================================================
-- QUERY 7: DATENQUALITÄT GLOBAL (Sektion 1 — Vollständigkeit pro Methode)
-- =============================================================================
-- Über alle Anbieter hinweg: wie viele Felder werden pro Methode befüllt?

SELECT
    scraper_method,
    COUNT(*)                                                                 AS total_courses,
    ROUND(COUNT(*) FILTER (WHERE price_chf IS NOT NULL) * 100.0 / COUNT(*), 1)        AS price_pct,
    ROUND(COUNT(*) FILTER (WHERE start_date IS NOT NULL) * 100.0 / COUNT(*), 1)       AS start_date_pct,
    ROUND(COUNT(*) FILTER (WHERE end_date IS NOT NULL) * 100.0 / COUNT(*), 1)         AS end_date_pct,
    ROUND(COUNT(*) FILTER (WHERE location IS NOT NULL AND location <> '') * 100.0 / COUNT(*), 1) AS location_pct,
    ROUND(COUNT(*) FILTER (WHERE occurrence IS NOT NULL) * 100.0 / COUNT(*), 1)       AS weekday_pct,
    ROUND(COUNT(*) FILTER (WHERE verfuegbarkeit IS NOT NULL) * 100.0 / COUNT(*), 1)   AS availability_pct,
    ROUND(COUNT(*) FILTER (WHERE course_url IS NOT NULL) * 100.0 / COUNT(*), 1)       AS url_pct
FROM courses
GROUP BY scraper_method
ORDER BY scraper_method;


-- =============================================================================
-- QUERY 8: LETZTE LÄUFE (chronologisch — für Reproduzierbarkeit)
-- =============================================================================
-- Nachweis der Datenherkunft. Die letzten 30 Scraper-Läufe.

SELECT
    sr.scraper_method,
    gp."Name"                                                            AS provider,
    sr.status,
    sr.courses_found,
    sr.error_count,
    EXTRACT(EPOCH FROM (sr.finished_at - sr.started_at))::int            AS duration_s,
    sr.started_at::timestamp(0)                                          AS started_at
FROM scrape_runs sr
LEFT JOIN "GymiProviders" gp ON gp."ID" = sr.provider_id
WHERE sr.finished_at IS NOT NULL
ORDER BY sr.started_at DESC
LIMIT 30;


-- =============================================================================
-- QUERY 9: NICHT-GEFIXTE FEHLER (Sektion 6 / Self-Healing-Vorbereitung)
-- =============================================================================
-- Aktuell offene Fehler, die der Self-Healing-Loop bearbeiten könnte.

SELECT
    gp."Name"                                                AS provider,
    sr.scraper_method,
    se.error_type,
    se.message,
    se.created_at::timestamp(0)                              AS occurred_at,
    se.fixed_by_ai
FROM scrape_errors se
LEFT JOIN scrape_runs sr ON sr.id = se.run_id
LEFT JOIN "GymiProviders" gp ON gp."ID" = se.provider_id
WHERE se.fixed_by_ai IS NOT TRUE
ORDER BY se.created_at DESC
LIMIT 20;


-- =============================================================================
-- QUERY 10: PERFORMANCE PRO ANBIETER × METHODE (Detail für Performance-Sektion)
-- =============================================================================
-- Welche Methode ist für welchen Anbieter am schnellsten?

SELECT
    gp."Name"                                                            AS provider,
    sr.scraper_method,
    COUNT(*)                                                             AS runs,
    ROUND(AVG(EXTRACT(EPOCH FROM (sr.finished_at - sr.started_at))))::int AS avg_s,
    ROUND(AVG(sr.courses_found))::int                                    AS avg_courses
FROM scrape_runs sr
JOIN "GymiProviders" gp ON gp."ID" = sr.provider_id
WHERE sr.finished_at IS NOT NULL
GROUP BY gp."ID", gp."Name", sr.scraper_method
ORDER BY gp."ID", sr.scraper_method;


-- =============================================================================
-- QUERY 11: KOSTEN-INDIKATOR (Sektion 4 — Aufwand & Kosten)
-- =============================================================================
-- Anzahl Läufe pro Methode (für ScrapeGraphAI = LLM-Aufrufe = Tokens).
-- Hilft bei der Kostenkalkulation.

SELECT
    scraper_method,
    COUNT(*)                                                  AS total_runs_in_db,
    SUM(courses_found)                                        AS total_courses_extracted,
    ROUND(AVG(courses_found))::int                            AS avg_courses_per_run,
    ROUND(SUM(courses_found)::numeric / NULLIF(COUNT(*), 0), 1) AS courses_per_run
FROM scrape_runs
WHERE status = 'success'
GROUP BY scraper_method
ORDER BY scraper_method;


-- =============================================================================
-- QUERY 12: PREIS-KONSISTENZ ZWISCHEN METHODEN (Genauigkeit-Indikator)
-- =============================================================================
-- Wo finden alle drei Methoden den gleichen Preis? Wo unterscheiden sie sich?
-- Wichtig für Sektion 2 (Genauigkeit).

WITH provider_prices AS (
    SELECT
        provider_id,
        scraper_method,
        course_type,
        ROUND(AVG(price_chf))::int AS avg_price
    FROM courses
    WHERE price_chf IS NOT NULL
    GROUP BY provider_id, scraper_method, course_type
)
SELECT
    gp."Name"                                                  AS provider,
    pp.course_type,
    MAX(CASE WHEN scraper_method = 'puppeteer'      THEN avg_price END) AS price_puppeteer,
    MAX(CASE WHEN scraper_method = 'brightdata'     THEN avg_price END) AS price_brightdata,
    MAX(CASE WHEN scraper_method = 'scrapegraphai'  THEN avg_price END) AS price_scrapegraphai
FROM provider_prices pp
JOIN "GymiProviders" gp ON gp."ID" = pp.provider_id
WHERE pp.provider_id IN (1, 3)  -- nur Anbieter mit allen drei Methoden
GROUP BY gp."ID", gp."Name", pp.course_type
ORDER BY gp."ID", pp.course_type;


-- =============================================================================
-- ENDE — report.sql
-- =============================================================================
-- Hinweise zur Verwendung:
--   • Jede Query kann einzeln in den Supabase SQL-Editor kopiert und
--     ausgeführt werden.
--   • Die Ergebnisse können als CSV exportiert oder direkt als Tabelle
--     in das Thesis-Dokument übernommen werden.
--   • Bei Live-Verwendung im Web-Report werden Query 1 und 2 inhaltlich
--     repliziert (siehe app/_lib/loadReportData.ts).
-- =============================================================================