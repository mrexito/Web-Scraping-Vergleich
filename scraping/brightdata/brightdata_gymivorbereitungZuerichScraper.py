import os
import re
import sys
import time
import requests
from dotenv import load_dotenv

_THIS_DIR = os.path.dirname(os.path.abspath(__file__))
_SGAI_DIR = os.path.normpath(os.path.join(_THIS_DIR, "..", "scrapeGraphAi"))
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


# KONFIGURATION
SCRAPER_METHOD = "brightdata"
PROVIDER_ID    = 1
PROVIDER_NAME  = "Gymivorbereitung Zürich"

BRIGHT_DATA_API_TOKEN = os.getenv("BRIGHT_DATA_API_TOKEN")
COLLECTOR_ID          = os.getenv("BRIGHT_DATA_COLLECTOR_ID_GYMIZH")

URLS = [
    {"url": "https://gymivorbereitung-zuerich.ch/langzeit/halbjahreskurs",  "course_type": "langgymi"},
    {"url": "https://gymivorbereitung-zuerich.ch/kurzzeit/halbjahreskurs", "course_type": "kurzgymi"},
]


# HILFSFUNKTIONEN
def trigger_scraper() -> str:
    """Startet den Bright Data Scraper und gibt die Job-ID zurück."""
    print("  Starte Bright Data Gymivorbereitung Zürich Job...")
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


def wait_for_results(job_id: str, max_wait: int = 120) -> list:
    """Wartet bis der Job fertig ist und gibt die Ergebnisse zurück."""
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


def clean_availability(raw: str):
    """Bereinigt den availability_status — entfernt Link-Text aus BD-Output."""
    if not raw:
        return None
    cleaned = re.sub(r"\s*link=.*$", "", raw).strip().lower()
    if "ausgebucht" in cleaned:
        return "ausgebucht"
    if "wenige" in cleaned:
        return "wenige"
    if "frei" in cleaned or "plätze" in cleaned:
        return "viele"
    return None


def transform_courses(data: list) -> list:
    """Transformiert die Bright Data JSON-Daten in das Supabase-Format."""
    courses = []
    for result in data:
        url = result.get("input", {}).get("url", "")
        course_type = "langgymi" if "langzeit" in url else "kurzgymi"

        for course in result.get("courses", []):
            location = course.get("location") or ""
            courses.append({
                "provider_id":     PROVIDER_ID,
                "title":           f"{course.get('course_name', '')} | {course.get('weekday', '')}",
                "price_chf":       parse_price(course.get("price_chf")),
                "location":        location or None,
                "occurrence":      course.get("weekday") or None,
                "course_type":     course_type,
                "course_url":      url,
                "is_online":       location.lower() == "online",
                "verfuegbarkeit":  clean_availability(course.get("availability_status", "")),
                "start_date":      convert_date(course.get("start_date")),
                "end_date":        convert_date(course.get("end_date")),
                "last_scraped_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                "scraper_method":  SCRAPER_METHOD,
            })
    return courses


# MAIN
def main():
    print(f"Starte {PROVIDER_NAME} Scraper (Bright Data)...")

    if not BRIGHT_DATA_API_TOKEN or not COLLECTOR_ID:
        print("  ✗ BRIGHT_DATA_API_TOKEN oder BRIGHT_DATA_COLLECTOR_ID_GYMIZH fehlt in .env")
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

        # 4. Alte BD-Kurse löschen, neue speichern
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