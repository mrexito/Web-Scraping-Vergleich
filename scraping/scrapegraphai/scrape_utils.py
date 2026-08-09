"""
scrape_utils.py
===============

Zentrale Helper für alle ScrapeGraphAI-Scraper.

Was hier drin ist:
------------------
1.  ENV-Loader + Supabase-Client (einmalig initialisiert)
2.  BFH LLM Verbindung testen (test_bfh_connection)
3.  LLM-Setup:
      - graph_config (Default für 11 von 12 Anbietern)
      - get_graph_config(provider_id) — Provider-spezifische Konfiguration

    Wichtig — model_tokens (für ScrapeGraphAI v1.75.1):
      In smart_scraper_graph.py setzt ScrapeGraphAI intern die ParseNode wie
      folgt auf (siehe Source):

          parse_node = ParseNode(
              ...
              node_config={"llm_model": ..., "chunk_size": self.model_token}
          )

      Das heisst: model_tokens (im llm-Block der graph_config) wird DIREKT als
      chunk_size für die ParseNode verwendet — separater Top-Level-Parameter
      "chunk_size" wird ignoriert.

      Konsequenz: Kleinere model_tokens → mehr Chunks → mehr LLM-Calls,
      aber weniger Kontext pro Chunk (schlechtere Extraktionsqualität).
      Grössere model_tokens → wenige Chunks mit viel Kontext, aber Risiko
      "Context size has been exceeded" beim BFH-LLM.

      Empirische Werte:
        - 32000 funktioniert für 11/12 Anbieter
        - lern-forum.ch (sehr grosses HTML) braucht 4000 (sonst Context-Error)
        - Per-Provider-Override via get_graph_config() löst diesen Trade-off
4.  Datenextraktion: parse_price, convert_date, extract_json_from_string
5.  Metadaten-Merging: merge_metadata
6.  Datenbank-Logging
7.  ScrapeRun — Kontext-Manager

Benutzung im Scraper:
---------------------
    # Standard (für 11/12 Anbieter):
    from scrape_utils import graph_config, ...
    scraper = SmartScraperGraph(prompt=..., source=..., config=graph_config)

    # Für lern-forum.ch oder andere grosse Seiten:
    from scrape_utils import get_graph_config, ...
    cfg = get_graph_config(PROVIDER_ID)
    scraper = SmartScraperGraph(prompt=..., source=..., config=cfg)
"""

import os
import re
import json
from datetime import datetime, timezone
from typing import Optional

from dotenv import load_dotenv
from openai import OpenAI
from langchain_openai import ChatOpenAI
from supabase import create_client, Client


# =====================================================================
# 1. ENV + SUPABASE-CLIENT
# =====================================================================
_SCRAPE_UTILS_DIR = os.path.dirname(os.path.abspath(__file__))
_ENV_PATH = os.path.normpath(
    os.path.join(_SCRAPE_UTILS_DIR, "..", "..", ".env")
)
load_dotenv(_ENV_PATH)

SUPABASE_URL  = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_KEY  = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
BFH_API_KEY   = os.getenv("BFH_LLM_API_KEY")
BFH_BASE_URL  = "https://inference.mlmp.ti.bfh.ch/api/v1"
BFH_MODEL     = "gpt-oss:120b"

if not SUPABASE_URL or not SUPABASE_KEY:
    raise RuntimeError(
        f"NEXT_PUBLIC_SUPABASE_URL oder SUPABASE_SERVICE_ROLE_KEY "
        f"fehlen in .env (gesucht unter: {_ENV_PATH})"
    )

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)


# =====================================================================
# 2. BFH LLM SETUP
# =====================================================================
llm_instance = ChatOpenAI(
    model=BFH_MODEL,
    api_key=BFH_API_KEY,
    base_url=BFH_BASE_URL,
)

# Default model_tokens. Funktioniert für 11/12 Anbieter.
_DEFAULT_MODEL_TOKENS = 32000

# Per-Provider Overrides für Anbieter mit ungewöhnlich grossen HTML-Seiten,
# bei denen der Default-Wert das BFH-LLM-Context überschreitet.
_PROVIDER_MODEL_TOKENS_OVERRIDE = {
    2: 4000,   # lern-forum.ch — sehr grosse HTML-Seite, sonst Context-Error
}


def _build_graph_config(model_tokens: int) -> dict:
    """Erstellt eine graph_config mit dem gewünschten model_tokens-Wert."""
    return {
        "llm": {
            "model_instance": llm_instance,
            "model_tokens": model_tokens,
        },
        "verbose": True,
        "headless": True,
    }


# Default-Config für die meisten Anbieter (Backwards-Compatibility).
graph_config = _build_graph_config(_DEFAULT_MODEL_TOKENS)


def get_graph_config(provider_id: int) -> dict:
    """
    Liefert die ScrapeGraphAI-Konfiguration für einen konkreten Anbieter.

    Für Provider mit ungewöhnlich grossen HTML-Seiten (z.B. lern-forum.ch)
    wird ein niedrigerer model_tokens-Wert verwendet, damit das BFH-LLM-
    Context-Limit nicht überschritten wird.

    Beispiel:
        from scrape_utils import get_graph_config
        cfg = get_graph_config(PROVIDER_ID)
        scraper = SmartScraperGraph(prompt=..., source=..., config=cfg)
    """
    tokens = _PROVIDER_MODEL_TOKENS_OVERRIDE.get(provider_id, _DEFAULT_MODEL_TOKENS)
    if tokens != _DEFAULT_MODEL_TOKENS:
        print(f"  ℹ Provider {provider_id}: model_tokens={tokens} (Override)")
    return _build_graph_config(tokens)


def test_bfh_connection() -> bool:
    """Testet ob die BFH LLM API erreichbar ist."""
    print("  Teste BFH LLM Verbindung...")
    try:
        client = OpenAI(base_url=BFH_BASE_URL, api_key=BFH_API_KEY)
        response = client.chat.completions.create(
            model=BFH_MODEL,
            messages=[{"role": "user", "content": "Ping"}],
            max_tokens=10,
        )
        if response and response.choices:
            print("  ✓ BFH LLM Verbindung erfolgreich")
            return True
    except Exception as e:
        print(f"  ✗ BFH LLM nicht erreichbar: {e}")
    return False


# =====================================================================
# 3. DATENEXTRAKTION
# =====================================================================
def parse_price(raw) -> Optional[int]:
    """
    Wandelt Preis-Strings wie "CHF 1'450.-", "1450.-", "1,450" in int um.
    Erlaubte Eingaben: str, int, float, None.
    Nicht-numerisch → None.
    """
    if raw is None:
        return None
    if isinstance(raw, (int, float)):
        return int(raw)

    cleaned = (
        str(raw)
        .replace("'", "")
        .replace(" ", "")
        .replace(",", "")
        .replace(".-", "")
        .strip()
    )

    try:
        return int(cleaned)
    except (ValueError, TypeError):
        pass

    match = re.search(r"\d{3,5}", cleaned)
    return int(match.group()) if match else None


def convert_date(raw) -> Optional[str]:
    """
    Konvertiert Datums-Formate zu 'YYYY-MM-DD'.
    Unterstützt: '27.08.2025', '2025-08-27', '27.8.25'.
    """
    if not raw:
        return None
    raw = str(raw).strip()

    m = re.match(r"^(\d{1,2})\.(\d{1,2})\.(\d{4})$", raw)
    if m:
        return f"{m.group(3)}-{m.group(2).zfill(2)}-{m.group(1).zfill(2)}"

    m = re.match(r"^(\d{1,2})\.(\d{1,2})\.(\d{2})$", raw)
    if m:
        return f"20{m.group(3)}-{m.group(2).zfill(2)}-{m.group(1).zfill(2)}"

    m = re.match(r"^(\d{4})-(\d{2})-(\d{2})$", raw)
    if m:
        return raw

    return None


def extract_json_from_string(raw: str) -> dict:
    """Extrahiert JSON aus einem LLM-Output (auch mit Präfixen/Markdown)."""
    if not raw:
        return {}
    raw = str(raw)

    start = raw.find("{")
    end = raw.rfind("}")
    if start != -1 and end != -1 and end > start:
        try:
            return json.loads(raw[start:end + 1])
        except json.JSONDecodeError:
            pass
    return {}


# =====================================================================
# 4. METADATEN-MERGING
# =====================================================================
def merge_metadata(base: dict, extra: dict) -> dict:
    """
    Kombiniert zwei Metadaten-Dicts. Booleans → ODER, max_teilnehmer →
    Maximum, standorte (list) → Vereinigungsmenge.
    """
    result = dict(base)
    for key, val in extra.items():
        if key not in result:
            result[key] = val
            continue

        if isinstance(val, bool) and val:
            result[key] = True
            continue

        if key == "max_teilnehmer" and val is not None:
            try:
                existing = int(str(result.get(key, 0) or 0))
                new_val = int(str(val))
                result[key] = max(existing, new_val)
            except (ValueError, TypeError):
                if result.get(key) is None:
                    result[key] = val
            continue

        if key == "standorte" and isinstance(val, list):
            existing = result.get(key) or []
            if isinstance(existing, list):
                result[key] = sorted(set(existing + val))
            else:
                result[key] = val
            continue

        if result.get(key) is None:
            result[key] = val

    return result


# =====================================================================
# 5. SCRAPE_RUNS + SCRAPE_ERRORS LOGGING
# =====================================================================
VALID_METHODS = ("scrapegraphai", "puppeteer", "brightdata")
VALID_STATUSES = ("success", "partial", "failed")


def start_scrape_run(scraper_method: str, provider_id: int) -> Optional[str]:
    if scraper_method not in VALID_METHODS:
        raise ValueError(
            f"scraper_method muss einer von {VALID_METHODS} sein, "
            f"war aber '{scraper_method}'."
        )

    try:
        response = (
            supabase.table("scrape_runs")
            .insert({
                "scraper_method": scraper_method,
                "provider_id":    provider_id,
                "status":         "running",
                "courses_found":  0,
                "error_count":    0,
            })
            .execute()
        )
        run_id = response.data[0]["id"] if response.data else None
        if run_id:
            print(
                f"Scrape-Run gestartet: {scraper_method} | "
                f"Provider {provider_id} | Run-ID {run_id}"
            )
        return run_id
    except Exception as e:
        print(f"✗ Fehler beim Starten des Scrape-Runs: {e}")
        return None


def finish_scrape_run(run_id: str, status: str, courses_found: int = 0,
                      error_count: int = 0) -> None:
    if status not in VALID_STATUSES:
        raise ValueError(
            f"status muss einer von {VALID_STATUSES} sein, war aber '{status}'."
        )

    try:
        supabase.table("scrape_runs").update({
            "finished_at":   datetime.now(timezone.utc).isoformat(),
            "status":        status,
            "courses_found": courses_found,
            "error_count":   error_count,
        }).eq("id", run_id).execute()
        print(
            f"Scrape-Run {run_id} beendet: {status} | "
            f"{courses_found} Kurse | {error_count} Fehler"
        )
    except Exception as e:
        print(f"✗ Fehler beim Beenden des Scrape-Runs: {e}")


def log_scrape_error(run_id: Optional[str], provider_id: int, error_type: str,
                     message: str, html_snapshot: Optional[str] = None) -> None:
    if run_id is None:
        print(f"  (Kein run_id — Fehler nur auf Konsole) {error_type}: {message}")
        return

    try:
        supabase.table("scrape_errors").insert({
            "run_id":        run_id,
            "provider_id":   provider_id,
            "error_type":    error_type,
            "message":       message[:2000] if message else "",
            "html_snapshot": html_snapshot[:4000] if html_snapshot else None,
            "fixed_by_ai":   False,
        }).execute()
        print(f"  Fehler geloggt für Provider {provider_id}: {error_type} — {message[:100]}")
    except Exception as e:
        print(f"✗ Fehler beim Loggen des Scrape-Fehlers: {e}")


def record_price_history(provider_id: int, course_type: str,
                         price_chf: Optional[int]) -> None:
    if price_chf is None:
        return
    try:
        supabase.table("price_history").insert({
            "provider_id": provider_id,
            "price_chf":   price_chf,
            "course_type": course_type,
            "recorded_at": datetime.now(timezone.utc).isoformat(),
        }).execute()
        print(f"  ✓ price_history: Provider {provider_id} | {course_type} | CHF {price_chf}")
    except Exception as e:
        print(f"✗ Fehler beim Speichern der price_history: {e}")


def save_courses(run: "ScrapeRun", courses: list, log_label: str = "Kurse") -> bool:
    """Ersetzt die Kurse eines Providers/einer Methode nur, wenn tatsächlich
    neue Daten vorhanden sind.

    Löscht NICHT einfach immer zuerst: Ein komplett fehlgeschlagener Scrape
    (z. B. BFH-LLM-Rate-Limit) würde sonst die alten, noch gültigen Kurse
    entfernen, ohne dass etwas Neues nachkommt. Stattdessen:
      - courses vorhanden -> alte Kurse löschen, neue einfügen.
      - courses leer UND bisher keine Fehler in diesem Lauf -> echtes
        Nullergebnis (Anbieter aktuell ohne Kurse), alte/veraltete Kurse
        dürfen gelöscht werden.
      - courses leer UND bereits Fehler in diesem Lauf -> vermutlich eine
        fehlgeschlagene Extraktion, keine echte Null. Alte Kurse bleiben
        unangetastet.

    Gibt True zurück, wenn courses erfolgreich gespeichert wurden (Aufrufer
    kann dann z. B. record_price_history() ausführen).
    """
    if courses:
        try:
            supabase.table("courses").delete() \
                .eq("provider_id", run.provider_id) \
                .eq("scraper_method", run.scraper_method) \
                .execute()
            print(f"  Alte {log_label} gelöscht.")
            supabase.table("courses").insert(courses).execute()
            run.courses_found = len(courses)
            print(f"  ✓ {len(courses)} Kurs(e) gespeichert")
            return True
        except Exception as e:
            msg = f"Fehler beim Insert der Kurse: {e}"
            print(f"  ✗ {msg}")
            log_scrape_error(run.id, run.provider_id, "INSERT_ERROR", msg)
            run.error_count += 1
            return False

    if run.error_count == 0:
        supabase.table("courses").delete() \
            .eq("provider_id", run.provider_id) \
            .eq("scraper_method", run.scraper_method) \
            .execute()
        print(f"  Alte {log_label} gelöscht (Anbieter aktuell ohne Kurse).")
        log_scrape_error(run.id, run.provider_id, "NO_COURSES_FOUND", "Keine Kurse gefunden.")
        run.error_count += 1
        return False

    print(f"  Alte {log_label} NICHT gelöscht (vorherige Fehler in diesem Lauf - "
          f"vermutlich fehlgeschlagene Extraktion statt echtem Nullergebnis).")
    log_scrape_error(run.id, run.provider_id, "NO_COURSES_FOUND",
                     "Keine Kurse gefunden - alte Daten wegen vorheriger Fehler behalten.")
    run.error_count += 1
    return False


# =====================================================================
# 6. SCRAPERUN CONTEXT MANAGER
# =====================================================================
class ScrapeRun:
    """Context Manager für scrape_runs-Lifecycle."""

    def __init__(self, scraper_method: str, provider_id: int):
        self.scraper_method = scraper_method
        self.provider_id    = provider_id
        self.id: Optional[str] = None
        self.courses_found  = 0
        self.error_count    = 0

    def __enter__(self) -> "ScrapeRun":
        self.id = start_scrape_run(self.scraper_method, self.provider_id)
        if self.id is None:
            raise RuntimeError(
                "Konnte keinen Scrape-Run starten — prüfe Supabase-Verbindung."
            )
        return self

    def __exit__(self, exc_type, exc_val, exc_tb) -> bool:
        if exc_type is not None:
            self.error_count += 1
            try:
                log_scrape_error(
                    self.id,
                    self.provider_id,
                    "UNHANDLED_EXCEPTION",
                    f"{exc_type.__name__}: {exc_val}",
                )
            except Exception:
                pass
            status = "failed"
        elif self.error_count == 0:
            status = "success"
        elif self.courses_found > 0:
            status = "partial"
        else:
            status = "failed"

        if self.id:
            finish_scrape_run(self.id, status, self.courses_found, self.error_count)

        return False