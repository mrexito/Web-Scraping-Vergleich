"""
sGAI_nachhilfeAkademieScraper.py (NATIV ScrapeGraphAI)
==============================================
ScrapeGraphAI-Scraper für Nachhilfe Akademie.
Scrapt 3 Seiten: Übersicht (Kurse + Metadaten) + 2 Preisseiten
(Langgymi, Kurzgymi). Nutzt nativ SmartScraperGraph mit graph_config
chunk_size=4000 aus scrape_utils.
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


SCRAPER_METHOD     = "scrapegraphai"
PROVIDER_ID        = 6
PROVIDER_NAME      = "Nachhilfe Akademie"
BASE_URL           = "https://nachhilfeakademie.ch"
OVERVIEW_URL       = f"{BASE_URL}/gymivorbereitung-kanton-zuerich/"
PREISE_LANG_URL    = f"{BASE_URL}/preise-gymivorbereitung-langgymnasium/"
PREISE_KURZ_URL    = f"{BASE_URL}/preise-gymivorbereitung-kurzgymnasium/"




PROMPT_OVERVIEW = """
Du bist ein Datenextraktions-Assistent für eine Vergleichsplattform von Gymi-Vorbereitungskursen.

Extrahiere ALLE Kurse (Langzeit- und Kurzzeitgymnasium, schulbegleitend und Ferienkurse)
aus der Übersichtstabelle auf dieser Seite.
Für jeden Kurs gib zurück:
- course_type: "langgymi" oder "kurzgymi"
- title: Kurzname (z.B. "Gymivorbereitung Mittwoch", "Intensivkurs Herbstferien 1")
- weekday: Wochentag auf Deutsch
- course_time: Kurszeit (z.B. "14:00-17:15")
- start_date: TT.MM.JJJJ
- end_date: TT.MM.JJJJ (leer wenn nicht vorhanden)
- location: Kursort
- kursart: "schulbegleitend" oder "ferienkurs"
- availability: "viele"

Extrahiere zusätzlich Anbieter-Metadaten:
- aufsatzkorrektur, einstufungstest, e_learning, pruefungsarchiv, beratungsgespraech,
  lernunterlagen, pruefungssimulation, einzelkurse, unterstuetzung_ausserhalb (alle als bool)
- unterstuetzung_ausserhalb: true wenn Nachholoptionen, Aufholstunden, Hausaufgabenbetreuung,
  Wiederholung verpasster Lektionen oder Unterstützung ausserhalb der Unterrichtszeiten
  angeboten wird
- max_teilnehmer: Zahl
- standorte: Liste aller Standorte

Antworte NUR mit reinem JSON: {"courses": [...], "metadata": {...}}
"""

PROMPT_PREISE_LANG = """
Extrahiere die Preise für Gymivorbereitungskurse Langgymnasium.

Gib zurück:
- preis_4er_gruppe_gesamt: Gesamtpreis für 4er-Gruppe als Zahl in CHF
- preis_2er_gruppe_gesamt: Gesamtpreis für 2er-Gruppe als Zahl in CHF
- preis_privat_gesamt: Gesamtpreis für Einzelunterricht als Zahl in CHF
- preis_ferienkurs_gruppe: Preis Ferienkurs Gruppe als Zahl in CHF
- preis_ferienkurs_privat: Preis Ferienkurs Privat als Zahl in CHF
- anmeldegebuehr: Anmeldegebühr als Zahl in CHF

Antworte NUR mit reinem JSON: {"preise": {...}}
"""

PROMPT_PREISE_KURZ = PROMPT_PREISE_LANG.replace("Langgymnasium", "Kurzgymnasium")


def scrape_page(url: str, prompt: str) -> dict:
    print(f"\n  Scrapt: {url}")
    try:
        scraper = SmartScraperGraph(prompt=prompt, source=url, config=graph_config)
        result = scraper.run()
    except Exception as e:
        error_str = str(e)
        print(f"  Warnung: {error_str[:120]}")
        extracted = extract_json_from_string(error_str)
        if extracted:
            return extracted
        raise

    if isinstance(result, str):
        extracted = extract_json_from_string(result)
        return extracted if extracted else {}
    return result if isinstance(result, dict) else {}


def transform_courses(raw_courses: list, preise_lang: dict, preise_kurz: dict) -> list:
    if not raw_courses:
        return []

    transformed = []
    for c in raw_courses:
        ct_raw = (c.get("course_type") or "langgymi").lower()
        course_type = "kurzgymi" if "kurz" in ct_raw else "langgymi"
        kursart = (c.get("kursart") or "schulbegleitend").lower()
        is_ferienkurs = "ferienkurs" in kursart or "intensiv" in kursart

        p = preise_kurz if course_type == "kurzgymi" else preise_lang
        anmeldung_url = OVERVIEW_URL

        price = parse_price(
            p.get("preis_ferienkurs_gruppe") if is_ferienkurs
            else p.get("preis_4er_gruppe_gesamt")
        )

        weekday     = (c.get("weekday") or "").strip()
        course_time = (c.get("course_time") or "").strip()
        title       = (c.get("title") or f"Gymivorbereitung | {weekday}").strip()
        location    = (c.get("location") or "Zürich Oerlikon").strip()

        transformed.append({
            "provider_id":     PROVIDER_ID,
            "title":           title,
            "price_chf":       price,
            "location":        location,
            "occurrence":      weekday or None,
            "course_time":     course_time or None,
            "start_date":      convert_date(c.get("start_date")),
            "end_date":        convert_date(c.get("end_date")),
            "course_type":     course_type,
            "course_url":      OVERVIEW_URL,
            "is_online":       False,
            "verfuegbarkeit":  "viele",
            "last_scraped_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "scraper_method":  SCRAPER_METHOD,
        })
    return transformed


def save_metadata(metadata: dict) -> None:
    if not metadata:
        return
    max_t = metadata.get("max_teilnehmer")
    max_t_str = str(int(max_t)) if max_t and str(max_t).isdigit() else None
    standorte = metadata.get("standorte", [])
    if isinstance(standorte, list):
        standort_str = ", ".join(str(s) for s in standorte if s) or "Zürich Oerlikon, Winterthur"
    else:
        standort_str = str(standorte) or "Zürich Oerlikon, Winterthur"

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

    with ScrapeRun(SCRAPER_METHOD, PROVIDER_ID) as run:
        metadata    = {}
        raw_courses = []
        preise_lang = {}
        preise_kurz = {}

        # Schritt 1: Übersicht
        try:
            print(f"\n  Schritt 1: Übersichtsseite")
            overview_result = scrape_page(OVERVIEW_URL, PROMPT_OVERVIEW)
            metadata = overview_result.get("metadata", {}) or {}
            raw_courses = overview_result.get("courses", []) or []
            print(f"  → {len(raw_courses)} Kurse gefunden")
            time.sleep(2)
        except Exception as e:
            log_scrape_error(run.id, PROVIDER_ID, "SCRAPING_ERROR", str(e))
            run.error_count += 1

        # Schritt 2: Preise Langgymi
        try:
            print(f"\n  Schritt 2: Preise Langgymi")
            preise_lang = (scrape_page(PREISE_LANG_URL, PROMPT_PREISE_LANG).get("preise") or {})
            time.sleep(2)
        except Exception as e:
            log_scrape_error(run.id, PROVIDER_ID, "SCRAPING_ERROR",
                             f"Preise Langgymi: {e}")
            run.error_count += 1

        # Schritt 3: Preise Kurzgymi
        try:
            print(f"\n  Schritt 3: Preise Kurzgymi")
            preise_kurz = (scrape_page(PREISE_KURZ_URL, PROMPT_PREISE_KURZ).get("preise") or {})
        except Exception as e:
            log_scrape_error(run.id, PROVIDER_ID, "SCRAPING_ERROR",
                             f"Preise Kurzgymi: {e}")
            run.error_count += 1

        all_courses = transform_courses(raw_courses, preise_lang, preise_kurz)
        print(f"\n  Gesamt: {len(all_courses)} Kurse")

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