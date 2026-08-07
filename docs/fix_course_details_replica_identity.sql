-- Fix für "CourseDetails" im Supabase-Projekt epiekraadwkxbtadzhnp
-- Grund: Scraper-.update()-Calls auf "CourseDetails" schlugen mit
-- "cannot update table \"CourseDetails\" because it does not have a
-- replica identity and publishes updates" fehl (Postgres-Fehler 55000).
-- Ursache: Die Tabelle hat keinen PRIMARY KEY (nur einen UNIQUE-Constraint
-- "KursDetails_ID_key"), daher konnte die Realtime-Publication UPDATEs
-- nicht replizieren.
--
-- Bereits angewendet am 2026-08-07 via Supabase-MCP.

ALTER TABLE "CourseDetails" REPLICA IDENTITY FULL;
