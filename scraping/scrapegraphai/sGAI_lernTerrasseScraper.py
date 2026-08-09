"""
sGAI_lernTerrasseScraper.py (refactored + Self-Healing Roundtrip)
==================================================================
ScrapeGraphAI-Scraper für Lernterrasse.
Scrapt 4 Seiten (verschiedene Schulstufen) mit gleichem Prompt.

SELF-HEALING ROUNDTRIP:
-----------------------
Liest beim Start den Prompt aus scraper_registry (field_name='prompts',
Key 'main'). Fallback: HARDCODED_PROMPTS['main'].
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
    save_courses,
    ScrapeRun,
)

# Registry-Helpers verfügbar machen
_THIS_DIR = os.path.dirname(os.path.abspath(__file__))
_HEALING_DIR = os.path.normpath(os.path.join(_THIS_DIR, "..", "self-healing"))
if _HEALING_DIR not in sys.path:
    sys.path.insert(0, _HEALING_DIR)

from registry_helpers import get_current_value  # noqa: E402


SCRAPER_METHOD = "scrapegraphai"
PROVIDER_ID    = 11
PROVIDER_NAME  = "Lernterrasse"
LOCATION       = "Zürich Wollishofen"

URLS = [
    {"url": "https://lernterrasse.ch/6-klasse-gymi-kurs/",
     "course_type": "langgymi", "stufe": "6. Klasse"},
    {"url": "https://lernterrasse.ch/5-klasse-progymi-kurs/",
     "course_type": "langgymi", "stufe": "5. Klasse"},
    {"url": "https://lernterrasse.ch/2-oder-3-sekundarstufe-gymi-kurs/",
     "course_type": "kurzgymi", "stufe": "2./3. Sek"},
    {"url": "https://lernterrasse.ch/1-oder-2-sekundarstufe-progymi-kurs/",
     "course_type": "kurzgymi", "stufe": "1./2. Sek"},
]


HARDCODED_PROMPTS = {
    "main": """
Du bist ein Datenextraktions-Assistent. Extrahiere alle Kurszeilen aus den Tabellen.

Jede Tabelle hat Spalten: Kurs, Stufe, Kurstag, Beginn am, Preis (Fr.), Anmeldung.

Für jeden Kurs (Tabellenzeile):
- course_name: Name und Zeitraum (z.B. "Kurs A August-Februar")
- stufe: Schulstufe
- weekday: Nur Wochentag (z.B. "Mittwoch", "Samstag", "Di & Do")
- course_time: Nur Uhrzeit (z.B. "14:00-16:55")
- start_date: TT.MM.JJJJ
- end_date: TT.MM.JJJJ oder null
- price_chf: Zahl
- availability: "ausgebucht" wenn AUSGEBUCHT, sonst "viele"
- kursabschnitt: z.B. "Teil I-III"

Einmalig Anbieter-Metadaten:
- aufsatzkorrektur, einstufungstest, e_learning, pruefungsarchiv, beratungsgespraech,
  lernunterlagen, pruefungssimulation, unterstuetzung_ausserhalb (alle als bool)
- unterstuetzung_ausserhalb: true wenn Nachholoptionen, Aufholstunden, Hausaufgabenbetreuung,
  Wiederholung verpasster Lektionen oder Unterstützung ausserhalb der Unterrichtszeiten
  angeboten wird
- max_teilnehmer: Zahl

Antworte NUR mit reinem JSON: {"courses": [...], "metadata": {...}}
""",
}


def load_prompts() -> dict:
    """Lädt alle Prompts aus scraper_registry (field_name='prompts').

    Fällt auf HARDCODED_PROMPTS zurück, wenn die Registry leer oder
    ungültiges JSON enthält. Stellt sicher, dass alle erwarteten Keys
    aus HARDCODED_PROMPTS vorhanden sind (fehlende Keys werden ergänzt).
    """
    registry_value = get_current_value(PROVIDER_ID, SCRAPER_METHOD, "prompts")
    if registry_value:
        try:
            loaded = json.loads(registry_value)
            # Merge: Registry-Werte überschreiben Defaults; fehlende Keys
            # werden aus HARDCODED_PROMPTS ergänzt.
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
    if "ausgebucht" in s:
        return "ausgebucht"
    if "wenige" in s:
        return "wenige"
    return "viele"


def scrape_page(entry: dict, prompt: str) -> dict:
    print(f"\n  Scrapt: {entry['url']} ({entry['course_type']}, {entry['stufe']})")
    try:
        scraper = SmartScraperGraph(prompt=prompt, source=entry["url"], config=graph_config)
        result = scraper.run()
    except Exception as e:
        extracted = extract_json_from_string(str(e))
        if extracted:
            return extracted
        raise

    if isinstance(result, str):
        cleaned = result.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
        try:
            return json.loads(cleaned)
        except json.JSONDecodeError:
            extracted = extract_json_from_string(cleaned)
            if extracted:
                return extracted
            return {}

    return result if isinstance(result, dict) else {}


def transform_courses(result: dict, entry: dict) -> list:
    raw_courses = result.get("courses", [])
    if not raw_courses:
        return []

    courses = []
    for c in raw_courses:
        name          = (c.get("course_name") or "").strip()
        stufe         = (c.get("stufe") or entry["stufe"]).strip()
        weekday       = (c.get("weekday") or "").strip()
        course_time   = (c.get("course_time") or "").strip()
        kursabschnitt = (c.get("kursabschnitt") or "").strip()

        title_parts = [p for p in [name, stufe, kursabschnitt] if p]
        title = " | ".join(title_parts) or "Kurs"

        courses.append({
            "provider_id":     PROVIDER_ID,
            "title":           title,
            "price_chf":       parse_price(c.get("price_chf")),
            "location":        LOCATION,
            "occurrence":      weekday or None,
            "course_time":     course_time or None,
            "start_date":      convert_date(c.get("start_date")),
            "end_date":        convert_date(c.get("end_date")),
            "course_type":     entry["course_type"],
            "course_url":      entry["url"],
            "is_online":       False,
            "verfuegbarkeit":  clean_availability(c.get("availability")),
            "last_scraped_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "scraper_method":  SCRAPER_METHOD,
        })

    print(f"  → {len(courses)} Kurs(e) transformiert")
    return courses


def save_metadata(metadata: dict) -> None:
    if not metadata:
        return
    max_t = metadata.get("max_teilnehmer")

    supabase.table("GymiProviders").update({
        "E-Learning":                     bool(metadata.get("e_learning", False)),
        "Aufsatzkorrektur":               bool(metadata.get("aufsatzkorrektur", False)),
        "Einstufungstest":                bool(metadata.get("einstufungstest", False)),
        "Einzelkurse":                    False,
        "Pruefungssimultaion":            bool(metadata.get("pruefungssimulation", False)),
        "Maximale Anzahl der Teilnehmer": str(int(max_t)) if max_t else None,
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
        all_courses = []
        last_metadata = {}

        for entry in URLS:
            try:
                result = scrape_page(entry, active_prompts["main"])
                if not last_metadata and result.get("metadata"):
                    last_metadata = result["metadata"]
                all_courses.extend(transform_courses(result, entry))
                time.sleep(2)
            except Exception as e:
                log_scrape_error(run.id, PROVIDER_ID, "SCRAPING_ERROR",
                                 f"Bei {entry['url']}: {e}")
                run.error_count += 1

        # Deduplizieren
        seen = set()
        unique = []
        for c in all_courses:
            key = (c["title"], c["start_date"], c["course_type"])
            if key not in seen:
                seen.add(key)
                unique.append(c)
        print(f"\n  {len(all_courses)} Kurse → {len(unique)} nach Deduplizierung")

        try:
            save_metadata(last_metadata)
        except Exception as e:
            log_scrape_error(run.id, PROVIDER_ID, "METADATA_ERROR", str(e))
            run.error_count += 1

        if save_courses(run, unique, "ScrapeGraphAI-Kurse"):
            # Nur vollständige Kurse (>3000 CHF) in price_history
            for course_type in ("langgymi", "kurzgymi"):
                typed = [c for c in unique
                         if c["course_type"] == course_type
                         and c["price_chf"] is not None
                         and c["price_chf"] >= 3000]
                if typed:
                    avg = round(sum(c["price_chf"] for c in typed) / len(typed))
                    record_price_history(PROVIDER_ID, course_type, avg)

    print(f"\n✓ {PROVIDER_NAME} abgeschlossen")


if __name__ == "__main__":
    main()