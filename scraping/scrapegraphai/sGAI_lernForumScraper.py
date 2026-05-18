"""
sGAI_lernForumScraper.py (+ Self-Healing Roundtrip)
====================================================
ScrapeGraphAI-Scraper für Lern-Forum.ch (Provider 2).

Nutzt nativ SmartScraperGraph aus ScrapeGraphAI mit Provider-spezifischer
graph_config: Lern-Forum hat eine sehr grosse HTML-Seite, die mit dem
Standard-model_tokens=32000 das BFH-LLM Context-Limit überschreitet.
Per-Provider-Override (siehe scrape_utils.get_graph_config) reduziert
model_tokens auf 4000, damit die ParseNode mehr/kleinere Chunks bildet.

Scrapt drei Seiten:
  1. Hauptseite: Anbieter-Metadaten
  2. Langgymnasium-Seite: Langgymi-Kurstermine
  3. Kurzgymnasium-Seite: Kurzgymi-Kurstermine

SELF-HEALING ROUNDTRIP:
-----------------------
Liest beim Start zwei Prompts aus scraper_registry (field_name='prompts',
Keys 'meta' + 'courses'). Fallback: HARDCODED_PROMPTS.
"""

import json
import os
import sys
import time
from scrapegraphai.graphs import SmartScraperGraph

from scrape_utils import (
    supabase,
    get_graph_config,
    test_bfh_connection,
    parse_price,
    convert_date as _base_convert_date,
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
PROVIDER_ID    = 2
PROVIDER_NAME  = "Lern-Forum.ch"
BASE_URL       = "https://www.lern-forum.ch"
MAIN_URL       = f"{BASE_URL}/gymivorbereitung-zuerich"
LANGGYMI_URL   = f"{BASE_URL}/gymivorbereitung-zuerich/langgymnasium"
KURZGYMI_URL   = f"{BASE_URL}/gymivorbereitung-zuerich/kurzgymnasium"

# Provider-spezifische graph_config (lern-forum.ch braucht kleinere Chunks).
_GRAPH_CONFIG = get_graph_config(PROVIDER_ID)


def convert_date(raw):
    """Wrapper: normalisiere Jahr auf 2025-2027-Fenster."""
    result = _base_convert_date(raw)
    if result:
        try:
            year = int(result[:4])
            if year not in (2025, 2026, 2027):
                return f"2026-{result[5:]}"
        except (ValueError, IndexError):
            pass
    return result


HARDCODED_PROMPTS = {
    "meta": (
        "Du bist ein Datenextraktions-Assistent. Extrahiere NUR Metadaten:\n"
        "- aufsatzkorrektur, einstufungstest, e_learning, pruefungsarchiv, beratungsgespraech, "
        "lernunterlagen, pruefungssimulation, einzelkurse, unterstuetzung_ausserhalb (alle als bool)\n"
        "- unterstuetzung_ausserhalb: true wenn Nachholoptionen, Aufholstunden, Hausaufgabenbetreuung, "
        "Wiederholung verpasster Lektionen oder Unterstützung ausserhalb der Unterrichtszeiten "
        "angeboten wird\n"
        "- max_teilnehmer: Zahl\n"
        "- standorte: Liste\n"
        'Antworte NUR mit reinem JSON: {"metadata": {...}}'
    ),
    # Kein Kurstyp-Filter im Prompt — der Kurstyp wird via URL bestimmt
    # (Single Source of Truth = URL, nicht das LLM-Urteil).
    "courses": (
        "Extrahiere ALLE Kurstermine von dieser Seite. Antworte auf Deutsch.\n"
        "Für jeden Kurs: title (Deutsch), weekday (deutscher Wochentag: Montag/Dienstag/Mittwoch/"
        "Donnerstag/Freitag/Samstag/Sonntag), course_time, location, "
        "start_date (TT.MM.JJJJ), end_date, price_chf (Zahl), "
        "availability (ausgebucht/viele), is_online (bool).\n"
        'Antworte NUR mit reinem JSON: {"courses": [...]}'
    ),
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
        scraper = SmartScraperGraph(prompt=prompt, source=url, config=_GRAPH_CONFIG)
        result = scraper.run()
    except Exception as e:
        extracted = extract_json_from_string(str(e))
        if extracted:
            return extracted
        raise
    if isinstance(result, str):
        return extract_json_from_string(result)
    return result if isinstance(result, dict) else {}


def _normalize_weekday(raw: str) -> str:
    """Englische Wochentage → Deutsch."""
    if not raw:
        return ""
    mapping = {
        "monday": "Montag", "tuesday": "Dienstag", "wednesday": "Mittwoch",
        "thursday": "Donnerstag", "friday": "Freitag", "saturday": "Samstag",
        "sunday": "Sonntag",
    }
    s = raw.strip()
    return mapping.get(s.lower(), s)


def transform_courses(raw_courses: list, course_type: str) -> list:
    """course_type kommt aus dem Aufrufer (URL-basiert), nicht LLM."""
    if not raw_courses:
        return []

    anmeldung_url = LANGGYMI_URL if course_type == "langgymi" else KURZGYMI_URL
    transformed = []
    seen = set()

    for c in raw_courses:
        title       = (c.get("title") or "").strip()
        weekday     = _normalize_weekday((c.get("weekday") or "").strip())
        course_time = (c.get("course_time") or "").strip()
        location    = (c.get("location") or "Zürich").strip()

        if weekday.upper() == "NA":
            weekday = ""
        if course_time.upper() == "NA":
            course_time = ""

        avail_raw = str(c.get("availability", "")).lower()
        verfueg   = "ausgebucht" if "ausgebucht" in avail_raw else "viele"
        is_online = bool(c.get("is_online", False)) or "online" in location.lower()

        title_full = f"{title} | {weekday} {course_time}".strip(" |") \
                     if title else f"{weekday} {course_time}".strip()

        start = c.get("start_date") or ""
        dedup_key = (title_full.lower(), weekday.lower(), start)
        if dedup_key in seen:
            continue
        seen.add(dedup_key)

        transformed.append({
            "provider_id":     PROVIDER_ID,
            "title":           title_full,
            "price_chf":       parse_price(c.get("price_chf")),
            "location":        location,
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
    print(f"Starte {PROVIDER_NAME} Scraper (NATIV ScrapeGraphAI + per-provider chunk_size)...")

    if not test_bfh_connection():
        print("  Abbruch: BFH LLM nicht erreichbar.")
        return

    # ROUNDTRIP: Prompts aus scraper_registry laden (mit Fallback)
    active_prompts = load_prompts()

    with ScrapeRun(SCRAPER_METHOD, PROVIDER_ID) as run:
        metadata = {}
        all_courses = []

        try:
            print(f"\n  Schritt 1: Metadaten")
            r = scrape_page(MAIN_URL, active_prompts["meta"])
            metadata = r.get("metadata", {}) or {}
            time.sleep(2)
        except Exception as e:
            log_scrape_error(run.id, PROVIDER_ID, "SCRAPING_ERROR", f"Metadaten: {e}")
            run.error_count += 1

        try:
            print(f"\n  Schritt 2: Langgymnasium")
            r = scrape_page(LANGGYMI_URL, active_prompts["courses"])
            lang = transform_courses(r.get("courses", []), "langgymi")
            all_courses.extend(lang)
            print(f"  → {len(lang)} Langgymi-Kurse")
            time.sleep(2)
        except Exception as e:
            log_scrape_error(run.id, PROVIDER_ID, "SCRAPING_ERROR", f"Langgymi: {e}")
            run.error_count += 1

        try:
            print(f"\n  Schritt 3: Kurzgymnasium")
            r = scrape_page(KURZGYMI_URL, active_prompts["courses"])
            kurz = transform_courses(r.get("courses", []), "kurzgymi")
            all_courses.extend(kurz)
            print(f"  → {len(kurz)} Kurzgymi-Kurse")
        except Exception as e:
            log_scrape_error(run.id, PROVIDER_ID, "SCRAPING_ERROR", f"Kurzgymi: {e}")
            run.error_count += 1

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
                        print(f"  ✓ price_history {course_type}: avg CHF {avg}")
            except Exception as e:
                log_scrape_error(run.id, PROVIDER_ID, "INSERT_ERROR", str(e))
                run.error_count += 1
        else:
            log_scrape_error(run.id, PROVIDER_ID, "NO_COURSES_FOUND", "Keine Kurse.")
            run.error_count += 1

    print(f"\n✓ {PROVIDER_NAME} abgeschlossen")


if __name__ == "__main__":
    main()