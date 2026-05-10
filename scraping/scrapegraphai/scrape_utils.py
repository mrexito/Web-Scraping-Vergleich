"""
scrape_utils.py
===============

Zentrale Helper für alle ScrapeGraphAI-Scraper.

Was hier drin ist:
------------------
1.  ENV-Loader + Supabase-Client (einmalig initialisiert)
2.  BFH LLM Verbindung testen (test_bfh_connection)
3.  LLM-Setup (llm_instance, graph_config) — wird von allen Scrapern verwendet.
    Wichtig: graph_config enthält chunk_size=4000 für ScrapeGraphAIs ParseNode,
    um Context-Window-Limits des BFH-LLMs zu respektieren (Issues #768, #853
    im Framework-Repo).
4.  Datenextraktion: parse_price, convert_date, extract_json_from_string
5.  Metadaten-Merging: merge_metadata
6.  Datenbank-Logging:
    - start_scrape_run(method, provider_id)
    - finish_scrape_run(run_id, status, courses_found, error_count)
    - log_scrape_error(run_id, provider_id, error_type, message, html_snapshot)
    - record_price_history(provider_id, course_type, price_chf)
7.  ScrapeRun — Kontext-Manager, der automatisch start/finish macht

Benutzung im Scraper:
---------------------
    from scrape_utils import (
        supabase, graph_config, test_bfh_connection,
        parse_price, convert_date, merge_metadata, extract_json_from_string,
        ScrapeRun, log_scrape_error, record_price_history,
    )

    PROVIDER_ID = 3
    SCRAPER_METHOD = "scrapegraphai"

    with ScrapeRun(SCRAPER_METHOD, PROVIDER_ID) as run:
        # scraping-logik
        run.courses_found += len(courses)
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
# scrape_utils.py liegt in scraping/scrapegraphai/. Die .env liegt im
# Projekt-Root, also 2 Ebenen höher.
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

# Konfiguration für ScrapeGraphAIs SmartScraperGraph.
#
# Wichtig — chunk_size:
#   ScrapeGraphAIs ParseNode unterteilt HTML in Chunks von chunk_size Tokens.
#   Bei zu großen Chunks erreicht das LLM seine Context-Limits (Issues #768,
#   #853 im Framework-Repo). Wir setzen chunk_size konservativ auf 4000 Tokens,
#   sodass auch bei großen Seiten jeder Chunk ins Context-Window des
#   BFH-gehosteten gpt-oss:120b passt.
#
# Wichtig — model_tokens:
#   Setzt das angenommene Context-Window des LLMs. Beeinflusst die interne
#   Chunk-Dimensionierung von ScrapeGraphAI.
graph_config = {
    "llm": {
        "model_instance": llm_instance,
        "model_tokens": 32000,
    },
    "chunk_size": 4000,
    "verbose": True,
    "headless": True,
}


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