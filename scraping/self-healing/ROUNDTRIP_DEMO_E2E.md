# Self-Healing-Loop — Demo-Anleitung

Diese Anleitung beschreibt, wie der AI-basierte Self-Healing-Loop **reproduzierbar getestet** werden kann. Sie richtet sich an Bewerter, externe Prüfer und den Autor zur Defense-Vorbereitung.

## Was demonstriert wird

Die 5-Schritt-Pipeline aus dem Topic-Dokument (Seite 4):

| Schritt | Aktion |
|---|---|
| 1 | Normal SGAI run fails for one provider → `try/except` |
| 2 | System logs error → `scrape_errors` table |
| 3 | AI receives HTML + instruction → Gemini 2.5 Flash |
| 4 | AI returns new selectors/prompt → JSON |
| 5 | System updates config → next run uses new selectors |

Das Demo-Skript führt diese Pipeline für **zwei Provider** durch, um die **Generizität** des Loops über beide unterstützten Patterns hinweg zu zeigen:

- **Lernterrasse (Provider 11)** — `prompts`-Pattern (JSON-Objekt, Welle 1-3)
- **Gymivorbereitung Zürich (Provider 1)** — `main_prompt`-Pattern (Legacy)

## Voraussetzungen

1. **Python-Pakete** installiert:
   ```powershell
   pip install google-genai python-dotenv
   ```
   Die anderen Abhängigkeiten (`supabase`, `scrapegraphai`, `requests`) sind ohnehin für die Scraper notwendig.

2. **`.env` im Projekt-Root** enthält:
   ```
   GEMINI_API_KEY=AIzaSy...   # https://aistudio.google.com/apikey (Free Tier reicht)
   SUPABASE_URL=...
   SUPABASE_KEY=...
   ```

3. **Supabase-Tabellen initialisiert** (`scraper_registry` muss Einträge für Provider 1 und 11 haben):
   - `init_gymivorbereitung_zuerich_roundtrip.sql`
   - `init_roundtrip_wave3.sql` (enthält Lernterrasse)

## Demo starten

```powershell
cd scraping\self-healing
python demo_self_healing.py
```

Das Skript läuft ca. 5-10 Minuten und führt für beide Provider durch:

```
PHASE 0: Baseline-Run         (Original-Prompt → Kurse extrahiert)
PHASE 1: Failure-Injection    (Original sichern, kaputten Prompt einspielen)
PHASE 2: Failed-Scrape        (0 Kurse → Fehler in scrape_errors)
PHASE 3: Self-Healing-Loop    (Gemini analysiert + repariert)
PHASE 4: Recovery-Scrape      (Scraper liest geheilten Prompt aus Registry)
PHASE 5: Cleanup              (Original-Prompt automatisch wiederhergestellt)
```

### Optionale Aufrufe

```powershell
# Nur eine Demo (schneller)
python demo_self_healing.py --only 11    # Lernterrasse
python demo_self_healing.py --only 1     # Gymivorbereitung Zürich

# DB-Zustand für Inspektion belassen (kein Cleanup)
python demo_self_healing.py --no-cleanup
```

## Was zu beobachten ist

### Im Live-Output

- **Phase 0:** `✓ Baseline: N Kurse, 0 Fehler, status=success` (N typisch 15-30)
- **Phase 2:** `✗ Mit kaputtem Prompt: 0 Kurse, 1 Fehler, status=failed`
- **Phase 3:** `✓ Geheilt: 1` aus dem Self-Healing-Loop
- **Phase 4:** `✓ Mit geheiltem Prompt: M Kurse, 0 Fehler, status=success` (M typisch 15-30, wegen LLM-Variabilität)

### In Supabase (Beweise nach Demo)

Drei optionale SQL-Queries zur Verifikation:

```sql
-- Beweis 1: Registry wurde vom Loop aktualisiert (wenn --no-cleanup)
SELECT field_name, last_updated_by, last_updated_at
FROM scraper_registry
WHERE provider_id IN (1, 11);

-- Beweis 2: Fehler wurden von AI gefixt
SELECT id, provider_id, error_type, fixed_by_ai, fixed_at
FROM scrape_errors
WHERE fixed_by_ai = true
ORDER BY fixed_at DESC LIMIT 4;

-- Beweis 3: Demo-Choreographie als Datenbank-Spur
SELECT id, status, courses_found, error_count, started_at, finished_at
FROM scrape_runs
WHERE provider_id IN (1, 11)
ORDER BY started_at DESC LIMIT 8;
```

Bei aktivem Cleanup (Default) wird `last_updated_by` wieder auf `'manual'` zurückgesetzt — die Run-Spuren in `scrape_runs` und die `fixed_by_ai`-Marker in `scrape_errors` bleiben jedoch erhalten und sind als Defense-Beweis brauchbar.

## Bekannte Limitationen (Verteidigungs-Argumente)

1. **Nicht-Determinismus:** Die Anzahl extrahierter Kurse im Recovery-Run variiert (15-30 Kurse), weil Gemini 2.5 Flash bei jedem Aufruf einen leicht anderen Prompt formuliert. Das ist ein inhärenter Trade-off von LLM-basierter Selbstheilung.

2. **Bot-Detection:** Bei Providern mit aktivem Bot-Block (Lernterrasse, Avidii) liefert der HTML-Fallback im Loop ein 403. Der Loop bleibt funktionsfähig, weil Gemini auch ohne aktuelles HTML aus dem alten Prompt + Fehlermeldung einen sinnvollen Reparatur-Vorschlag generieren kann.

3. **Failure-Erkennung:** Der Loop reagiert auf strukturelle Fehler-Typen (`NO_COURSES_FOUND`, `JSON_PARSE_ERROR`, `SCRAPING_ERROR`, etc.). Subtile Failures (z.B. korrekte Felder, aber falsches Datums-Format) werden vom Scraper nicht als Fehler geloggt und daher vom Loop nicht erkannt.

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
| `demo_self_healing.py` | Diese Demo (One-Click-Test) |
| `init_*.sql` | Initial-Einträge in `scraper_registry` pro Provider |
| `ROUNDTRIP_DEMO_E2E.md` | Diese Anleitung |