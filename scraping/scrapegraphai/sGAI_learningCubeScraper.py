"""
sGAI_learningCubeScraper.py (refactored + Self-Healing Roundtrip)
==================================================================
ScrapeGraphAI-Scraper für LearningCube.
Scrapt Übersichtsseite (Metadaten) + 2 Kursseiten (Kurse).

SELF-HEALING ROUNDTRIP:
-----------------------
Liest beim Start zwei Prompts aus scraper_registry (field_name='prompts',
Keys 'overview' + 'course'). Fallback: HARDCODED_PROMPTS.
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
PROVIDER_ID    = 12
PROVIDER_NAME  = "LearningCube"
LOCATION       = "Meilen"
BASE_URL       = "https://www.learningcube.ch"
OVERVIEW_URL   = f"{BASE_URL}/gymivorbereitung/"

KNOWN_URLS = [
    {
        "url":         f"{BASE_URL}/courses/gymivorbereitung-deutsch-langgymi/",
        "course_type": "langgymi",
        "course_url":  f"{BASE_URL}/courses/gymivorbereitung-deutsch-langgymi/",
    },
    {
        "url":         f"{BASE_URL}/courses/gymivorbereitung-deutsch-kurzgymi/",
        "course_type": "kurzgymi",
        "course_url":  f"{BASE_URL}/courses/gymivorbereitung-deutsch-kurzgymi/",
    },
]


HARDCODED_PROMPTS = {
    "overview": """
Du bist ein Datenextraktions-Assistent.
Extrahiere Anbieter-Metadaten von dieser Gymivorbereitung-Übersichtsseite.
Interpretiere die Texte semantisch — es müssen nicht die exakten Begriffe vorkommen.

Gib zurück:
- aufsatzkorrektur: true wenn Aufsatztraining, Aufsatzkorrektur oder Schreibtraining erwähnt wird
- einstufungstest: true wenn Einstufungstest, Standortbestimmung oder Lernstand ermitteln erwähnt wird
- e_learning: true wenn Online-Kurs, E-Learning oder digitale Lernmittel erwähnt wird
- pruefungsarchiv: true wenn alte Prüfungen oder Prüfungsarchiv erwähnt wird
- beratungsgespraech: true wenn Beratungsgespräch oder Erstgespräch erwähnt wird
- lernunterlagen: true wenn Lernmaterial oder Lehrmittel inbegriffen
- pruefungssimulation: true wenn Simulationsprüfung oder Probeprüfung erwähnt wird
- einzelkurse: true wenn Einzelunterricht angeboten wird
- unterstuetzung_ausserhalb: true wenn Nachholoptionen, Aufholstunden, Hausaufgabenbetreuung, Wiederholung verpasster Lektionen oder Unterstützung ausserhalb der Unterrichtszeiten angeboten wird
- max_teilnehmer: maximale Gruppengrösse als Zahl (z.B. 3)
- standort: Kursort (z.B. "Meilen")

Antworte NUR mit reinem JSON: {"metadata": {...}}
""",
    "course": """
Du bist ein Datenextraktions-Assistent. Extrahiere ALLE Kursinformationen von dieser Kursseite.
Es können mehrere Kurstermine auf einer Seite sein (z.B. Mittwoch und Samstag).

Für jeden Kurs/Termin gib zurück:
- course_name: Name des Kurses
- course_type: "langgymi" oder "kurzgymi"
- weekday: Wochentag auf Deutsch
- course_time: Kurszeit (z.B. "17:30-19:30")
- start_date: Startdatum im Format TT.MM.JJJJ
- end_date: Enddatum im Format TT.MM.JJJJ
- location: Kursort (z.B. "Meilen")
- price_chf: Preis in CHF als Zahl
- max_teilnehmer: Maximale Teilnehmerzahl als Zahl
- availability: "ausgebucht" wenn ausgebucht, sonst "viele"

Gib ausserdem einmalig Anbieter-Metadaten zurück (dieselben Felder wie oben, inkl. unterstuetzung_ausserhalb).

Antworte NUR mit reinem JSON: {"courses": [{...}], "metadata": {...}}
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


def clean_availability(raw: str):
    if not raw:
        return "viele"
    s = raw.strip().lower()
    if "ausgebucht" in s or "sold out" in s or "full" in s:
        return "ausgebucht"
    if "wenige" in s or "few" in s:
        return "wenige"
    return "viele"


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


def transform_courses(result: dict, entry: dict) -> list:
    raw_courses = result.get("courses", [])
    if not raw_courses and result.get("course"):
        raw_courses = [result["course"]]

    if not raw_courses:
        print("  Warnung: Keine Kurse im Resultat.")
        return []

    transformed = []
    for c in raw_courses:
        name        = (c.get("course_name") or "Gymivorbereitung").strip()
        weekday     = (c.get("weekday") or "").strip()
        course_time = (c.get("course_time") or "").strip()
        location    = (c.get("location") or LOCATION).strip()
        ct_raw      = c.get("course_type") or entry.get("course_type", "langgymi")
        course_type = "kurzgymi" if "kurz" in str(ct_raw).lower() else "langgymi"

        title_parts = [p for p in [name, weekday, course_time] if p]
        title = " | ".join(title_parts)

        transformed.append({
            "provider_id":     PROVIDER_ID,
            "title":           title,
            "price_chf":       parse_price(c.get("price_chf")),
            "location":        location,
            "occurrence":      weekday or None,
            "course_time":     course_time or None,
            "start_date":      convert_date(c.get("start_date")),
            "end_date":        convert_date(c.get("end_date")),
            "course_type":     course_type,
            "course_url":      entry["course_url"],
            "is_online":       False,
            "verfuegbarkeit":  clean_availability(c.get("availability")),
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
    max_t_str = str(int(max_t)) if max_t and str(max_t).strip().isdigit() else None

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
        "Standort":                                 LOCATION,
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
        last_metadata = {}

        # 1. Übersichtsseite
        try:
            print(f"\n  Schritt 1: Metadaten von Hauptseite ({OVERVIEW_URL})")
            overview_result = scrape_page(OVERVIEW_URL, active_prompts["overview"])
            last_metadata = overview_result.get("metadata", {}) or {}
            print(f"  Metadaten: {json.dumps(last_metadata, ensure_ascii=False)[:200]}")
            time.sleep(2)
        except Exception as e:
            msg = f"Fehler beim Scrapen der Hauptseite: {e}"
            print(f"  ✗ {msg}")
            log_scrape_error(run.id, PROVIDER_ID, "SCRAPING_ERROR", msg)
            run.error_count += 1

        # 2. Kursseiten
        print(f"\n  Schritt 2: Kursseiten scrapen")
        all_courses = []
        for entry in KNOWN_URLS:
            try:
                result = scrape_page(entry["url"], active_prompts["course"])
                course_meta = result.get("metadata", {}) or {}
                if course_meta:
                    last_metadata = merge_metadata(last_metadata, course_meta)

                # max_teilnehmer aus Kursdaten fischen, falls nicht in metadata
                first_course = (result.get("courses") or [{}])[0]
                course_max = first_course.get("max_teilnehmer")
                if course_max is not None:
                    try:
                        last_metadata = merge_metadata(
                            last_metadata,
                            {"max_teilnehmer": int(str(course_max))},
                        )
                    except (ValueError, TypeError):
                        pass

                all_courses.extend(transform_courses(result, entry))
                time.sleep(2)
            except Exception as e:
                msg = f"Fehler bei {entry['url']}: {e}"
                print(f"  ✗ {msg}")
                log_scrape_error(run.id, PROVIDER_ID, "SCRAPING_ERROR", msg)
                run.error_count += 1

        # Metadaten schreiben
        try:
            save_metadata(last_metadata)
        except Exception as e:
            msg = f"Fehler beim Speichern der Metadaten: {e}"
            log_scrape_error(run.id, PROVIDER_ID, "METADATA_ERROR", msg)
            run.error_count += 1

        # Alte Kurse löschen und neue schreiben
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
                             if c["course_type"] == course_type and c["price_chf"] is not None]
                    if typed:
                        avg = round(sum(c["price_chf"] for c in typed) / len(typed))
                        record_price_history(PROVIDER_ID, course_type, avg)
            except Exception as e:
                msg = f"Fehler beim Insert: {e}"
                print(f"  ✗ {msg}")
                log_scrape_error(run.id, PROVIDER_ID, "INSERT_ERROR", msg)
                run.error_count += 1
        else:
            log_scrape_error(run.id, PROVIDER_ID, "NO_COURSES_FOUND",
                             "Keine Kurse in allen URLs gefunden.")
            run.error_count += 1

    print(f"\n✓ {PROVIDER_NAME} abgeschlossen")


if __name__ == "__main__":
    main()