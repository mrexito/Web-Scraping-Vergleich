"""
sGAI_schuleZuerichNordScraper.py (refactored + Self-Healing Roundtrip)
========================================================================
ScrapeGraphAI-Scraper für Schule Zürich Nord.
Besonderheit: HTML via ScrapeGraphAI + 2 PDFs via pypdf + direktem BFH-LLM-Call.

SELF-HEALING ROUNDTRIP:
-----------------------
Liest beim Start aus scraper_registry (field_name='prompts'):
  - 'overview'    → Anbieter-Metadaten (HTML)
  - 'pdf_langgymi' → Langgymi-Kurse (PDF-Inhalt → BFH LLM)
  - 'pdf_kurzgymi' → Kurzgymi-Kurse (PDF-Inhalt → BFH LLM)
Alle 3 Prompts sind eigenständig (PDF-Strukturen unterscheiden sich).
Fallback: HARDCODED_PROMPTS.
"""

import json
import io
import os
import sys
import time
import requests
from pypdf import PdfReader
from openai import OpenAI
from scrapegraphai.graphs import SmartScraperGraph

from scrape_utils import (
    supabase,
    graph_config,
    BFH_API_KEY,
    BFH_BASE_URL,
    BFH_MODEL,
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
PROVIDER_ID    = 7
PROVIDER_NAME  = "Schule Zürich Nord"
BASE_URL       = "https://szn.ch"
OVERVIEW_URL   = f"{BASE_URL}/angebote/gymikurs/"
PDF_LANGGYMI   = f"{BASE_URL}/wp-content/uploads/2026/01/Ausschreibung-Gymikurs-Langzeit-26_27.pdf"
PDF_KURZGYMI   = f"{BASE_URL}/wp-content/uploads/2026/01/Gymikurs-Kurzzeit-26_27.pdf"
ANMELDUNG_URL  = f"{BASE_URL}/angebote/gymikurs/"
LOCATION       = "Max-Bill-Platz 11/13, 8050 Zürich"


HARDCODED_PROMPTS = {
    "overview": """
Du bist ein Datenextraktions-Assistent. Extrahiere Anbieter-Metadaten:

- aufsatzkorrektur, einstufungstest, e_learning, pruefungsarchiv, beratungsgespraech,
  lernunterlagen, pruefungssimulation, einzelkurse, unterstuetzung_ausserhalb (alle als bool)
- unterstuetzung_ausserhalb: true wenn Nachholoptionen, Aufholstunden, Hausaufgabenbetreuung,
  Wiederholung verpasster Lektionen oder Unterstützung ausserhalb der Unterrichtszeiten
  angeboten wird
- max_teilnehmer: Zahl oder null
- standort: Adresse
- ausgebuchte_kurse: Liste der als AUSGEBUCHT markierten Kurse

Antworte NUR mit reinem JSON: {"metadata": {...}}
""",

    "pdf_langgymi": """
Extrahiere alle Kursinformationen aus diesem PDF-Text.
Es gibt Kurs M (Mittwoch), Kurs S (Samstag), Kurs F (Ferienkurs).

Für jeden Kurs:
- kurs_name: NUR "Kurs M", "Kurs S" oder "Kurs F"
- course_type: "langgymi"
- weekday: Wochentag (z.B. "Mittwoch", "Samstag")
- course_time: Kurszeit (z.B. "13:30-16:00")
- start_date, end_date (TT.MM.JJJJ)
- price_chf: Zahl
- availability: "ausgebucht" oder "viele"

Antworte NUR mit reinem JSON: {"courses": [...]}

PDF-Inhalt:
""",

    "pdf_kurzgymi": """
Extrahiere alle Kursinformationen aus diesem PDF-Text.

Für jeden Kurs:
- kurs_name: NUR kurze Bezeichnung (z.B. "Kurzgymi Mittwoch")
- course_type: "kurzgymi"
- weekday: Wochentag
- course_time: Kurszeit
- start_date, end_date (TT.MM.JJJJ)
- price_chf: Zahl
- availability: "ausgebucht" oder "viele"

Antworte NUR mit reinem JSON: {"courses": [...]}

PDF-Inhalt:
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


def scrape_html(url: str, prompt: str) -> dict:
    print(f"\n  Scrapt HTML: {url}")
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


def fetch_pdf_text(url: str) -> str:
    """PDF herunterladen und Text extrahieren."""
    print(f"\n  Lade PDF: {url}")
    headers = {"User-Agent": "Mozilla/5.0"}
    response = requests.get(url, headers=headers, timeout=30)
    response.raise_for_status()
    reader = PdfReader(io.BytesIO(response.content))
    text = "\n".join(page.extract_text() or "" for page in reader.pages)
    print(f"  ✓ PDF gelesen: {len(text)} Zeichen, {len(reader.pages)} Seite(n)")
    return text


def query_bfh_llm(prompt_with_text: str) -> dict:
    """Direkte BFH LLM Anfrage mit PDF-Text."""
    client = OpenAI(base_url=BFH_BASE_URL, api_key=BFH_API_KEY)
    response = client.chat.completions.create(
        model=BFH_MODEL,
        messages=[{"role": "user", "content": prompt_with_text}],
        max_tokens=2000,
    )
    raw = response.choices[0].message.content.strip()
    print(f"  LLM Antwort: {raw[:200]}")
    return extract_json_from_string(raw)


def transform_courses(raw_courses: list) -> list:
    if not raw_courses:
        return []
    transformed = []
    for c in raw_courses:
        ct_raw = (c.get("course_type") or "langgymi").lower()
        course_type = "kurzgymi" if "kurz" in ct_raw else "langgymi"
        weekday     = (c.get("weekday") or "").strip()
        course_time = (c.get("course_time") or "").strip()
        kurs_name   = (c.get("kurs_name") or "").strip()

        title = (f"Gymivorbereitung {kurs_name} | {weekday}".strip(" |")
                 if kurs_name else f"Gymivorbereitung | {weekday}")

        avail_raw = str(c.get("availability", "")).lower()

        transformed.append({
            "provider_id":     PROVIDER_ID,
            "title":           title,
            "price_chf":       parse_price(c.get("price_chf")),
            "location":        LOCATION,
            "occurrence":      weekday or None,
            "course_time":     course_time or None,
            "start_date":      convert_date(c.get("start_date")),
            "end_date":        convert_date(c.get("end_date")),
            "course_type":     course_type,
            "course_url":      ANMELDUNG_URL,
            "is_online":       False,
            "verfuegbarkeit":  "ausgebucht" if "ausgebucht" in avail_raw else "viele",
            "last_scraped_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "scraper_method":  SCRAPER_METHOD,
        })
    return transformed


def save_metadata(metadata: dict) -> None:
    if not metadata:
        return
    max_t = metadata.get("max_teilnehmer")
    max_t_str = str(int(max_t)) if max_t and str(max_t).isdigit() else None
    standort = metadata.get("standort") or LOCATION

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
        "Standort":                                 standort,
    }).eq("ID", PROVIDER_ID).execute()
    print("  ✓ CourseDetails aktualisiert")


def main():
    print(f"Starte {PROVIDER_NAME} Scraper (ScrapeGraphAI + pypdf + BFH LLM)...")

    if not test_bfh_connection():
        print("  Abbruch: BFH LLM nicht erreichbar.")
        return

    # ROUNDTRIP: Prompts aus scraper_registry laden (mit Fallback)
    active_prompts = load_prompts()

    with ScrapeRun(SCRAPER_METHOD, PROVIDER_ID) as run:
        metadata = {}
        ausgebuchte = []
        all_courses = []

        # Schritt 1: HTML-Übersicht
        try:
            print(f"\n  Schritt 1: Hauptseite — Metadaten")
            overview = scrape_html(OVERVIEW_URL, active_prompts["overview"])
            metadata = overview.get("metadata", {}) or {}
            ausgebuchte = [str(k).lower() for k in metadata.get("ausgebuchte_kurse", [])]
            time.sleep(2)
        except Exception as e:
            log_scrape_error(run.id, PROVIDER_ID, "SCRAPING_ERROR",
                             f"Übersichtsseite: {e}", None)
            run.error_count += 1

        # Schritt 2: Langgymi-PDF
        try:
            print(f"\n  Schritt 2: PDF Langgymi")
            pdf_text = fetch_pdf_text(PDF_LANGGYMI)
            if pdf_text:
                r = query_bfh_llm(active_prompts["pdf_langgymi"] + pdf_text)
                if r.get("metadata"):
                    metadata = merge_metadata(metadata, r["metadata"])
                lang_courses = transform_courses(r.get("courses", []))
                all_courses.extend(lang_courses)
                print(f"  → {len(lang_courses)} Langgymi-Kurse")
            time.sleep(2)
        except Exception as e:
            log_scrape_error(run.id, PROVIDER_ID, "SCRAPING_ERROR", f"PDF Langgymi: {e}")
            run.error_count += 1

        # Schritt 3: Kurzgymi-PDF
        try:
            print(f"\n  Schritt 3: PDF Kurzgymi")
            pdf_text = fetch_pdf_text(PDF_KURZGYMI)
            if pdf_text:
                r = query_bfh_llm(active_prompts["pdf_kurzgymi"] + pdf_text)
                if r.get("metadata"):
                    metadata = merge_metadata(metadata, r["metadata"])
                kurz_courses = transform_courses(r.get("courses", []))
                all_courses.extend(kurz_courses)
                print(f"  → {len(kurz_courses)} Kurzgymi-Kurse")
        except Exception as e:
            log_scrape_error(run.id, PROVIDER_ID, "SCRAPING_ERROR", f"PDF Kurzgymi: {e}")
            run.error_count += 1

        # Verfügbarkeit aus HTML-Übersicht korrigieren
        samstag_ausgebucht = any("samstag" in a or "kurs s" in a for a in ausgebuchte)
        if samstag_ausgebucht:
            for c in all_courses:
                occ_lower = (c.get("occurrence") or "").lower()
                title_lower = c.get("title", "").lower()
                if "samstag" in occ_lower or "kurs s" in title_lower:
                    c["verfuegbarkeit"] = "ausgebucht"
                    print(f"  → Als ausgebucht markiert: {c['title']}")

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
            log_scrape_error(run.id, PROVIDER_ID, "NO_COURSES_FOUND", "Keine Kurse.")
            run.error_count += 1

    print(f"\n✓ {PROVIDER_NAME} abgeschlossen")


if __name__ == "__main__":
    main()