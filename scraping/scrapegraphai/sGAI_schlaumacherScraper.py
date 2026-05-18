"""
sGAI_schlaumacherScraper.py (NATIV ScrapeGraphAI + chunk_size + Self-Healing Roundtrip)
========================================================================================
Nutzt nativ SmartScraperGraph mit der erweiterten graph_config
(chunk_size=4000) aus scrape_utils.

SELF-HEALING ROUNDTRIP:
-----------------------
Liest beim Start den Prompt aus scraper_registry (field_name='prompts',
Key 'overview'). Fallback: HARDCODED_PROMPTS['overview'].
"""

import json
import os
import sys
import time
from scrapegraphai.graphs import SmartScraperGraph

from scrape_utils import (
    supabase,
    graph_config,
    test_bfh_connection,
    parse_price,
    convert_date,
    extract_json_from_string,
    record_price_history,
    log_scrape_error,
    ScrapeRun,
)

# Registry-Helpers verfügbar machen
_THIS_DIR = os.path.dirname(os.path.abspath(__file__))
_HEALING_DIR = os.path.normpath(os.path.join(_THIS_DIR, "..", "self-healing"))
if _HEALING_DIR not in sys.path:
    sys.path.insert(0, _HEALING_DIR)

from registry_helpers import get_current_value  # noqa: E402


SCRAPER_METHOD = "scrapegraphai"
PROVIDER_ID    = 9
PROVIDER_NAME  = "Schlaumacher"
BASE_URL       = "https://www.schlaumacher.ch"
OVERVIEW_URL   = f"{BASE_URL}/gymivorbereitung-zuerich/"


HARDCODED_PROMPTS = {
    "overview": """
Du bist ein Datenextraktions-Assistent für eine Vergleichsplattform von Gymi-Vorbereitungskursen.

Extrahiere ALLE Kurse von dieser Seite. Für jeden Kurs gib zurück:
- title: Kursname (z.B. "Langzeitgymnasium: Vorbereitung Start September: Mittwoch")
- course_type: "langgymi" oder "kurzgymi"
- weekday: Wochentag(e) auf Deutsch
- course_time: Kurszeit (z.B. "13:30-16:30")
- start_date: TT.MM.JJJJ
- end_date: TT.MM.JJJJ
- price_chf: Gesamtpreis als Zahl
- location: Kursort
- course_url: URL des Kurses falls vorhanden
- availability: "ausgebucht" wenn ausgebucht, sonst "viele"

Extrahiere ausserdem Anbieter-Metadaten:
- aufsatzkorrektur, einstufungstest, e_learning, pruefungsarchiv, beratungsgespraech,
  lernunterlagen, pruefungssimulation, einzelkurse, unterstuetzung_ausserhalb (alle als bool)
- unterstuetzung_ausserhalb: true wenn Nachholoptionen, Aufholstunden, Hausaufgabenbetreuung,
  Wiederholung verpasster Lektionen oder Unterstützung ausserhalb der Unterrichtszeiten
  angeboten wird
- max_teilnehmer: Zahl
- standorte: Liste

Antworte NUR mit reinem JSON: {"courses": [...], "metadata": {...}}
""",
}


def load_prompts() -> dict:
    """Lädt alle Prompts aus scraper_registry (field_name='prompts').

    Fällt auf HARDCODED_PROMPTS zurück, wenn Registry leer/ungültig.
    Fehlende Keys werden aus HARDCODED_PROMPTS ergänzt.
    """
    registry_value = get_current_value(PROVIDER_ID, SCRAPER_METHOD, "prompts")
    if registry_value:
        try:
            loaded = json.loads(registry_value)
            merged = {**HARDCODED_PROMPTS, **loaded}
            print(f"  ✓ {len(loaded)} Prompt(s) aus scraper_registry geladen")
            return merged
        except json.JSONDecodeError:
            print("  ⚠ Registry-JSON ungültig — Fallback auf HARDCODED_PROMPTS")
            return HARDCODED_PROMPTS
    print("  ℹ Kein Registry-Eintrag — verwende HARDCODED_PROMPTS als Fallback")
    return HARDCODED_PROMPTS


def scrape_page(url: str, prompt: str) -> dict:
    """Native ScrapeGraphAI mit graph_config (inkl. chunk_size)."""
    print(f"\n  Scrapt: {url}")
    try:
        scraper = SmartScraperGraph(prompt=prompt, source=url, config=graph_config)
        result = scraper.run()
    except Exception as e:
        error_str = str(e)
        print(f"  Warnung: Exception: {error_str[:200]}")
        extracted = extract_json_from_string(error_str)
        if extracted:
            print("  JSON aus Exception extrahiert.")
            return extracted
        raise

    if isinstance(result, str):
        extracted = extract_json_from_string(result)
        if extracted:
            return extracted
        return {}

    return result if isinstance(result, dict) else {}


def transform_courses(result: dict) -> list:
    raw_courses = result.get("courses", [])
    if not raw_courses:
        print("  Warnung: Keine Kurse im Resultat.")
        return []

    transformed = []
    for c in raw_courses:
        course_type_raw = (c.get("course_type") or "").lower()
        course_type = "kurzgymi" if "kurz" in course_type_raw else "langgymi"

        transformed.append({
            "provider_id":     PROVIDER_ID,
            "title":           (c.get("title") or "Gymivorbereitung").strip(),
            "price_chf":       parse_price(c.get("price_chf")),
            "location":        (c.get("location") or "Zürich").strip(),
            "occurrence":      (c.get("weekday") or "").strip() or None,
            "course_time":     (c.get("course_time") or "").strip() or None,
            "start_date":      convert_date(c.get("start_date")),
            "end_date":        convert_date(c.get("end_date")),
            "course_type":     course_type,
            "course_url":      c.get("course_url") or OVERVIEW_URL,
            "is_online":       False,
            "verfuegbarkeit":  "ausgebucht" if "ausgebucht" in str(c.get("availability", "")).lower() else "viele",
            "last_scraped_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "scraper_method":  SCRAPER_METHOD,
        })

    print(f"  → {len(transformed)} Kurs(e) transformiert")
    return transformed


def save_metadata(metadata: dict) -> None:
    if not metadata:
        print("  (Keine Metadaten)")
        return

    max_t = metadata.get("max_teilnehmer")
    max_t_str = str(int(max_t)) if max_t and str(max_t).isdigit() else None

    standorte = metadata.get("standorte") or metadata.get("standort") or "Zürich"
    if isinstance(standorte, list):
        standort_str = ", ".join(str(s) for s in standorte if s) or "Zürich"
    else:
        standort_str = str(standorte) or "Zürich"

    supabase.table("GymiProviders").update({
        "E-Learning":                     bool(metadata.get("e_learning", False)),
        "Aufsatzkorrektur":               bool(metadata.get("aufsatzkorrektur", False)),
        "Einstufungstest":                bool(metadata.get("einstufungstest", False)),
        "Einzelkurse":                    bool(metadata.get("einzelkurse", False)),
        "Pruefungssimultaion":            bool(metadata.get("pruefungssimulation", False)),
        "Maximale Anzahl der Teilnehmer": max_t_str,
    }).eq("ID", PROVIDER_ID).execute()
    print("  ✓ GymiProviders aktualisiert")

    supabase.table("CourseDetails").update({
        "Pruefungsarchiv":                          bool(metadata.get("pruefungsarchiv", False)),
        "Beratungsgespraech":                       bool(metadata.get("beratungsgespraech", False)),
        "Eigene Lernunterlagen":                    bool(metadata.get("lernunterlagen", False)),
        "Unterstuezung ausserhalb Unterrichtszeit": bool(metadata.get("unterstuetzung_ausserhalb", False)),
        "Standort":                                 standort_str,
    }).eq("ID", PROVIDER_ID).execute()
    print("  ✓ CourseDetails aktualisiert")


def main():
    print(f"Starte {PROVIDER_NAME} Scraper (NATIV ScrapeGraphAI + chunk_size)...")

    if not test_bfh_connection():
        print("  Abbruch: BFH LLM nicht erreichbar.")
        return

    # ROUNDTRIP: Prompts aus scraper_registry laden (mit Fallback)
    active_prompts = load_prompts()

    with ScrapeRun(SCRAPER_METHOD, PROVIDER_ID) as run:
        try:
            result = scrape_page(OVERVIEW_URL, active_prompts["overview"])
        except Exception as e:
            msg = f"Fehler beim Scraping: {e}"
            print(f"  ✗ {msg}")
            log_scrape_error(run.id, PROVIDER_ID, "SCRAPING_ERROR", msg)
            run.error_count += 1
            return

        metadata = result.get("metadata", {}) or {}
        print(f"  Metadaten: {json.dumps(metadata, ensure_ascii=False)[:200]}")

        courses = transform_courses(result)

        try:
            save_metadata(metadata)
        except Exception as e:
            msg = f"Fehler beim Speichern der Metadaten: {e}"
            print(f"  ✗ {msg}")
            log_scrape_error(run.id, PROVIDER_ID, "METADATA_ERROR", msg)
            run.error_count += 1

        supabase.table("courses").delete() \
            .eq("provider_id", PROVIDER_ID) \
            .eq("scraper_method", SCRAPER_METHOD) \
            .execute()
        print("  Alte ScrapeGraphAI-Kurse gelöscht.")

        if courses:
            try:
                supabase.table("courses").insert(courses).execute()
                run.courses_found = len(courses)
                print(f"  ✓ {len(courses)} Kurs(e) gespeichert")

                for course_type in ("langgymi", "kurzgymi"):
                    typed = [c for c in courses
                             if c["course_type"] == course_type and c["price_chf"]]
                    if typed:
                        avg = round(sum(c["price_chf"] for c in typed) / len(typed))
                        record_price_history(PROVIDER_ID, course_type, avg)
                        print(f"  ✓ price_history {course_type}: avg CHF {avg}")
            except Exception as e:
                msg = f"Fehler beim Insert: {e}"
                print(f"  ✗ {msg}")
                log_scrape_error(run.id, PROVIDER_ID, "INSERT_ERROR", msg)
                run.error_count += 1
        else:
            log_scrape_error(run.id, PROVIDER_ID, "NO_COURSES_FOUND", "Keine Kurse gefunden.")
            run.error_count += 1

    print(f"\n✓ {PROVIDER_NAME} abgeschlossen")


if __name__ == "__main__":
    main()