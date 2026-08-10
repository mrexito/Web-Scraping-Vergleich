"""
brightdata_lernForumScraper.py
================================
Bright Data Trigger-Skript für Lern-Forum (PROVIDER_ID = 2).

Collector-Schema (Stand aktuell): FLACHE Liste, eine Zeile pro Kurs, mit
deutschen Feldnamen. Zwei Felder sind im Collector-Template offenbar falsch
verdrahtet: "Uhrzeit" enthält tatsächlich ein Datum (z.B. "22.08.26"),
"Startdatum" enthält tatsächlich eine Zielstufen-Angabe (z.B. "6. Klasse",
"2./3. Sek"). Weder Preis noch Ort noch ein echtes End-Datum werden geliefert.

Verarbeitet das Bright Data Output wie folgt:
  1. course_type aus "Kursart" (Fallback: aus course_name, da einige Zeilen
     kein Kursart-Feld haben)
  2. "Wochentag" wird direkt übernommen (korrekt beschriftet)
  3. Start-Datum wird aus dem fehlbeschrifteten "Uhrzeit"-Feld extrahiert
  4. Preis, Ort, End-Datum, Verfügbarkeit bleiben NULL (nicht vorhanden)
  5. GymiProviders/CourseDetails werden NICHT mehr aktualisiert — der
     Collector liefert keine Provider-weiten Metadaten-Booleans mehr

Voraussetzung auf brightdata.com:
  - Data Collector erstellt
  - Input-URL: https://www.lern-forum.ch/gymivorbereitung-zuerich
    (eine URL reicht — der Collector findet beide Tabs)
  - Collector-ID in .env als BRIGHT_DATA_COLLECTOR_ID_LERNFORUM
"""
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
    convert_date,
    log_scrape_error,
    save_courses,
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


def clean_course_name(name: str) -> str:
    """Entfernt Newlines/extra spaces aus dem course_name."""
    if not name:
        return ""
    return re.sub(r"\s+", " ", name.replace("\n", " ")).strip()


def determine_course_type(course_name: str) -> str | None:
    """Leitet den Kurstyp aus dem course_name ab (Fallback für Zeilen ohne Kursart)."""
    if not course_name:
        return None
    name_lower = course_name.lower()
    if "langgymnasium" in name_lower or "langgymi" in name_lower:
        return "langgymi"
    if "kurzgymnasium" in name_lower or "kurzgymi" in name_lower:
        return "kurzgymi"
    return None


def map_course_type(kursart: str | None, course_name: str) -> str | None:
    """Leitet course_type primär aus 'Kursart' ab, sonst aus course_name."""
    if kursart:
        kl = kursart.lower()
        if "langzeit" in kl:
            return "langgymi"
        if "kurzzeit" in kl:
            return "kurzgymi"
    return determine_course_type(course_name)


def extract_start_date(uhrzeit: str | None) -> str | None:
    """Extrahiert ein Datum aus dem fehlbeschrifteten 'Uhrzeit'-Feld.

    Werte sehen aus wie '22.08.26' oder 'Sa 13.02.27' — ein optionales
    Wochentags-Kürzel vor dem eigentlichen dd.mm.yy-Datum.
    """
    if not uhrzeit:
        return None
    m = re.search(r"\d{1,2}\.\d{1,2}\.\d{2,4}", str(uhrzeit))
    return convert_date(m.group(0)) if m else None


# =====================================================================
# KURSE-TRANSFORMATION
# =====================================================================
def transform_courses(entries: list) -> list:
    """Transformiert die Bright Data Entries in das Supabase-Format.

    Flache Liste, ein Element pro Kurstermin. Preis, Ort, End-Datum und
    Verfügbarkeit liefert der Collector aktuell nicht (bleiben NULL).
    """
    courses = []
    skipped = 0

    for raw in entries:
        if not isinstance(raw, dict):
            continue

        course_name = clean_course_name(raw.get("Kursname", ""))
        if not course_name:
            skipped += 1
            continue

        course_type = map_course_type(raw.get("Kursart"), course_name)
        if course_type is None:
            skipped += 1
            continue

        url = raw.get("product_page_url") \
            or (raw.get("input") or {}).get("url") \
            or "https://www.lern-forum.ch/gymivorbereitung-zuerich"

        courses.append({
            "provider_id":     PROVIDER_ID,
            "title":           course_name,
            "price_chf":       None,
            "location":        None,
            "occurrence":      clean_course_name(raw.get("Wochentag", "")) or None,
            "course_type":     course_type,
            "course_url":      url,
            "is_online":       bool(raw.get("Online_Kurs")),
            "verfuegbarkeit":  None,
            "start_date":      extract_start_date(raw.get("Uhrzeit")),
            "end_date":        None,
            "last_scraped_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "scraper_method":  SCRAPER_METHOD,
        })

    if skipped:
        print(f"  ⚠ {skipped} Kurs(e) ohne Namen/erkennbaren Kurstyp übersprungen")

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

        if not isinstance(raw_data, list) or not raw_data:
            msg = "Keine Entries im Bright Data Output."
            print(f"  ✗ {msg}")
            log_scrape_error(run.id, PROVIDER_ID, "NO_DATA", msg)
            run.error_count += 1
            return

        print(f"  → {len(raw_data)} Entry(s) erhalten")

        # 3. Kurse transformieren
        try:
            courses = transform_courses(raw_data)
            print(f"  → {len(courses)} Kurs(e) transformiert")
        except Exception as e:
            msg = f"Transformation fehlgeschlagen: {e}"
            print(f"  ✗ {msg}")
            log_scrape_error(run.id, PROVIDER_ID, "TRANSFORM_ERROR", msg)
            run.error_count += 1
            return

        # 4. Alte BD-Kurse nur löschen, wenn tatsächlich Ersatzdaten da sind
        save_courses(run, courses, "Bright-Data-Kurse")

    print(f"\n✓ {PROVIDER_NAME} Bright Data abgeschlossen")


if __name__ == "__main__":
    main()