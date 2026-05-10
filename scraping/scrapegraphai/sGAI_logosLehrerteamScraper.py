"""
sGAI_logosLehrerteamScraper.py (refactored)
============================================
ScrapeGraphAI-Scraper für Logos Lehrerteam.
Scrapt 3 Seiten: Übersicht (Metadaten) + Kursdaten + Kosten.
Besonderheit: baut Kurse aus Template zusammen, dupliziert für beide Kurstypen.
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
PROVIDER_ID    = 10
PROVIDER_NAME  = "Logos Lehrerteam"
BASE_URL       = "https://www.logos-lehrerteam.ch"
ANMELDUNG_URL  = f"{BASE_URL}/kurse-gymivorbereitung-zap-anmeldung"
KURSTYPEN      = ("langgymi", "kurzgymi")


PROMPT_METADATA = """
Du bist ein Datenextraktions-Assistent. Analysiere diese Seite semantisch:

- aufsatzkorrektur: true wenn Aufsatztraining, Aufsatzkurs oder Schreibtraining erwähnt wird
- einstufungstest: true wenn Einstufungstest, Standortbestimmung, Minimalnoten erwähnt werden
- e_learning: true wenn digitales Lehrmittel, E-Learning oder Online-Plattform (z.B. edulo) erwähnt wird
- pruefungsarchiv: true wenn Probeprüfungen oder Simulationsprüfungen erwähnt werden
- beratungsgespraech: true wenn Beratung oder Kontakt angeboten wird
- lernunterlagen: true wenn Lehrmittel, Arbeitsheft oder Kursmaterial inbegriffen ist
- pruefungssimulation: true wenn Simulationsprüfung explizit erwähnt wird
- einzelkurse: true wenn Einzelunterricht oder Privatunterricht angeboten werden
- unterstuetzung_ausserhalb: true wenn Nachholoptionen, Aufholstunden, Hausaufgabenbetreuung, Wiederholung verpasster Lektionen oder Unterstützung ausserhalb der Unterrichtszeiten angeboten wird
- max_teilnehmer: maximale Gruppengrösse als Zahl
- standorte: Liste aller Kursorte

Antworte NUR mit reinem JSON: {"metadata": {...}}
"""

PROMPT_KURSDATEN = """
Extrahiere alle Kursinformationen. Kurse in 3 Teile (Teil 1, 2, 3) an Mittwoch oder Samstag.
Ausserdem Ferienkurse (Intensivkurse).

Für jeden Kursabschnitt:
- kursabschnitt: "Teil 1", "Teil 2", "Teil 3", "Herbstferienkurs 1", etc.
- kurstyp_intern: "schulbegleitend" oder "ferienkurs"
- weekdays: Liste der Wochentage (z.B. ["Mittwoch", "Samstag"])
- start_date_mi, end_date_mi (TT.MM.JJJJ, für Mittwochkurse)
- start_date_sa, end_date_sa (TT.MM.JJJJ, für Samstagkurse)
- dauer_wochen: Zahl

Antworte NUR mit reinem JSON: {"kurse": [...]}
"""

PROMPT_KOSTEN = """
Extrahiere Preisinformationen:
- preis_gesamt: Gesamtpreis alle 3 Teile bei Frühbuchung als Zahl in CHF
- preis_regulaer: Regulärpreis ohne Rabatt in CHF
- fruehbucher_rabatt_prozent: Rabatt in Prozent
- lehrmittel_inbegriffen: bool

Antworte NUR mit reinem JSON: {"kosten": {...}}
"""


def scrape_page(url: str, prompt: str) -> dict:
    print(f"\n  Scrapt: {url}")
    try:
        scraper = SmartScraperGraph(prompt=prompt, source=url, config=graph_config)
        result = scraper.run()
    except Exception as e:
        extracted = extract_json_from_string(str(e))
        if extracted:
            return extracted
        raise
    if isinstance(result, str):
        return extract_json_from_string(result)
    return result if isinstance(result, dict) else {}


def build_courses(kursdaten: dict, kosten: dict, metadata: dict) -> list:
    """Baut Kurs-Objekte aus den Template-Daten."""
    courses = []
    kurse = kursdaten.get("kurse", []) or []
    preis = parse_price(kosten.get("kosten", {}).get("preis_gesamt"))
    standorte = metadata.get("standorte", [])
    if isinstance(standorte, list):
        location = ", ".join(str(s) for s in standorte if s) or "Zürich und Umgebung"
    else:
        location = str(standorte) or "Zürich und Umgebung"

    for kurs in kurse:
        abschnitt   = kurs.get("kursabschnitt", "")
        kurstyp_int = kurs.get("kurstyp_intern", "schulbegleitend")
        weekdays    = kurs.get("weekdays", []) or []

        if kurstyp_int == "schulbegleitend":
            for wochentag in weekdays:
                if wochentag.lower() == "mittwoch":
                    start = convert_date(kurs.get("start_date_mi"))
                    end   = convert_date(kurs.get("end_date_mi"))
                    course_time = "13:30-15:10 / 15:30-17:10"
                else:
                    start = convert_date(kurs.get("start_date_sa"))
                    end   = convert_date(kurs.get("end_date_sa"))
                    course_time = "8:30-10:10 / 10:30-12:10"

                for kurstyp in KURSTYPEN:
                    courses.append({
                        "provider_id":     PROVIDER_ID,
                        "title":           f"Gymivorbereitung {abschnitt} | {wochentag}",
                        "price_chf":       preis,
                        "location":        location,
                        "occurrence":      wochentag,
                        "course_time":     course_time,
                        "start_date":      start,
                        "end_date":        end,
                        "course_type":     kurstyp,
                        "course_url":      ANMELDUNG_URL,
                        "is_online":       False,
                        "verfuegbarkeit":  "viele",
                        "last_scraped_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                        "scraper_method":  SCRAPER_METHOD,
                    })
        else:
            # Ferienkurs
            start = convert_date(kurs.get("start_date_mi") or kurs.get("start_date_sa"))
            end   = convert_date(kurs.get("end_date_mi")   or kurs.get("end_date_sa"))
            for kurstyp in KURSTYPEN:
                courses.append({
                    "provider_id":     PROVIDER_ID,
                    "title":           f"Ferienkurs {abschnitt}",
                    "price_chf":       preis,
                    "location":        "Zürich-City",
                    "occurrence":      "Mo–Fr",
                    "course_time":     "Vormittag",
                    "start_date":      start,
                    "end_date":        end,
                    "course_type":     kurstyp,
                    "course_url":      ANMELDUNG_URL,
                    "is_online":       False,
                    "verfuegbarkeit":  "viele",
                    "last_scraped_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                    "scraper_method":  SCRAPER_METHOD,
                })

    print(f"  → {len(courses)} Kurs-Objekte generiert")
    return courses


def save_metadata(metadata: dict, kosten: dict) -> None:
    if not metadata:
        return
    max_t = metadata.get("max_teilnehmer")
    max_t_str = str(int(max_t)) if max_t and str(max_t).isdigit() else None
    standorte = metadata.get("standorte", [])
    if isinstance(standorte, list):
        standort_str = ", ".join(str(s) for s in standorte if s) or "Zürich und Umgebung"
    else:
        standort_str = str(standorte) or "Zürich und Umgebung"

    supabase.table("GymiProviders").update({
        "E-Learning":                     bool(metadata.get("e_learning", False)),
        "Aufsatzkorrektur":               bool(metadata.get("aufsatzkorrektur", False)),
        "Einstufungstest":                bool(metadata.get("einstufungstest", False)),
        "Einzelkurse":                    bool(metadata.get("einzelkurse", False)),
        "Pruefungssimultaion":            bool(metadata.get("pruefungssimulation", False)),
        "Maximale Anzahl der Teilnehmer": max_t_str,
    }).eq("ID", PROVIDER_ID).execute()
    print("  ✓ GymiProviders aktualisiert")

    # Lernunterlagen kommt bei Logos aus kosten.lehrmittel_inbegriffen
    lehrmittel = bool(kosten.get("kosten", {}).get("lehrmittel_inbegriffen", False))

    supabase.table("CourseDetails").update({
        "Pruefungsarchiv":                          bool(metadata.get("pruefungsarchiv", False)),
        "Beratungsgespraech":                       bool(metadata.get("beratungsgespraech", False)),
        "Eigene Lernunterlagen":                    lehrmittel,
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
        metadata = {}
        kursdaten_result = {}
        kosten_result = {}

        try:
            print(f"\n  Schritt 1: Metadaten scrapen")
            metadata = (scrape_page(f"{BASE_URL}/kurse-gymivorbereitung-zap-uebersicht",
                                    PROMPT_METADATA).get("metadata") or {})
            time.sleep(2)
        except Exception as e:
            log_scrape_error(run.id, PROVIDER_ID, "SCRAPING_ERROR", f"Metadaten: {e}")
            run.error_count += 1

        try:
            print(f"\n  Schritt 2: Kursdaten scrapen")
            kursdaten_result = scrape_page(
                f"{BASE_URL}/kurse-gymivorbereitung-zap-kursdaten", PROMPT_KURSDATEN)
            time.sleep(2)
        except Exception as e:
            log_scrape_error(run.id, PROVIDER_ID, "SCRAPING_ERROR", f"Kursdaten: {e}")
            run.error_count += 1

        try:
            print(f"\n  Schritt 3: Kosten scrapen")
            kosten_result = scrape_page(
                f"{BASE_URL}/kurse-gymivorbereitung-zap-kosten", PROMPT_KOSTEN)
            time.sleep(2)
        except Exception as e:
            log_scrape_error(run.id, PROVIDER_ID, "SCRAPING_ERROR", f"Kosten: {e}")
            run.error_count += 1

        courses = build_courses(kursdaten_result, kosten_result, metadata)

        try:
            save_metadata(metadata, kosten_result)
        except Exception as e:
            log_scrape_error(run.id, PROVIDER_ID, "METADATA_ERROR", str(e))
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

                for course_type in KURSTYPEN:
                    typed = [c for c in courses
                             if c["course_type"] == course_type and c["price_chf"]]
                    if typed:
                        avg = round(sum(c["price_chf"] for c in typed) / len(typed))
                        record_price_history(PROVIDER_ID, course_type, avg)
            except Exception as e:
                log_scrape_error(run.id, PROVIDER_ID, "INSERT_ERROR", str(e))
                run.error_count += 1
        else:
            log_scrape_error(run.id, PROVIDER_ID, "NO_COURSES_FOUND", "Keine Kurse.")
            run.error_count += 1

    print(f"\n✓ {PROVIDER_NAME} abgeschlossen")


if __name__ == "__main__":
    main()