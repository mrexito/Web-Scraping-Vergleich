# Self-Healing-Loop

Bachelor-Thesis Anforderung 10: AI-basiertes Selbstheilungs-System für Scraper.

## Übersicht

Wenn ein Puppeteer- oder ScrapeGraphAI-Scraper fehlschlägt (z.B. weil sich
die Webseite geändert hat), wird der Fehler in `scrape_errors` geloggt — inklusive
HTML-Snapshot der Seite zum Zeitpunkt des Fehlers.

Der Self-Healing-Loop liest diese Fehler ab, schickt HTML-Snapshot + alten
Selector / Prompt an Gemini 2.5 Flash, bekommt einen verbesserten Vorschlag,
und schreibt diesen in die `scraper_registry`-Tabelle.

Beim **nächsten Scraper-Lauf** lesen Puppeteer-Scraper und SGI-Scraper die
aktuellen Selectors / Prompts aus dieser Tabelle → der Fix ist automatisch
aktiv, ohne Code-Änderung.

## Dateien

```
self_healing/
├── llm_provider.py        # Gemini-Wrapper (austauschbar)
├── registry_helpers.py    # DB-Funktionen für scraper_registry
├── self_healing_loop.py   # Hauptskript: Detect → Analyze → Suggest → Apply → Mark
└── README.md              # diese Datei
```

## Wo platzieren

Im Projekt: `app/scraping/self_healing/`

## Voraussetzungen

1. **Tabelle `scraper_registry`** existiert in Supabase (siehe `migrations/001_scraper_registry.sql`)
2. **Tabelle `scrape_errors`** existiert mit Spalten `html_snapshot`, `fixed_by_ai`, `ai_suggested_selector`, `fixed_at`
3. **Gemini API-Key** in `.env` als `GEMINI_API_KEY=...`
4. **Python-Packages:** `google-genai`, `python-dotenv`, `supabase` (sollten in der scrapegraphai-venv sein)

## Verwendung

### Manuell triggern (für Demo / Verteidigung)

```powershell
# venv aktivieren
.\app\scraping\scrapegraphai\venv\Scripts\Activate.ps1

# In den self_healing-Ordner wechseln
cd .\app\scraping\self_healing\

# Loop ausführen
python self_healing_loop.py
```

Output zeigt jeden Fehler einzeln durchgegangen mit den 5 Schritten:
- DETECT (welche Fehler offen sind)
- ANALYZE (was wird geheilt)
- SUGGEST (Geminis Vorschlag)
- APPLY (Update in scraper_registry)
- MARK (scrape_errors.fixed_by_ai = true)

### Mit Optionen

```powershell
# Nur die letzten 5 Fehler bearbeiten
python self_healing_loop.py --limit 5

# Trockenlauf — nichts wird in DB geschrieben
python self_healing_loop.py --dry-run

# Beides kombinieren
python self_healing_loop.py --limit 3 --dry-run
```

### Automatisch nightly (z.B. via GitHub Actions)

In `.github/workflows/self_healing_nightly.yml`:

```yaml
name: Self-Healing Nightly

on:
  schedule:
    - cron: '0 2 * * *'   # jeden Tag um 02:00 UTC

jobs:
  self_healing:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: '3.12'
      - run: pip install google-genai python-dotenv supabase
      - run: python app/scraping/self_healing/self_healing_loop.py
        env:
          GEMINI_API_KEY: ${{ secrets.GEMINI_API_KEY }}
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_KEY: ${{ secrets.SUPABASE_KEY }}
```

## Wie der Loop arbeitet — die 5 Schritte (gemäß Anforderung 10)

```
┌─ 1. DETECT ─────────────────────────────────────────────┐
│ SELECT * FROM scrape_errors                             │
│ WHERE fixed_by_ai IS NULL OR fixed_by_ai = false        │
│ ORDER BY created_at DESC                                │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─ 2. ANALYZE ────────────────────────────────────────────┐
│ Für jeden Fehler:                                       │
│   • lade alten Selector aus scraper_registry            │
│   • bereite HTML-Snapshot vor (max 50KB für Tokens)     │
│   • erstelle strukturierten Prompt für Gemini           │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─ 3. SUGGEST ────────────────────────────────────────────┐
│ Gemini 2.5 Flash analysiert HTML + Fehler-Kontext       │
│ → schlägt neuen Selector / Prompt vor                   │
│ → automatisches Retry bei 503/429                       │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─ 4. APPLY ──────────────────────────────────────────────┐
│ UPDATE scraper_registry                                 │
│ SET current_value = <neuer Wert>,                       │
│     last_updated_by = 'self_healing_loop',              │
│     last_updated_at = NOW()                             │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─ 5. MARK ───────────────────────────────────────────────┐
│ UPDATE scrape_errors                                    │
│ SET fixed_by_ai = true,                                 │
│     fixed_at = NOW(),                                   │
│     ai_suggested_selector = <neuer Wert>                │
└─────────────────────────────────────────────────────────┘
```

## Was nicht heilbar ist

**Bright Data-Scraper** sind bewusst aus dem Self-Healing ausgenommen, weil
deren Scraping-Logik im externen Bright-Data-Dashboard liegt und nicht durch
unser Skript beeinflussbar ist. Diese Limitation ist in der Thesis-Sektion 6
dokumentiert als bewusste Architekturentscheidung.

## Demo-Szenario für Kolloquium

1. **Vor der Demo:** Manuell einen Test-Fehler in `scrape_errors` einfügen
   (mit echtem HTML-Snippet, kaputtem Selector)
2. **Loop starten:** `python self_healing_loop.py`
3. **Live zeigen:** wie Gemini den neuen Selector vorschlägt
4. **DB öffnen:** `scraper_registry` zeigt den aktualisierten Wert mit
   `last_updated_by = 'self_healing_loop'`
5. **Beweisführung:** ein erneuter Scraper-Lauf nutzt automatisch den neuen Wert

## Modell und Kosten

- **Modell:** Gemini 2.5 Flash
- **Free Tier:** 15 Requests/Minute, 1500/Tag
- **Token-Verbrauch pro Heilung:** ~10-15k Input-Tokens, ~50 Output-Tokens
- **Tagesbedarf in Realität:** wenige Heilungen → bleibt sehr deutlich unter
  Free-Tier-Limits

## Anpassung für BFH LLM

Falls Gemini-Quota nicht verfügbar ist, kann `LLMProvider` einfach gegen
einen BFH-LLM-Wrapper ausgetauscht werden. Die Klasse hat genau zwei
public Methoden (`suggest_selector`, `suggest_prompt`) — Implementierungs-
details (welches LLM) sind dahinter gekapselt.