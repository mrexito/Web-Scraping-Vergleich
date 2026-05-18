# Self-Healing-Loop — Demo-Anleitung

Diese Anleitung beschreibt, wie der AI-basierte Self-Healing-Loop **reproduzierbar getestet** werden kann. Sie richtet sich an Bewerter, externe Prüfer und den Autor zur Defense-Vorbereitung.

## Was demonstriert wird

Die 5-Schritt-Pipeline aus dem Topic-Dokument (Seite 4):

| Schritt | Aktion |
|---|---|
| 1 | Normal SGAI/Puppeteer run fails for one provider → `try/except` |
| 2 | System logs error → `scrape_errors` table |
| 3 | AI receives HTML + instruction → Gemini 2.5 Flash |
| 4 | AI returns new selectors/prompt → JSON |
| 5 | System updates config → next run uses new selectors |

Das Demo-Skript führt diese Pipeline für **zwei Provider** durch, um die **Generizität** des Loops über **beide Scraper-Methoden** hinweg zu zeigen:

- **Avidii (Provider 3)** — Puppeteer-Selektor-Heilung (`main_prompt`-Pattern für SGAI, `price_container` für Puppeteer)
- **Lern-Forum (Provider 2)** — ScrapeGraphAI-Prompt-Heilung (`prompts`-Pattern, JSON-Objekt mit `meta` + `courses`)

> **Anmerkung zur Puppeteer-Demo:** Der Avidii-Puppeteer-Scraper liest seine CSS-Selektoren aktuell noch direkt aus dem TypeScript-Code, nicht aus `scraper_registry`. Die Demo zeigt daher den Self-Healing-**Vorschlag** (Phasen 1-4) — die produktive Integration des neuen Selektors in den Scraper-Code ist als Future Work skizziert (siehe Thesis Kapitel "Self-Healing Architektur"). Bei ScrapeGraphAI (Lern-Forum) ist der Roundtrip vollständig geschlossen.

## Voraussetzungen

1. **Python-Pakete** installiert:
   ```powershell
   pip install google-genai python-dotenv
   ```
   Die anderen Abhängigkeiten (`supabase`, `scrapegraphai`, `requests`) sind ohnehin für die Scraper notwendig.

2. **`.env` im Projekt-Root** enthält:
   ```
   GEMINI_API_KEY=AIzaSy...   # https://aistudio.google.com/apikey (Free Tier reicht)
   NEXT_PUBLIC_SUPABASE_URL=...
   SUPABASE_SERVICE_ROLE_KEY=...
   ```

3. **Supabase-Tabellen initialisiert** (`scraper_registry` muss Einträge für Provider 2 und 3 haben):
   - `init_avidii_roundtrip.sql` — Provider 3 (`main_prompt`-Pattern)
   - `init_roundtrip_wave1.sql` — enthält u.a. Provider 2 Lern-Forum (`prompts`-Pattern)

## Demo starten

```powershell
cd scraping\self-healing
python demo_self_healing.py
```

Das Skript läuft ca. 3-7 Minuten und führt für beide Provider durch:

```
SCHRITT 1: Vorher-Zustand     (Original-Wert sichern, kaputten Wert einspielen)
SCHRITT 2: Echtes HTML laden  (requests.get auf Anbieter-URL)
SCHRITT 3: Demo-Fehler        (INSERT INTO scrape_errors mit HTML-Snapshot)
SCHRITT 4: Self-Healing-Loop  (Gemini analysiert + repariert)
SCHRITT 5: Vorher-Nachher     (Vergleich Original / kaputt / Gemini-Fix)
SCHRITT 6: Cleanup            (interaktive Frage — j/N)
```

### Optionale Aufrufe

```powershell
# Nur eine Demo (schneller)
python demo_self_healing.py --only puppeteer    # Avidii
python demo_self_healing.py --only sgi          # Lern-Forum

# DB-Zustand für Inspektion belassen (kein Cleanup-Prompt)
python demo_self_healing.py --no-cleanup
```

## Was zu beobachten ist

### Im Live-Output

- **Schritt 1:** `Original-Wert (vorher)` zeigt den intakten Selektor/Prompt; `Kaputter Wert (jetzt)` zeigt den absichtlich eingespielten _DEMO_-Wert
- **Schritt 4:** `📋 Heile: scrapegraphai.prompts für Lern-Forum` — der Loop erkennt den frischen Fehler und ruft Gemini auf
- **Schritt 5:** `last_updated_by: self_healing_loop` bestätigt, dass die Reparatur vom Loop kam, nicht von der Cleanup-Routine

### In Supabase (Beweise nach Demo)

Drei optionale SQL-Queries zur Verifikation:

```sql
-- Beweis 1: Registry wurde vom Loop aktualisiert (wenn --no-cleanup aktiv war)
SELECT field_name, last_updated_by, last_updated_at
FROM scraper_registry
WHERE provider_id IN (2, 3);

-- Beweis 2: Fehler wurden von AI gefixt
SELECT id, provider_id, error_type, fixed_by_ai, fixed_at
FROM scrape_errors
WHERE fixed_by_ai = true
ORDER BY fixed_at DESC LIMIT 4;

-- Beweis 3: Demo-Choreographie als Datenbank-Spur
SELECT id, status, courses_found, error_count, started_at, finished_at
FROM scrape_runs
WHERE provider_id IN (2, 3)
ORDER BY started_at DESC LIMIT 8;
```

Bei aktivem Cleanup (Default) wird `last_updated_by` wieder auf `'manual'` zurückgesetzt — die `fixed_by_ai`-Marker in `scrape_errors` bleiben jedoch erhalten und sind als Defense-Beweis brauchbar.

## Bekannte Limitationen (Verteidigungs-Argumente)

1. **Nicht-Determinismus:** Gemini 2.5 Flash formuliert bei jedem Aufruf einen leicht anderen Vorschlag. Das ist ein inhärenter Trade-off von LLM-basierter Selbstheilung.

2. **Bot-Detection:** Bei Providern mit aktivem Bot-Block (Avidii) liefert der HTML-Fetch teilweise 403. Der Loop bleibt funktionsfähig, weil Gemini auch ohne aktuelles HTML aus dem alten Prompt + Fehlermeldung einen sinnvollen Reparatur-Vorschlag generieren kann.

3. **Failure-Erkennung:** Der Loop reagiert auf strukturelle Fehler-Typen (`NO_COURSES_FOUND`, `PRICE_SELECTOR_FAILED`, `JSON_PARSE_ERROR`, `SCRAPING_ERROR`, etc.). Subtile Failures (z.B. korrekte Felder, aber falsches Datums-Format) werden vom Scraper nicht als Fehler geloggt und daher vom Loop nicht erkannt.

4. **Puppeteer-Roundtrip nicht geschlossen:** Wie oben erwähnt, ist der Puppeteer-Pfad bewusst als Vorschlag-Generator angelegt. Die produktive Übernahme des neuen Selektors erfordert noch eine Code-Anpassung im jeweiligen Scraper (Future Work).

## Architektur des Loops

Der `self_healing_loop.py` ist **generisch für alle 12 SGAI-Scraper** implementiert:

- `ERROR_TYPE_MAPPING` definiert pro Fehlertyp die zu heilende Methode (`scrapegraphai` / `puppeteer`)
- `resolve_field_name()` erkennt zur Laufzeit, ob ein Provider `prompts` (JSON) oder `main_prompt` (Legacy) nutzt
- Bei JSON-Pattern wird ein **Key-Mapping-Fallback** angewendet, falls Gemini neue Sub-Keys vorschlägt
- Bei leerem HTML-Snapshot wird ein **Live-Fetch** aus `GymiProviders.URL` versucht

## Dateien im Self-Healing-Modul

| Datei | Zweck |
|---|---|
| `self_healing_loop.py` | Hauptlogik der 5-Schritt-Pipeline |
| `llm_provider.py` | Gemini-Wrapper mit schema-bewahrender Prompt-Reparatur |
| `registry_helpers.py` | Read/Write-Schnittstelle zu `scraper_registry` |
| `demo_self_healing.py` | Diese Demo (One-Click-Test, zwei Provider) |
| `init_avidii_roundtrip.sql` | Initial-Eintrag für Provider 3 (Avidii, `main_prompt`) |
| `init_roundtrip_wave1.sql` | Initial-Einträge für Wave 1: Provider 2 (Lern-Forum), 9, 11, 12 |
| `init_roundtrip_wave2.sql` | Initial-Einträge für Wave 2: Provider 5, 6, 10 |
| `init_roundtrip_wave3.sql` | Initial-Einträge für Wave 3: Provider 4, 7, 8 |
| `ROUNDTRIP_DEMO_E2E.md` | Diese Anleitung |