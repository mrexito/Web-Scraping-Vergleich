"""
sGAI_avidiiScraper.py (refactored + Self-Healing Roundtrip)
============================================================
ScrapeGraphAI-Scraper für Avidii.
Nutzt scrape_utils.py für gemeinsame Funktionen und Logging.

SELF-HEALING ROUNDTRIP (exemplarisch implementiert):
----------------------------------------------------
Dieser Scraper demonstriert den geschlossenen Self-Healing-Loop:
  1. Der Self-Healing-Loop schreibt einen verbesserten Prompt in die
     Tabelle `scraper_registry` (field_name = 'main_prompt').
  2. Beim nächsten Lauf liest dieser Scraper den AKTUELLEN Prompt aus
     der Registry — KEINE Code-Änderung nötig.
  3. Falls die Registry leer/nicht erreichbar ist, fällt der Scraper
     auf den hier definierten HARDCODED_PROMPT zurück.

Für die anderen 11 SGAI-Scraper ist dies als Future Work skizziert
(siehe Thesis Kapitel "Self-Healing Architektur").
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

# Registry-Helpers aus self-healing/ verfügbar machen
_THIS_DIR = os.path.dirname(os.path.abspath(__file__))
_HEALING_DIR = os.path.normpath(os.path.join(_THIS_DIR, "..", "self-healing"))
if _HEALING_DIR not in sys.path:
    sys.path.insert(0, _HEALING_DIR)

from registry_helpers import get_current_value  # noqa: E402


# =====================================================================
# KONFIGURATION
# =====================================================================
SCRAPER_METHOD = "scrapegraphai"
PROVIDER_ID    = 3
PROVIDER_NAME  = "Avidii"

URLS = [
    {
        "url":         "https://avidii.ch/gymivorbereitung-langzeitgymnasium",
        "course_type": "langgymi",
        "course_url":  "https://avidii.ch/gymivorbereitung-langzeitgymnasium",
    },
    {
        "url":         "https://avidii.ch/gymivorbereitung-kurzzeitgymnasium",
        "course_type": "kurzgymi",
        "course_url":  "https://avidii.ch/gymivorbereitung-kurzzeitgymnasium",
    },
]


# =====================================================================
# PROMPT — FALLBACK + REGISTRY-ROUNDTRIP
# =====================================================================
# HARDCODED_PROMPT ist die ursprüngliche Variante; sie dient als Fallback,
# falls die scraper_registry keinen Eintrag enthält oder nicht erreichbar ist.
HARDCODED_PROMPT = """
Du bist ein Datenextraktions-Assistent. Extrahiere alle Kurszeilen aus dieser Webseite.

Für jeden Kurs gib folgende Felder zurück:
- course_name: Name des Kurses (z.B. "Gruppenkurs Mittwoch", "Einzelkurs")
- weekday: Wochentag (z.B. "Mittwoch")
- course_time: Uhrzeit (z.B. "14:00-17:30")
- location: Kursort (z.B. "Zürich", "Online")
- start_date: Startdatum im Format TT.MM.JJJJ (z.B. "27.08.2025")
- end_date: Enddatum im Format TT.MM.JJJJ falls vorhanden (z.B. "15.04.2026")
- price_chf: Gruppenpreis in CHF als Zahl (z.B. 2950). Nur Gruppenpreise, keine Einzelstundenpreise.
- availability: Verfügbarkeitsstatus (z.B. "Freie Plätze", "Wenige Plätze", "Ausgebucht")
- is_online: true wenn Kurs online stattfindet, sonst false

Gib auch folgende Anbieter-Metadaten zurück:
- aufsatzkorrektur: true wenn Aufsatztraining oder Aufsatzkorrektur erwähnt wird
- einstufungstest: true wenn Standortbestimmung oder Einstufungstest erwähnt wird
- e_learning: true wenn Lerncockpit, Google Classroom oder E-Learning erwähnt wird
- pruefungsarchiv: true wenn alte Prüfungen oder Prüfungstraining erwähnt wird
- beratungsgespraech: true wenn Erstgespräch oder Beratungsgespräch erwähnt wird
- lernunterlagen: true wenn Kursmaterial oder Lernmaterial erwähnt wird
- pruefungssimulation: true wenn Prüfungssimulation oder Testprüfung erwähnt wird
- einzelkurse: true wenn Einzelunterricht oder Privatnachhilfe angeboten wird
- unterstuetzung_ausserhalb: true wenn Nachholoptionen, Aufholstunden, Hausaufgabenbetreuung, Wiederholung verpasster Lektionen oder Unterstützung ausserhalb der Unterrichtszeiten angeboten wird
- max_teilnehmer: maximale Gruppengrösse als Zahl (z.B. 8)
- standorte: kommagetrennte Liste aller Standorte (z.B. "Zürich, Online")

Antworte NUR mit einem JSON-Objekt mit den Feldern "courses" (Liste) und "metadata" (Objekt).
"""


def load_prompt() -> str:
    """Lädt den aktuellen Prompt aus scraper_registry.

    Reihenfolge:
      1. Registry-Eintrag (field_name = 'main_prompt') versuchen.
      2. Falls leer / Fehler: HARDCODED_PROMPT als Fallback.

    Damit ist der Self-Healing-Roundtrip geschlossen: Der Loop schreibt
    in die Registry, dieser Scraper liest beim nächsten Aufruf.
    """
    registry_value = get_current_value(PROVIDER_ID, SCRAPER_METHOD, "main_prompt")
    if registry_value:
        print(f"  ✓ Prompt aus scraper_registry geladen ({len(registry_value)} Zeichen)")
        return registry_value

    print("  ℹ Kein Registry-Eintrag — verwende HARDCODED_PROMPT als Fallback")
    return HARDCODED_PROMPT


# =====================================================================
# SCRAPING-HELFER
# =====================================================================
def clean_availability(raw: str):
    if not raw:
        return None
    cleaned = raw.strip().lower()
    if "ausgebucht" in cleaned:
        return "ausgebucht"
    if "wenige" in cleaned:
        return "wenige"
    if "frei" in cleaned or "plätze" in cleaned or "verfügbar" in cleaned:
        return "viele"
    return None


def scrape_courses(entry: dict, prompt: str) -> dict:
    """Scrapt die Seite mit ScrapeGraphAI + BFH LLM."""
    print(f"\n  ScrapeGraphAI scrapt: {entry['url']} ({entry['course_type']})")

    try:
        scraper = SmartScraperGraph(
            prompt=prompt,
            source=entry["url"],
            config=graph_config,
        )
        result = scraper.run()
    except Exception as e:
        # ScrapeGraphAI wirft manchmal Exception mit JSON im Error-Text
        error_str = str(e)
        print(f"  Warnung: ScrapeGraphAI Exception: {error_str[:150]}")
        extracted = extract_json_from_string(error_str)
        if extracted:
            print("  → JSON aus Exception gerettet")
            return extracted
        raise

    print(f"  → Resultat erhalten: {type(result).__name__}")

    if isinstance(result, str):
        extracted = extract_json_from_string(result)
        if extracted:
            return extracted
        try:
            return json.loads(result.strip().strip("```json").strip("```"))
        except json.JSONDecodeError:
            print("  Warnung: JSON-Parsing fehlgeschlagen")
            return {}

    return result if isinstance(result, dict) else {}


def transform_courses(result: dict, entry: dict) -> list:
    """Transformiert das LLM-Resultat ins Supabase-Schema."""
    raw_courses = result.get("courses", [])
    if not raw_courses:
        print("  Warnung: Keine Kurse im Resultat gefunden.")
        return []

    courses = []
    for course in raw_courses:
        weekday     = (course.get("weekday") or "").strip()
        course_time = (course.get("course_time") or "").strip()
        name        = (course.get("course_name") or "").strip()
        location    = (course.get("location") or "").strip()

        is_online = course.get("is_online", False)
        if isinstance(is_online, str):
            is_online = is_online.lower() in ("true", "ja", "yes")
        if "online" in location.lower():
            is_online = True

        is_einzelkurs = "einzel" in name.lower()
        price_raw = parse_price(course.get("price_chf"))
        final_price = None if is_einzelkurs else price_raw

        title_parts = [p for p in [name, weekday, course_time] if p]
        title = " | ".join(title_parts)

        courses.append({
            "provider_id":     PROVIDER_ID,
            "title":           title,
            "price_chf":       final_price,
            "location":        location or None,
            "occurrence":      weekday or None,
            "course_time":     course_time or None,
            "start_date":      convert_date(course.get("start_date")),
            "end_date":        convert_date(course.get("end_date")),
            "course_type":     entry["course_type"],
            "course_url":      entry["course_url"],
            "is_online":       is_online,
            "verfuegbarkeit":  clean_availability(course.get("availability", "")),
            "last_scraped_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "scraper_method":  SCRAPER_METHOD,
        })

    print(f"  → {len(courses)} Kurs(e) transformiert")
    return courses


def save_metadata(metadata: dict) -> None:
    """Aktualisiert GymiProviders und CourseDetails mit allen verfügbaren Metadaten."""
    if not metadata:
        print("  (Keine Metadaten zum Speichern)")
        return

    # Standorte können String oder Liste sein
    standorte_raw = metadata.get("standorte")
    if isinstance(standorte_raw, list):
        standorte = ", ".join(str(s) for s in standorte_raw if s)
    elif isinstance(standorte_raw, str):
        standorte = standorte_raw.strip()
    else:
        standorte = None

    # max_teilnehmer sauber als String für DB
    max_tn = metadata.get("max_teilnehmer")
    max_tn_str = str(max_tn) if max_tn is not None else None

    supabase.table("GymiProviders").update({
        "Aufsatzkorrektur":              bool(metadata.get("aufsatzkorrektur", False)),
        "Einstufungstest":               bool(metadata.get("einstufungstest", False)),
        "E-Learning":                    bool(metadata.get("e_learning", False)),
        "Einzelkurse":                   bool(metadata.get("einzelkurse", False)),
        "Pruefungssimultaion":           bool(metadata.get("pruefungssimulation", False)),
        "Maximale Anzahl der Teilnehmer": max_tn_str,
    }).eq("ID", PROVIDER_ID).execute()
    print("  ✓ GymiProviders Metadaten aktualisiert")

    supabase.table("CourseDetails").update({
        "Pruefungsarchiv":                          bool(metadata.get("pruefungsarchiv", False)),
        "Beratungsgespraech":                       bool(metadata.get("beratungsgespraech", False)),
        "Eigene Lernunterlagen":                    bool(metadata.get("lernunterlagen", False)),
        "Unterstuezung ausserhalb Unterrichtszeit": bool(metadata.get("unterstuetzung_ausserhalb", False)),
        "Standort":                                 standorte,
    }).eq("ID", PROVIDER_ID).execute()
    print("  ✓ CourseDetails Metadaten aktualisiert")


# =====================================================================
# MAIN
# =====================================================================
def main():
    print(f"Starte {PROVIDER_NAME} Scraper (ScrapeGraphAI + BFH LLM)...")

    if not test_bfh_connection():
        print("  Abbruch: BFH LLM nicht erreichbar. VPN aktiv? API-Key korrekt?")
        return

    # ROUNDTRIP: Prompt aus scraper_registry laden (mit Fallback)
    active_prompt = load_prompt()

    with ScrapeRun(SCRAPER_METHOD, PROVIDER_ID) as run:
        all_courses    = []
        last_metadata  = {}

        for entry in URLS:
            try:
                result  = scrape_courses(entry, active_prompt)
                if not last_metadata:
                    last_metadata = result.get("metadata", {}) or {}
                courses = transform_courses(result, entry)
                all_courses.extend(courses)
            except Exception as e:
                msg = f"Fehler beim Scraping von {entry['url']}: {e}"
                print(f"  ✗ {msg}")
                log_scrape_error(run.id, PROVIDER_ID, "SCRAPING_ERROR", msg)
                run.error_count += 1

        # Metadaten speichern
        try:
            save_metadata(last_metadata)
        except Exception as e:
            msg = f"Fehler beim Speichern der Metadaten: {e}"
            print(f"  ✗ {msg}")
            log_scrape_error(run.id, PROVIDER_ID, "METADATA_ERROR", msg)
            run.error_count += 1

        # Alte SGI-Kurse löschen und neue schreiben
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

                # Preisverlauf pro course_type
                for course_type in ("langgymi", "kurzgymi"):
                    typed = [
                        c for c in all_courses
                        if c["course_type"] == course_type and c["price_chf"]
                    ]
                    if typed:
                        avg_price = round(sum(c["price_chf"] for c in typed) / len(typed))
                        record_price_history(PROVIDER_ID, course_type, avg_price)
            except Exception as e:
                msg = f"Fehler beim Insert der Kurse: {e}"
                print(f"  ✗ {msg}")
                log_scrape_error(run.id, PROVIDER_ID, "INSERT_ERROR", msg)
                run.error_count += 1
        else:
            log_scrape_error(run.id, PROVIDER_ID, "NO_COURSES_FOUND",
                             "Keine Kurse in allen URLs gefunden.")
            run.error_count += 1

    print(f"\n✓ {PROVIDER_NAME} Scraping abgeschlossen")


if __name__ == "__main__":
    main()