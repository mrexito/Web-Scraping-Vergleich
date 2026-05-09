"""
sGAI_lernForumScraper.py (refactored)
======================================
Scraper für Lern-Forum.ch.

WICHTIG: Dieser Scraper nutzt NICHT ScrapeGraphAI, sondern:
  - BeautifulSoup zum HTML-Fetch und -Bereinigen
  - Direkten BFH-LLM-Call (OpenAI-Client) statt SmartScraperGraph
Grund: Die lern-forum.ch Seiten haben zu viele JS-Elemente, die ScrapeGraphAI
nicht gut parsen kann — reine HTML-Text-Extraktion ist zuverlässiger.

Trotz BS4+LLM wird scraper_method='scrapegraphai' gespeichert, da der Scraper
konzeptuell zum ScrapeGraphAI-Workflow gehört (selbes LLM, selbe Prompts,
gleiches Output-Schema).
"""

import json
import re
import time
import requests
from bs4 import BeautifulSoup
from openai import OpenAI

from scrape_utils import (
    supabase,
    BFH_API_KEY,
    BFH_BASE_URL,
    BFH_MODEL,
    test_bfh_connection,
    parse_price,
    convert_date as _base_convert_date,
    extract_json_from_string as _base_extract_json,
    record_price_history,
    log_scrape_error,
    ScrapeRun,
)


SCRAPER_METHOD = "scrapegraphai"
PROVIDER_ID    = 2
PROVIDER_NAME  = "Lern-Forum.ch"
BASE_URL       = "https://www.lern-forum.ch"
MAIN_URL       = f"{BASE_URL}/gymivorbereitung-zuerich"
LANGGYMI_URL   = f"{BASE_URL}/gymivorbereitung-zuerich/langgymnasium"
KURZGYMI_URL   = f"{BASE_URL}/gymivorbereitung-zuerich/kurzgymnasium"


def extract_json_from_string(raw: str) -> dict:
    """Wrapper: NA → null ersetzen."""
    if not raw:
        return {}
    raw = re.sub(r":\s*NA\b", ": null", str(raw))
    return _base_extract_json(raw)


def convert_date(raw):
    """Wrapper: normalisiere Jahr auf 2025-2027-Fenster."""
    result = _base_convert_date(raw)
    if result:
        year = int(result[:4])
        if year not in (2025, 2026, 2027):
            return f"2026-{result[5:]}"
    return result


PROMPT_META = (
    "Du bist ein Datenextraktions-Assistent. Extrahiere NUR Metadaten:\n"
    "- aufsatzkorrektur, einstufungstest, e_learning, pruefungsarchiv, beratungsgespraech, "
    "lernunterlagen, pruefungssimulation, einzelkurse (alle als bool)\n"
    "- max_teilnehmer: Zahl\n"
    "- standorte: Liste\n"
    'Antworte NUR mit reinem JSON: {"metadata": {...}}'
)

PROMPT_LANGGYMI = (
    "Extrahiere ALLE Kurstermine für das Langgymnasium.\n"
    "Für jeden: title, weekday, course_time, location, start_date (TT.MM.JJJJ), "
    "end_date, price_chf (Zahl), availability (ausgebucht/viele), is_online (bool).\n"
    'Antworte NUR mit reinem JSON: {"courses": [...]}'
)

PROMPT_KURZGYMI = PROMPT_LANGGYMI.replace("Langgymnasium", "Kurzgymnasium und HMS")


def fetch_clean_text(url: str) -> str:
    """Seite laden, Nav/Header/Footer entfernen, reinen Text zurückgeben."""
    headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}
    r = requests.get(url, headers=headers, timeout=20)
    r.raise_for_status()
    soup = BeautifulSoup(r.text, "html.parser")
    for tag in soup.find_all(["nav", "header", "footer", "script", "style", "noscript"]):
        tag.decompose()
    body = soup.body or soup
    text = body.get_text(separator="\n", strip=True)
    lines = [l.strip() for l in text.splitlines() if l.strip() and len(l.strip()) > 3]
    return "\n".join(lines)


def call_bfh_llm(prompt: str, text: str) -> dict:
    """Bereinigten Text direkt ans BFH LLM schicken."""
    client = OpenAI(base_url=BFH_BASE_URL, api_key=BFH_API_KEY)
    response = client.chat.completions.create(
        model=BFH_MODEL,
        messages=[{"role": "user", "content": f"{prompt}\n\nSeiteninhalt:\n{text}"}],
    )
    raw = response.choices[0].message.content.strip()
    return extract_json_from_string(raw)


def scrape_page(url: str, prompt: str) -> dict:
    print(f"\n  Scrapt: {url}")
    try:
        full_text = fetch_clean_text(url)
        print(f"  HTML bereinigt: {len(full_text)} Zeichen")
    except Exception as e:
        print(f"  ⚠ HTML-Fetch fehlgeschlagen: {e}")
        raise

    chunk_size = 15000
    overlap    = 500
    chunks     = []
    start      = 0
    while start < len(full_text):
        end = min(start + chunk_size, len(full_text))
        chunks.append(full_text[start:end])
        if end == len(full_text):
            break
        start = end - overlap
    print(f"  Verarbeite {len(chunks)} Chunk(s) via BFH LLM...")

    all_courses = []
    metadata = {}
    for i, chunk in enumerate(chunks):
        print(f"  Chunk {i+1}/{len(chunks)} ({len(chunk)} Zeichen)...")
        try:
            result = call_bfh_llm(prompt, chunk)
            if isinstance(result, dict):
                all_courses.extend(result.get("courses", []) or [])
                if result.get("metadata"):
                    metadata = result["metadata"]
        except Exception as e:
            print(f"  ⚠ Chunk {i+1} Fehler: {str(e)[:100]}")

    return {"courses": all_courses, "metadata": metadata}


def transform_courses(raw_courses: list, course_type: str) -> list:
    if not raw_courses:
        return []
    anmeldung_url = LANGGYMI_URL if course_type == "langgymi" else KURZGYMI_URL
    transformed = []
    for c in raw_courses:
        title       = (c.get("title") or "").strip()
        weekday     = (c.get("weekday") or "").strip()
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
        "Pruefungsarchiv":       bool(metadata.get("pruefungsarchiv", False)),
        "Beratungsgespraech":    bool(metadata.get("beratungsgespraech", False)),
        "Eigene Lernunterlagen": bool(metadata.get("lernunterlagen", False)),
        "Standort":              standort_str,
    }).eq("ID", PROVIDER_ID).execute()
    print("  ✓ CourseDetails aktualisiert")


def main():
    print(f"Starte {PROVIDER_NAME} Scraper (BFH LLM via BS4+HTTP)...")

    if not test_bfh_connection():
        print("  Abbruch: BFH LLM nicht erreichbar.")
        return

    with ScrapeRun(SCRAPER_METHOD, PROVIDER_ID) as run:
        metadata = {}
        all_courses = []

        # Schritt 1: Metadaten
        try:
            print(f"\n  Schritt 1: Metadaten von Hauptseite")
            r = scrape_page(MAIN_URL, PROMPT_META)
            metadata = r.get("metadata", {}) or {}
            time.sleep(2)
        except Exception as e:
            log_scrape_error(run.id, PROVIDER_ID, "SCRAPING_ERROR", f"Metadaten: {e}")
            run.error_count += 1

        # Schritt 2: Langgymi
        try:
            print(f"\n  Schritt 2: Langgymnasium")
            r = scrape_page(LANGGYMI_URL, PROMPT_LANGGYMI)
            lang = transform_courses(r.get("courses", []), "langgymi")
            all_courses.extend(lang)
            print(f"  → {len(lang)} Langgymi-Kurse")
            time.sleep(2)
        except Exception as e:
            log_scrape_error(run.id, PROVIDER_ID, "SCRAPING_ERROR", f"Langgymi: {e}")
            run.error_count += 1

        # Schritt 3: Kurzgymi
        try:
            print(f"\n  Schritt 3: Kurzgymnasium")
            r = scrape_page(KURZGYMI_URL, PROMPT_KURZGYMI)
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
            except Exception as e:
                log_scrape_error(run.id, PROVIDER_ID, "INSERT_ERROR", str(e))
                run.error_count += 1
        else:
            log_scrape_error(run.id, PROVIDER_ID, "NO_COURSES_FOUND", "Keine Kurse.")
            run.error_count += 1

    print(f"\n✓ {PROVIDER_NAME} abgeschlossen")


if __name__ == "__main__":
    main()