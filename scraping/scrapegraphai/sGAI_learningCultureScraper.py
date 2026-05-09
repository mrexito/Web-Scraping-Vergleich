"""
sGAI_learningCultureScraper.py (refactored)
============================================
ScrapeGraphAI-Scraper für Learning Culture.
Scrapt mehrere Seiten mit unterschiedlichen Prompts (Langgymi, Kurzgymi T1/T1+, Kurzgymi T2, Probezeit).
"""

import json
import re
import time
from scrapegraphai.graphs import SmartScraperGraph

from scrape_utils import (
    supabase,
    graph_config,
    test_bfh_connection,
    parse_price,
    convert_date,
    extract_json_from_string as _base_extract_json,
    record_price_history,
    log_scrape_error,
    ScrapeRun,
)


SCRAPER_METHOD     = "scrapegraphai"
PROVIDER_ID        = 4
PROVIDER_NAME      = "Learning Culture"
BASE_URL           = "https://www.learningculture.ch"
LANGGYMI_URL       = f"{BASE_URL}/kurse/langgymi-pruefung"
KURZGYMI_URL       = f"{BASE_URL}/kurse/kurzgymi-pruefung"
PROBEZEIT_URL      = f"{BASE_URL}/kurse/gymi-probezeit"


def extract_json_from_string(raw: str) -> dict:
    """Wrapper: vorher NA → null ersetzen (Learning-Culture-spezifisch)."""
    if not raw:
        return {}
    raw = re.sub(r":\s*NA\b", ": null", str(raw))
    return _base_extract_json(raw)


PROMPT_META = (
    "Du bist ein Datenextraktions-Assistent. Extrahiere NUR die Metadaten (keine Kurse):\n"
    "- aufsatzkorrektur, einstufungstest, e_learning, pruefungsarchiv, beratungsgespraech, "
    "lernunterlagen, pruefungssimulation, einzelkurse (alle als bool)\n"
    "- max_teilnehmer: Zahl\n"
    "- standorte: Liste\n"
    'Antworte NUR mit reinem JSON: {"metadata": {...}}'
)

PROMPT_LANGGYMI_KURSE = (
    "Du bist ein Datenextraktions-Assistent. Extrahiere ALLE Kurstermine von dieser Seite.\n"
    "Abschnitte: Teil 1+ (ab März, CHF 3190), Teil 1 (ab Mai/Juni/August, CHF 1890), "
    "Teil 2 (CHF 2110), Themenkurse/Ferienkurse, Intensivkurse Sportferien (~CHF 980), "
    "Simulationsprüfung (~CHF 290).\n"
    "Für jeden Kurs:\n"
    "- title: Kursname\n"
    "- weekday, course_time, location\n"
    "- start_date, end_date (TT.MM.JJJJ)\n"
    "- price_chf (Zahl)\n"
    "- availability: 'ausgebucht' oder 'viele'\n"
    'Antworte NUR mit reinem JSON: {"courses": [...]}'
)

PROMPT_KURZGYMI_T1 = (
    "Extrahiere ALLE Teil 1+ und Teil 1 Kurstermine.\n"
    "Für jeden: title (Teil 1+ oder Teil 1), weekday, course_time, location, "
    "start_date, end_date (TT.MM.JJJJ), price_chf (Teil 1+: 3190, Teil 1: 1890), "
    "availability.\n"
    'Antworte NUR mit reinem JSON: {"courses": [...]}'
)

PROMPT_KURZGYMI_T2 = (
    "Extrahiere die Teil 2 Kurstermine.\n"
    "Für jeden: title (Teil 2), weekday, course_time, location, start_date, end_date, "
    "price_chf (~2110), availability.\n"
    'Antworte NUR mit reinem JSON: {"courses": [...]}'
)

PROMPT_PROBEZEIT = (
    "Extrahiere ALLE Probezeit-Kurse. Für jeden:\n"
    "- title (z.B. 'Langgymi Mathematik')\n"
    "- course_type: 'langgymi' oder 'kurzgymi'\n"
    "- weekday, course_time, location\n"
    "- start_date, end_date (TT.MM.JJJJ)\n"
    "- price_chf (~980)\n"
    "- availability\n"
    "- is_online: false\n"
    'Antworte NUR mit reinem JSON: {"courses": [...]}'
)


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


def transform_courses(raw_courses: list) -> list:
    if not raw_courses:
        return []
    transformed = []
    for c in raw_courses:
        ct_raw = (c.get("course_type") or "langgymi").lower()
        course_type = "kurzgymi" if "kurz" in ct_raw else "langgymi"
        title       = (c.get("title") or "").strip()
        weekday     = (c.get("weekday") or "").strip()
        course_time = (c.get("course_time") or "").strip()
        location    = (c.get("location") or "").strip()

        if "ort wie" in location.lower():
            location = "Gemäss Teil 1"
        elif location.upper() in ("NA", "N/A", "NONE", ""):
            location = ""
        if weekday.upper() == "NA":
            weekday = ""
        if course_time.upper() == "NA":
            course_time = ""

        avail_raw = str(c.get("availability", "")).lower()
        verfueg   = "ausgebucht" if "ausgebucht" in avail_raw else "viele"
        is_online = bool(c.get("is_online", False))

        if course_type == "langgymi":
            anmeldung_url = LANGGYMI_URL
        elif "probezeit" in title.lower() or "latein" in title.lower():
            anmeldung_url = PROBEZEIT_URL
        else:
            anmeldung_url = KURZGYMI_URL

        title_full = f"{title} | {weekday} {course_time}".strip(" |") \
                     if title else f"{weekday} {course_time}".strip()

        transformed.append({
            "provider_id":     PROVIDER_ID,
            "title":           title_full,
            "price_chf":       parse_price(c.get("price_chf")),
            "location":        location or "Zürich",
            "occurrence":      weekday or None,
            "course_time":     course_time or None,
            "start_date":      convert_date(c.get("start_date")),
            "end_date":        convert_date(c.get("end_date")),
            "course_type":     course_type,
            "course_url":      anmeldung_url,
            "is_online":       is_online,
            "verfuegbarkeit":  verfueg,
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
                       or "Zürich Stadelhofen, Zürich Seefeld"
    else:
        standort_str = str(standorte) or "Zürich Stadelhofen, Zürich Seefeld"

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
        "Standort":              standort_str,
    }).eq("ID", PROVIDER_ID).execute()
    print("  ✓ CourseDetails aktualisiert")


def _scrape_block(run, step_name: str, url: str, prompt: str,
                  force_type=None) -> list:
    try:
        print(f"\n  {step_name}")
        result = scrape_page(url, prompt)
        courses_raw = result.get("courses", []) or []
        if force_type:
            for c in courses_raw:
                c["course_type"] = force_type
        courses = transform_courses(courses_raw)
        print(f"  → {len(courses)} Kurs(e)")
        time.sleep(2)
        return courses
    except Exception as e:
        log_scrape_error(run.id, PROVIDER_ID, "SCRAPING_ERROR",
                         f"{step_name}: {e}")
        run.error_count += 1
        return []


def main():
    print(f"Starte {PROVIDER_NAME} Scraper (ScrapeGraphAI + BFH LLM)...")

    if not test_bfh_connection():
        print("  Abbruch: BFH LLM nicht erreichbar.")
        return

    with ScrapeRun(SCRAPER_METHOD, PROVIDER_ID) as run:
        metadata = {}

        # Schritt 1: Metadaten von Langgymi-Seite
        try:
            print(f"\n  Schritt 1: Metadaten")
            meta_result = scrape_page(LANGGYMI_URL, PROMPT_META)
            metadata = meta_result.get("metadata", {}) or {}
            time.sleep(2)
        except Exception as e:
            log_scrape_error(run.id, PROVIDER_ID, "SCRAPING_ERROR", f"Metadaten: {e}")
            run.error_count += 1

        all_courses = []
        all_courses += _scrape_block(run, "Schritt 2: Langgymi-Kurse",
                                     LANGGYMI_URL, PROMPT_LANGGYMI_KURSE,
                                     force_type="langgymi")
        all_courses += _scrape_block(run, "Schritt 3: Kurzgymi Teil 1+/1",
                                     KURZGYMI_URL, PROMPT_KURZGYMI_T1,
                                     force_type="kurzgymi")
        all_courses += _scrape_block(run, "Schritt 4: Kurzgymi Teil 2",
                                     KURZGYMI_URL, PROMPT_KURZGYMI_T2,
                                     force_type="kurzgymi")
        all_courses += _scrape_block(run, "Schritt 5: Probezeit",
                                     PROBEZEIT_URL, PROMPT_PROBEZEIT)

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
                             if c["course_type"] == course_type and c["price_chf"]
                             and not any(x in (c.get("title") or "")
                                         for x in ["Latein", "Mathe", "Probezeit",
                                                   "Simulationspruefung"])]
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