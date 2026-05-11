"""
sGAI_gymivorbereitungFokusScraper.py (refactored)
==================================================
ScrapeGraphAI-Scraper für Gymivorbereitung Fokus.
Scrapt 5 Seiten: Hauptseite (Metadaten) + Langgymi-Main + Kurzgymi-Main
+ Langgymi-Kurse + Kurzgymi-Kurse.
Besonderheit: Kurs-Daten aus Kalenderwochen statt Datum.
"""

import json
import time
import datetime
from scrapegraphai.graphs import SmartScraperGraph

from scrape_utils import (
    supabase,
    graph_config,
    test_bfh_connection,
    parse_price,
    extract_json_from_string,
    merge_metadata,
    record_price_history,
    log_scrape_error,
    ScrapeRun,
)


SCRAPER_METHOD     = "scrapegraphai"
PROVIDER_ID        = 5
PROVIDER_NAME      = "Gymivorbereitung Fokus"
BASE_URL           = "https://www.gymivorbereitung-fokus.ch"
OVERVIEW_URL       = f"{BASE_URL}/"
LANGGYMI_MAIN_URL  = f"{BASE_URL}/langzeitgymnasium"
KURZGYMI_MAIN_URL  = f"{BASE_URL}/kurzzeitgymnasium"
LANGGYMI_URL       = f"{BASE_URL}/kurse/gymivorbereitungskurs-langzeit"
KURZGYMI_URL       = f"{BASE_URL}/kurse/gymivorbereitungskurs-kurzzeit"
ANMELDUNG_LANG_URL = f"{BASE_URL}/kurse/gymivorbereitungskurs-langzeit#form"
ANMELDUNG_KURZ_URL = f"{BASE_URL}/kurse/gymivorbereitungskurs-kurzzeit#form"


PROMPT_OVERVIEW = (
    "Du bist ein Datenextraktions-Assistent. Extrahiere Anbieter-Metadaten von dieser Seite:\n"
    "- aufsatzkorrektur, einstufungstest, e_learning, pruefungsarchiv, beratungsgespraech, "
    "lernunterlagen, pruefungssimulation, einzelkurse, unterstuetzung_ausserhalb (alle als bool)\n"
    "- unterstuetzung_ausserhalb: true wenn Nachholoptionen, Aufholstunden, Hausaufgabenbetreuung, "
    "Wiederholung verpasster Lektionen oder Unterstützung ausserhalb der Unterrichtszeiten "
    "angeboten wird\n"
    "- max_teilnehmer: Zahl\n"
    "- standorte: Liste\n"
    'Antworte NUR mit reinem JSON: {"metadata": {...}}'
)

PROMPT_LANGGYMI = (
    "Du bist ein Datenextraktions-Assistent. Extrahiere ALLE Kurse und Preise.\n"
    "Für jeden Kurs:\n"
    "- kurs_id: Kurs-Buchstabe\n"
    "- weekday: Wochentag (Mittwoch/Samstag/...)\n"
    "- course_time: Kurszeit\n"
    "- location: echter Standortname (Zürich HB, Bülach, Winterthur, Stadelhofen, Wetzikon, "
    "Uster, Meilen, Horgen, Wädenswil, Schaffhausen, Online). NIE 'NA' oder 'unbekannt'.\n"
    "- is_online: bool\n"
    "Zusätzlich:\n"
    "- price_chf, price_online_chf (Zahlen)\n"
    "- start_kw, end_kw (Kalenderwochen als Zahl)\n"
    "- num_kurstage (Zahl)\n"
    'Antworte NUR mit JSON: {"courses": [...], "price_chf": ..., "price_online_chf": ..., '
    '"start_kw": ..., "end_kw": ..., "num_kurstage": ...}'
)

PROMPT_KURZGYMI = PROMPT_LANGGYMI.replace("Langzeit", "Kurzzeit")


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


def kw_to_date(kw, weekday_name: str, year: int):
    """Kalenderwoche + Wochentag → YYYY-MM-DD."""
    if kw is None:
        return None
    try:
        kw_int = int(str(kw))
    except (ValueError, TypeError):
        return None

    WEEKDAY_MAP = {
        "montag": 0, "dienstag": 1, "mittwoch": 2, "donnerstag": 3,
        "freitag": 4, "samstag": 5, "sonntag": 6,
    }
    wd = WEEKDAY_MAP.get(weekday_name.lower(), 0)
    try:
        date = datetime.datetime.strptime(f"{year}-W{kw_int:02d}-{wd+1}", "%Y-W%W-%w")
        return date.strftime("%Y-%m-%d")
    except Exception:
        return None


def transform_courses(
    raw_courses: list, course_type: str,
    price_chf: int, price_online: int,
    start_kw=None, end_kw=None,
) -> list:
    if not raw_courses:
        return []
    transformed = []
    for c in raw_courses:
        kurs_id     = (c.get("kurs_id") or "").strip()
        weekday     = (c.get("weekday") or "").strip()
        course_time = (c.get("course_time") or "").strip()
        location    = (c.get("location") or "").strip()
        if location.upper() in ("NA", "N/A", "NONE", ""):
            location = "Diverse Standorte"
        is_online = bool(c.get("is_online", False)) or "online" in location.lower()
        price     = price_online if is_online else price_chf
        anmeldung_url = ANMELDUNG_KURZ_URL if course_type == "kurzgymi" else ANMELDUNG_LANG_URL

        titel_parts = [f"Kurs {kurs_id}" if kurs_id else "", weekday, course_time]
        title = " | ".join(p for p in titel_parts if p).strip(" |")

        start_date = kw_to_date(start_kw, weekday, 2026) if start_kw else None
        end_date   = kw_to_date(end_kw,   weekday, 2027) if end_kw   else None

        transformed.append({
            "provider_id":     PROVIDER_ID,
            "title":           title,
            "price_chf":       price,
            "location":        location or "Diverse Standorte",
            "occurrence":      weekday or None,
            "course_time":     course_time or None,
            "start_date":      start_date,
            "end_date":        end_date,
            "course_type":     course_type,
            "course_url":      anmeldung_url,
            "is_online":       is_online,
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
        standort_str = ", ".join(str(s) for s in standorte if s) \
                       or "Zürich HB, Winterthur, Bülach und weitere"
    else:
        standort_str = str(standorte) or "Zürich HB, Winterthur, Bülach und weitere"

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
        metadata = {}

        # Schritt 1-3: Metadaten von 3 Seiten zusammenmergen
        for i, url in enumerate([OVERVIEW_URL, LANGGYMI_MAIN_URL, KURZGYMI_MAIN_URL], start=1):
            try:
                print(f"\n  Schritt {i}: Metadaten von {url}")
                r = scrape_page(url, PROMPT_OVERVIEW)
                meta = r.get("metadata", {}) or {}
                if meta:
                    metadata = merge_metadata(metadata, meta)
                time.sleep(2)
            except Exception as e:
                log_scrape_error(run.id, PROVIDER_ID, "SCRAPING_ERROR",
                                 f"Metadaten-Seite {i}: {e}")
                run.error_count += 1

        # Schritt 4: Langgymi-Kurse
        price_chf = 2450
        price_online = 2250
        start_kw_lang = end_kw_lang = None
        langgymi_courses = []
        try:
            print(f"\n  Schritt 4: Langgymi-Kurse")
            r = scrape_page(LANGGYMI_URL, PROMPT_LANGGYMI)
            price_chf     = parse_price(r.get("price_chf")) or 2450
            price_online  = parse_price(r.get("price_online_chf")) or 2250
            start_kw_lang = r.get("start_kw")
            end_kw_lang   = r.get("end_kw")
            langgymi_courses = transform_courses(
                r.get("courses", []), "langgymi",
                price_chf, price_online, start_kw_lang, end_kw_lang,
            )
            print(f"  → {len(langgymi_courses)} Langgymi-Kurse | vor Ort CHF {price_chf} / Online CHF {price_online}")
            time.sleep(2)
        except Exception as e:
            log_scrape_error(run.id, PROVIDER_ID, "SCRAPING_ERROR", f"Langgymi: {e}")
            run.error_count += 1

        # Schritt 5: Kurzgymi-Kurse
        kurzgymi_courses = []
        try:
            print(f"\n  Schritt 5: Kurzgymi-Kurse")
            r = scrape_page(KURZGYMI_URL, PROMPT_KURZGYMI)
            start_kw_kurz = r.get("start_kw") or start_kw_lang
            end_kw_kurz   = r.get("end_kw")   or end_kw_lang
            kurzgymi_courses = transform_courses(
                r.get("courses", []), "kurzgymi",
                price_chf, price_online, start_kw_kurz, end_kw_kurz,
            )
            print(f"  → {len(kurzgymi_courses)} Kurzgymi-Kurse")
        except Exception as e:
            log_scrape_error(run.id, PROVIDER_ID, "SCRAPING_ERROR", f"Kurzgymi: {e}")
            run.error_count += 1

        all_courses = langgymi_courses + kurzgymi_courses
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
                             if c["course_type"] == course_type
                             and c["price_chf"] and not c["is_online"]]
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