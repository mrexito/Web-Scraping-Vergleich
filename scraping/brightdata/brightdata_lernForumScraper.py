"""
brightdata_lernForumScraper.py
================================
Bright Data Trigger-Skript für Lern-Forum (PROVIDER_ID = 2).

Verarbeitet das Bright Data Output (JSON oder CSV) wie folgt:

  1. Metadaten-Booleans + max_teilnehmer + standorte
     → GymiProviders + CourseDetails Tabelle
  2. Kurse-Array (95 Kurse von der Übersichtsseite)
     → courses Tabelle, mit folgenden Korrekturen in Python:
        - course_type aus course_name ableiten (Bright Data labelt alle als "kurzgymi")
        - weekday-Tag aus course_name extrahieren und prependen
        - course_name normalisieren (\\n raus)

Voraussetzung auf brightdata.com:
  - Data Collector erstellt
  - Input-URL: https://www.lern-forum.ch/gymivorbereitung-zuerich
    (eine URL reicht — der Collector findet beide Tabs)
  - Collector-ID in .env als BRIGHT_DATA_COLLECTOR_ID_LERNFORUM
"""
import csv
import io
import json
import os
import re
import sys
import time
import requests
from dotenv import load_dotenv

_THIS_DIR = os.path.dirname(os.path.abspath(__file__))
_SGAI_DIR = os.path.normpath(os.path.join(_THIS_DIR, "..", "scrapegraphai"))
if _SGAI_DIR not in sys.path:
    sys.path.insert(0, _SGAI_DIR)

from scrape_utils import (
    supabase,
    parse_price,
    convert_date,
    record_price_history,
    log_scrape_error,
    ScrapeRun,
)

load_dotenv()


# =====================================================================
# KONFIGURATION
# =====================================================================
SCRAPER_METHOD = "brightdata"
PROVIDER_ID    = 2
PROVIDER_NAME  = "Lern-Forum"

BRIGHT_DATA_API_TOKEN = os.getenv("BRIGHT_DATA_API_TOKEN")
COLLECTOR_ID          = os.getenv("BRIGHT_DATA_COLLECTOR_ID_LERNFORUM")

# Eine URL reicht — der Collector findet beide Tabs auf der Übersichtsseite
URLS = [
    {"url": "https://www.lern-forum.ch/gymivorbereitung-zuerich"},
]

# Wochentage für die weekday-Extraktion aus course_name
WEEKDAYS = [
    "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag",
    "Samstag", "Sonntag",
]


# =====================================================================
# HILFSFUNKTIONEN
# =====================================================================
def trigger_scraper() -> str:
    print(f"  Starte Bright Data {PROVIDER_NAME} Job...")
    response = requests.post(
        f"https://api.brightdata.com/dca/trigger?collector={COLLECTOR_ID}&queue_next=1",
        headers={
            "Authorization": f"Bearer {BRIGHT_DATA_API_TOKEN}",
            "Content-Type": "application/json",
        },
        json=[{"url": entry["url"]} for entry in URLS],
        timeout=30,
    )
    response.raise_for_status()
    job_id = response.json().get("collection_id")
    print(f"  Job-ID: {job_id}")
    return job_id


def wait_for_results(job_id: str, max_wait: int = 180) -> list:
    """Wartet auf Bright Data Resultate. Akzeptiert JSON ODER CSV."""
    print("  Warte auf Bright Data Ergebnisse...")
    elapsed = 0
    while elapsed < max_wait:
        time.sleep(10)
        elapsed += 10
        response = requests.get(
            f"https://api.brightdata.com/dca/dataset?id={job_id}&format=json",
            headers={"Authorization": f"Bearer {BRIGHT_DATA_API_TOKEN}"},
            timeout=30,
        )
        if response.status_code == 200:
            data = response.json()
            if data:
                print(f"  ✓ Ergebnisse erhalten nach {elapsed}s")
                return data
        print(f"  ... noch nicht fertig ({elapsed}s)")
    raise TimeoutError(f"Bright Data Job {job_id} hat nach {max_wait}s keine Ergebnisse geliefert.")


def parse_bd_data(raw_data) -> list:
    """Bright Data kann JSON oder CSV-strings liefern.

    Diese Funktion normalisiert beide Formate auf eine Liste von Entries,
    wobei courses und standorte (falls als JSON-string vorhanden) geparst
    werden.
    """
    if not raw_data:
        return []

    # Wenn es bereits eine Liste von Dicts mit gemischten Typen ist
    if isinstance(raw_data, list):
        normalized = []
        for entry in raw_data:
            if not isinstance(entry, dict):
                continue
            # courses kann als String (CSV-Modus) oder als Liste (JSON) kommen
            if isinstance(entry.get("courses"), str):
                try:
                    entry["courses"] = json.loads(entry["courses"])
                except json.JSONDecodeError:
                    entry["courses"] = []
            # standorte kann auch ein String sein
            if isinstance(entry.get("standorte"), str):
                try:
                    entry["standorte"] = json.loads(entry["standorte"])
                except json.JSONDecodeError:
                    entry["standorte"] = []
            normalized.append(entry)
        return normalized

    return []


def clean_course_name(name: str) -> str:
    """Entfernt Newlines/extra spaces aus dem course_name."""
    if not name:
        return ""
    return re.sub(r"\s+", " ", name.replace("\n", " ")).strip()


def extract_weekday_from_name(course_name: str) -> str | None:
    """Sucht den Wochentag im course_name (Samstag, Mittwoch, etc.)."""
    if not course_name:
        return None
    for day in WEEKDAYS:
        if day in course_name:
            return day
    return None


def determine_course_type(course_name: str) -> str | None:
    """Leitet den Kurstyp aus dem course_name ab.

    Wichtig: Das Bright-Data-Schema labelt fälschlicherweise alle Kurse
    als 'kurzgymi'. Wir korrigieren das hier basierend auf course_name.
    """
    if not course_name:
        return None
    name_lower = course_name.lower()
    if "langgymnasium" in name_lower or "langgymi" in name_lower:
        return "langgymi"
    if "kurzgymnasium" in name_lower or "kurzgymi" in name_lower:
        return "kurzgymi"
    return None


def normalize_availability(raw):
    """Normalisiert availability_status auf viele/wenige/ausgebucht."""
    if not raw:
        return None
    raw_lower = str(raw).strip().lower()
    if "ausgebucht" in raw_lower or "voll" in raw_lower:
        return "ausgebucht"
    if "wenige" in raw_lower:
        return "wenige"
    if "viele" in raw_lower or "frei" in raw_lower or "verfügbar" in raw_lower:
        return "viele"
    return None


def normalize_location(loc: str) -> str | None:
    """Normalisiert location: 'Zu Hause' und Varianten → 'online'."""
    if not loc:
        return None
    loc_lower = loc.strip().lower()
    if loc_lower in ("zu hause", "zuhause", "online"):
        return "online"
    return loc.strip()


# =====================================================================
# METADATEN-UPDATE: GymiProviders + CourseDetails
# =====================================================================
def update_provider_metadata(metadata: dict, run_id: str):
    """Schreibt die Stammdaten in GymiProviders und CourseDetails.

    Analog zum Puppeteer- und ScrapeGraphAI-Scraper, damit der
    Drei-Wege-Vergleich auf identischer Datenbasis möglich ist.
    """
    if not metadata:
        print("  ⚠ Keine Metadaten verfügbar — Schritt übersprungen")
        return

    max_t = metadata.get("max_teilnehmer")
    max_t_str = str(int(max_t)) if max_t and isinstance(max_t, (int, float)) else None

    standorte = metadata.get("standorte", [])
    if isinstance(standorte, list) and standorte:
        standort_str = ", ".join(str(s) for s in standorte if s)
    else:
        standort_str = "Zürich"

    # GymiProviders: Anbieter-weite Stammdaten
    try:
        supabase.table("GymiProviders").update({
            "E-Learning":                     bool(metadata.get("e_learning", False)),
            "Aufsatzkorrektur":               bool(metadata.get("aufsatzkorrektur", False)),
            "Einstufungstest":                bool(metadata.get("einstufungstest", False)),
            "Einzelkurse":                    bool(metadata.get("einzelkurse", False)),
            "Pruefungssimultaion":            bool(metadata.get("pruefungssimulation", False)),
            "Maximale Anzahl der Teilnehmer": max_t_str,
        }).eq("ID", PROVIDER_ID).execute()
        print("  ✓ GymiProviders aktualisiert")
    except Exception as e:
        msg = f"GymiProviders Update fehlgeschlagen: {e}"
        print(f"  ✗ {msg}")
        log_scrape_error(run_id, PROVIDER_ID, "METADATA_ERROR", msg)

    # CourseDetails: Kurs-spezifische Stammdaten
    try:
        supabase.table("CourseDetails").update({
            "Pruefungsarchiv":       bool(metadata.get("pruefungsarchiv", False)),
            "Beratungsgespraech":    bool(metadata.get("beratungsgespraech", False)),
            "Eigene Lernunterlagen": bool(metadata.get("lernunterlagen", False)),
            "Standort":              standort_str,
        }).eq("ID", PROVIDER_ID).execute()
        print("  ✓ CourseDetails aktualisiert")
    except Exception as e:
        msg = f"CourseDetails Update fehlgeschlagen: {e}"
        print(f"  ✗ {msg}")
        log_scrape_error(run_id, PROVIDER_ID, "METADATA_ERROR", msg)


# =====================================================================
# KURSE-TRANSFORMATION
# =====================================================================
def transform_courses(entries: list) -> list:
    """Transformiert die Bright Data Entries in das Supabase-Format.

    Wichtig:
    - Es werden nur Kurse aus dem ersten Entry verarbeitet (Übersichtsseite),
      da diese bereits beide Tabs (Lang + Kurz) enthält.
    - course_type wird aus course_name korrigiert (BD labelt falsch).
    - weekday wird aus course_name + Zeit zusammengesetzt.
    """
    courses = []

    if not entries:
        return courses

    # Wir nutzen den ersten Entry, der die Übersichtsseite ist
    main_entry = entries[0]
    raw_courses = main_entry.get("courses", [])

    if not isinstance(raw_courses, list):
        print(f"  ⚠ courses ist kein Array: {type(raw_courses).__name__}")
        return courses

    source_url = main_entry.get("input_url") or \
                 main_entry.get("input", {}).get("url") if isinstance(main_entry.get("input"), dict) else None
    source_url = source_url or "https://www.lern-forum.ch/gymivorbereitung-zuerich"

    skipped = 0

    for raw in raw_courses:
        if not isinstance(raw, dict):
            continue

        # course_name säubern
        course_name = clean_course_name(raw.get("course_name", ""))

        # course_type aus course_name korrigieren
        course_type = determine_course_type(course_name)
        if course_type is None:
            skipped += 1
            continue  # Kurs ohne erkennbaren Typ überspringen

        # weekday aus name + time zusammensetzen
        time_str = (raw.get("weekday") or "").strip()
        day = extract_weekday_from_name(course_name)
        if day and time_str:
            occurrence = f"{day} {time_str}"
        elif day:
            occurrence = day
        elif time_str:
            occurrence = time_str
        else:
            occurrence = None

        # location normalisieren
        location = normalize_location(raw.get("location"))

        courses.append({
            "provider_id":     PROVIDER_ID,
            "title":           course_name,
            "price_chf":       parse_price(raw.get("price_chf")),
            "location":        location,
            "occurrence":      occurrence,
            "course_type":     course_type,
            "course_url":      source_url,
            "is_online":       location == "online" if location else False,
            "verfuegbarkeit":  normalize_availability(raw.get("availability_status")),
            "start_date":      convert_date(raw.get("start_date")),
            "end_date":        convert_date(raw.get("end_date")),
            "last_scraped_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "scraper_method":  SCRAPER_METHOD,
        })

    if skipped:
        print(f"  ⚠ {skipped} Kurs(e) ohne erkennbaren Kurstyp übersprungen")

    return courses


# =====================================================================
# MAIN
# =====================================================================
def main():
    print(f"Starte {PROVIDER_NAME} Scraper (Bright Data)...")

    if not BRIGHT_DATA_API_TOKEN or not COLLECTOR_ID:
        print(f"  ✗ BRIGHT_DATA_API_TOKEN oder BRIGHT_DATA_COLLECTOR_ID_LERNFORUM fehlt in .env")
        return

    with ScrapeRun(SCRAPER_METHOD, PROVIDER_ID) as run:
        # 1. Bright Data Job triggern
        try:
            job_id = trigger_scraper()
        except Exception as e:
            msg = f"Trigger fehlgeschlagen: {e}"
            print(f"  ✗ {msg}")
            log_scrape_error(run.id, PROVIDER_ID, "TRIGGER_ERROR", msg)
            run.error_count += 1
            return

        # 2. Auf Ergebnisse warten
        try:
            raw_data = wait_for_results(job_id)
        except Exception as e:
            msg = f"Warten auf Ergebnisse fehlgeschlagen: {e}"
            print(f"  ✗ {msg}")
            log_scrape_error(run.id, PROVIDER_ID, "TIMEOUT_ERROR", msg)
            run.error_count += 1
            return

        # 3. Daten parsen (JSON oder CSV)
        try:
            entries = parse_bd_data(raw_data)
            if not entries:
                msg = "Keine Entries im Bright Data Output."
                print(f"  ✗ {msg}")
                log_scrape_error(run.id, PROVIDER_ID, "NO_DATA", msg)
                run.error_count += 1
                return
            print(f"  → {len(entries)} Entry(s) erhalten")
        except Exception as e:
            msg = f"Parse-Fehler: {e}"
            print(f"  ✗ {msg}")
            log_scrape_error(run.id, PROVIDER_ID, "PARSE_ERROR", msg)
            run.error_count += 1
            return

        # 4. Metadaten in GymiProviders + CourseDetails schreiben
        # Wir nehmen den ersten Entry als Quelle (Übersichtsseite hat alle Metadaten)
        update_provider_metadata(entries[0], run.id)

        # 5. Kurse transformieren
        try:
            courses = transform_courses(entries)
            print(f"  → {len(courses)} Kurs(e) transformiert")
        except Exception as e:
            msg = f"Transformation fehlgeschlagen: {e}"
            print(f"  ✗ {msg}")
            log_scrape_error(run.id, PROVIDER_ID, "TRANSFORM_ERROR", msg)
            run.error_count += 1
            return

        # 6. Alte BD-Kurse löschen, neue speichern
        try:
            supabase.table("courses").delete() \
                .eq("provider_id", PROVIDER_ID) \
                .eq("scraper_method", SCRAPER_METHOD) \
                .execute()
            print("  Alte Bright-Data-Kurse gelöscht.")

            if courses:
                supabase.table("courses").insert(courses).execute()
                run.courses_found = len(courses)
                print(f"  ✓ {len(courses)} Kurs(e) gespeichert")

                # price_history pro course_type
                for course_type in ("langgymi", "kurzgymi"):
                    typed = [c for c in courses
                             if c["course_type"] == course_type and c["price_chf"]]
                    if typed:
                        avg = round(sum(c["price_chf"] for c in typed) / len(typed))
                        record_price_history(PROVIDER_ID, course_type, avg)
                        print(f"  ✓ price_history {course_type}: avg CHF {avg}")
            else:
                log_scrape_error(run.id, PROVIDER_ID, "NO_COURSES_FOUND",
                                 "Keine Kurse von Bright Data erhalten.")
                run.error_count += 1

        except Exception as e:
            msg = f"DB-Insert fehlgeschlagen: {e}"
            print(f"  ✗ {msg}")
            log_scrape_error(run.id, PROVIDER_ID, "INSERT_ERROR", msg)
            run.error_count += 1

    print(f"\n✓ {PROVIDER_NAME} Bright Data abgeschlossen")


if __name__ == "__main__":
    main()