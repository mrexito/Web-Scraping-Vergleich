"""
sGAI_openLearningSpaceScraper.py (refactored + Self-Healing Roundtrip)
========================================================================
ScrapeGraphAI-Scraper für Open Learning Space (OLS Zürich).
Scrapt 3 Seiten: Übersicht + Langgymi-Unterseite + Kurzgymi-Unterseite, dedupliziert.

SELF-HEALING ROUNDTRIP:
-----------------------
Liest beim Start aus scraper_registry (field_name='prompts'):
  - 'overview'  → Übersichtsseite (Kurse + Metadaten)
  - 'kursseite' → Detail-Kursseiten (Langgymi und Kurzgymi nutzen denselben Prompt)
Fallback: HARDCODED_PROMPTS.
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
    merge_metadata,
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
PROVIDER_ID    = 8
PROVIDER_NAME  = "Open Learning Space"
BASE_URL       = "https://www.ols-zuerich.ch"
ANMELDUNG_URL  = f"{BASE_URL}/anmeldeformular-gymikurse/"

URLS = [
    {"url": f"{BASE_URL}/vorbereitungskurse-aufnahmepruefung-gymnasium/", "purpose": "overview"},
    {"url": f"{BASE_URL}/vorbereitungskurs-primar/",                      "purpose": "langgymi"},
    {"url": f"{BASE_URL}/vorbereitungskurs-sek/",                         "purpose": "kurzgymi"},
]


HARDCODED_PROMPTS = {
    "overview": """
Du bist ein Datenextraktions-Assistent für eine Vergleichsplattform von Gymi-Vorbereitungskursen.

Extrahiere ALLE Kurse (Langzeit- und Kurzzeitgymnasium) von dieser Seite.
Für jeden Kurs gib zurück:
- course_type: "langgymi" oder "kurzgymi"
- weekday: Wochentag auf Deutsch
- course_time: Kurszeit (z.B. "14:00-16:45")
- start_date: TT.MM.JJJJ
- end_date: TT.MM.JJJJ
- price_chf: Preis als Zahl
- location: Kursort
- max_teilnehmer: Zahl

Extrahiere zusätzlich Anbieter-Metadaten:
- aufsatzkorrektur, einstufungstest, e_learning, pruefungsarchiv, beratungsgespraech,
  lernunterlagen, pruefungssimulation, einzelkurse, unterstuetzung_ausserhalb (alle als bool)
- unterstuetzung_ausserhalb: true wenn Nachholoptionen, Aufholstunden, Hausaufgabenbetreuung,
  Wiederholung verpasster Lektionen oder Unterstützung ausserhalb der Unterrichtszeiten
  angeboten wird
- max_teilnehmer: Zahl
- standorte: Liste aller Standorte

Antworte NUR mit reinem JSON: {"courses": [...], "metadata": {...}}
""",
    "kursseite": """
Du bist ein Datenextraktions-Assistent. Extrahiere alle Kurse von dieser Seite.

Für jeden Kurs gib zurück:
- course_type: "langgymi" oder "kurzgymi"
- weekday: Wochentag
- course_time: Kurszeit
- start_date: TT.MM.JJJJ
- end_date: TT.MM.JJJJ
- price_chf: Zahl
- location: Kursort
- max_teilnehmer: Zahl
- availability: "ausgebucht" oder "viele"

Extrahiere zusätzlich Metadaten (dieselben Felder wie in der Übersicht, inkl. unterstuetzung_ausserhalb).

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
    print(f"\n  Scrapt: {url}")
    try:
        scraper = SmartScraperGraph(prompt=prompt, source=url, config=graph_config)
        result = scraper.run()
    except Exception as e:
        error_str = str(e)
        print(f"  Warnung: Exception: {error_str[:120]}")
        extracted = extract_json_from_string(error_str)
        if extracted:
            return extracted
        raise

    if isinstance(result, str):
        extracted = extract_json_from_string(result)
        if extracted:
            return extracted
        print(f"  Warnung: JSON-Parsing fehlgeschlagen.")
        return {}

    return result if isinstance(result, dict) else {}


def transform_courses(raw_courses: list, fallback_type: str = "langgymi") -> list:
    if not raw_courses:
        return []

    transformed = []
    for c in raw_courses:
        course_type_raw = (c.get("course_type") or fallback_type).lower()
        course_type = "kurzgymi" if "kurz" in course_type_raw else "langgymi"

        weekday     = (c.get("weekday") or "").strip()
        course_time = (c.get("course_time") or "").strip()
        title_parts = ["Vorbereitungskurs", weekday, course_time]
        title = " | ".join(p for p in title_parts if p)

        transformed.append({
            "provider_id":     PROVIDER_ID,
            "title":           title,
            "price_chf":       parse_price(c.get("price_chf")),
            "location":        (c.get("location") or "Zürich Seefeld / Wiedikon").strip(),
            "occurrence":      weekday or None,
            "course_time":     course_time or None,
            "start_date":      convert_date(c.get("start_date")),
            "end_date":        convert_date(c.get("end_date")),
            "course_type":     course_type,
            "course_url":      ANMELDUNG_URL,
            "is_online":       False,
            "verfuegbarkeit":  "ausgebucht" if "ausgebucht" in str(c.get("availability", "")).lower() else "viele",
            "last_scraped_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "scraper_method":  SCRAPER_METHOD,
        })

    return transformed


def deduplicate_courses(courses: list) -> list:
    seen = set()
    unique = []
    for c in courses:
        key = (c["course_type"], c["occurrence"], c["course_time"], c["start_date"])
        if key not in seen:
            seen.add(key)
            unique.append(c)
    return unique


def save_metadata(metadata: dict) -> None:
    if not metadata:
        print("  (Keine Metadaten)")
        return

    max_t = metadata.get("max_teilnehmer")
    max_t_str = str(int(max_t)) if max_t and str(max_t).isdigit() else None
    standorte = metadata.get("standorte", [])
    if isinstance(standorte, list):
        standort_str = ", ".join(str(s) for s in standorte if s) or "Zürich Seefeld / Wiedikon"
    else:
        standort_str = str(standorte) or "Zürich Seefeld / Wiedikon"

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
    print(f"Starte {PROVIDER_NAME} Scraper (ScrapeGraphAI + BFH LLM)...")

    if not test_bfh_connection():
        print("  Abbruch: BFH LLM nicht erreichbar.")
        return

    # ROUNDTRIP: Prompts aus scraper_registry laden (mit Fallback)
    active_prompts = load_prompts()

    with ScrapeRun(SCRAPER_METHOD, PROVIDER_ID) as run:
        all_courses = []
        metadata = {}

        # Schritt 1: Übersichtsseite
        try:
            print(f"\n  Schritt 1: Übersichtsseite")
            overview_result = scrape_page(URLS[0]["url"], active_prompts["overview"])
            metadata = overview_result.get("metadata", {}) or {}
            overview_courses = transform_courses(overview_result.get("courses", []))
            all_courses.extend(overview_courses)
            print(f"  → {len(overview_courses)} Kurse von Übersicht")
            time.sleep(2)
        except Exception as e:
            msg = f"Fehler Übersichtsseite: {e}"
            log_scrape_error(run.id, PROVIDER_ID, "SCRAPING_ERROR", msg)
            run.error_count += 1

        # Schritt 2 + 3: Unter-Seiten
        for i, entry in enumerate([URLS[1], URLS[2]], start=2):
            fallback = entry["purpose"]
            try:
                print(f"\n  Schritt {i}: {fallback}-Unterseite")
                result = scrape_page(entry["url"], active_prompts["kursseite"])
                meta = result.get("metadata", {}) or {}
                if meta:
                    metadata = merge_metadata(metadata, meta)
                courses = transform_courses(result.get("courses", []), fallback_type=fallback)
                all_courses.extend(courses)
                print(f"  → {len(courses)} Kurse")
                time.sleep(2)
            except Exception as e:
                msg = f"Fehler {fallback}-Seite: {e}"
                log_scrape_error(run.id, PROVIDER_ID, "SCRAPING_ERROR", msg)
                run.error_count += 1

        # Deduplizieren
        all_courses = deduplicate_courses(all_courses)
        print(f"\n  Gesamt nach Deduplizierung: {len(all_courses)} Kurse")

        try:
            save_metadata(metadata)
        except Exception as e:
            log_scrape_error(run.id, PROVIDER_ID, "METADATA_ERROR", str(e))
            run.error_count += 1

        supabase.table("courses").delete() \
            .eq("provider_id", PROVIDER_ID) \
            .eq("scraper_method", SCRAPER_METHOD) \
            .execute()
        print("  Alte ScrapeGraphAI-Kurse gelöscht.")

        if all_courses:
            try:
                supabase.table("courses").insert(all_courses).execute()
                run.courses_found = len(all_courses)
                print(f"  ✓ {len(all_courses)} Kurs(e) gespeichert")

                for course_type in ("langgymi", "kurzgymi"):
                    typed = [c for c in all_courses
                             if c["course_type"] == course_type and c["price_chf"]]
                    if typed:
                        avg = round(sum(c["price_chf"] for c in typed) / len(typed))
                        record_price_history(PROVIDER_ID, course_type, avg)
            except Exception as e:
                log_scrape_error(run.id, PROVIDER_ID, "INSERT_ERROR", str(e))
                run.error_count += 1
        else:
            log_scrape_error(run.id, PROVIDER_ID, "NO_COURSES_FOUND", "Keine Kurse gefunden.")
            run.error_count += 1

    print(f"\n✓ {PROVIDER_NAME} abgeschlossen")


if __name__ == "__main__":
    main()