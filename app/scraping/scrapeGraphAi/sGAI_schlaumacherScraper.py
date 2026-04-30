"""
sGAI_schlaumacherScraper.py (refactored)
=========================================
ScrapeGraphAI-Scraper für Schlaumacher.
Einfach aufgebaut — scrapt nur eine Übersichtsseite mit Kursen + Metadaten.
"""

import json
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


SCRAPER_METHOD = "scrapegraphai"
PROVIDER_ID    = 9
PROVIDER_NAME  = "Schlaumacher"
BASE_URL       = "https://www.schlaumacher.ch"
OVERVIEW_URL   = f"{BASE_URL}/gymivorbereitung-zuerich/"


PROMPT_OVERVIEW = """
Du bist ein Datenextraktions-Assistent für eine Vergleichsplattform von Gymi-Vorbereitungskursen.

Extrahiere ALLE Kurse von dieser Seite. Für jeden Kurs gib zurück:
- title: Kursname (z.B. "Langzeitgymnasium: Vorbereitung Start September: Mittwoch")
- course_type: "langgymi" oder "kurzgymi"
- weekday: Wochentag(e) auf Deutsch (z.B. "Mittwoch", "Samstag", "Montag–Freitag")
- course_time: Kurszeit (z.B. "13:30-16:30")
- start_date: Startdatum im Format TT.MM.JJJJ
- end_date: Enddatum im Format TT.MM.JJJJ
- price_chf: Gesamtpreis als Zahl (z.B. 2940, 980)
- location: Kursort (z.B. "Schifflände 26, 8001 Zürich")
- course_url: URL des Kurses falls vorhanden
- availability: "ausgebucht" wenn ausgebucht, sonst "viele"

Extrahiere ausserdem Anbieter-Metadaten:
- aufsatzkorrektur: true wenn Aufsatzschreiben oder Aufsatztraining erwähnt wird
- einstufungstest: true wenn Einstufungstest oder Standortbestimmung erwähnt wird
- e_learning: true wenn Online-Unterricht oder E-Learning erwähnt wird
- pruefungsarchiv: true wenn Prüfungsarchiv oder alte Prüfungen erwähnt werden
- beratungsgespraech: true wenn Beratungsgespräch oder Erstgespräch angeboten wird
- lernunterlagen: true wenn Kursunterlagen oder Lernmaterial inbegriffen sind
- pruefungssimulation: true wenn Prüfungssimulation oder Simulationsprüfung erwähnt wird
- einzelkurse: true wenn Einzelkurse oder Einzelunterricht angeboten werden
- max_teilnehmer: maximale Teilnehmerzahl als Zahl (z.B. 8)
- standort: Kursort (z.B. "Schifflände 26, 8001 Zürich")

Antworte NUR mit reinem JSON: {"courses": [...], "metadata": {...}}
"""


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
            print("  JSON aus Exception extrahiert.")
            return extracted
        raise

    if isinstance(result, str):
        extracted = extract_json_from_string(result)
        if extracted:
            return extracted
        print(f"  Warnung: JSON-Parsing fehlgeschlagen. Rohtext: {result[:200]}")
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
    standort = metadata.get("standort") or "Zürich"

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
        "Pruefungsarchiv":       bool(metadata.get("pruefungsarchiv", False)),
        "Beratungsgespraech":    bool(metadata.get("beratungsgespraech", False)),
        "Eigene Lernunterlagen": bool(metadata.get("lernunterlagen", False)),
        "Standort":              standort,
    }).eq("ID", PROVIDER_ID).execute()
    print("  ✓ CourseDetails aktualisiert")


def main():
    print(f"Starte {PROVIDER_NAME} Scraper (ScrapeGraphAI + BFH LLM)...")

    if not test_bfh_connection():
        print("  Abbruch: BFH LLM nicht erreichbar.")
        return

    with ScrapeRun(SCRAPER_METHOD, PROVIDER_ID) as run:
        try:
            result = scrape_page(OVERVIEW_URL, PROMPT_OVERVIEW)
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