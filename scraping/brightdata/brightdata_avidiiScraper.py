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
PROVIDER_ID    = 3
PROVIDER_NAME  = "Avidii"

BRIGHT_DATA_API_TOKEN = os.getenv("BRIGHT_DATA_API_TOKEN")
COLLECTOR_ID          = os.getenv("BRIGHT_DATA_COLLECTOR_ID_AVIDII")

URLS = [
    {"url": "https://avidii.ch/gymivorbereitung-langzeitgymnasium",  "course_type": "langgymi"},
    {"url": "https://avidii.ch/gymivorbereitung-kurzzeitgymnasium", "course_type": "kurzgymi"},
]

# Fallback-Preise von Avidii (wenn Bright Data den Preis nicht extrahiert)
FALLBACK_PRICES = {
    "langgymi": 2950,
    "kurzgymi": 3650,
}


# HILFSFUNKTIONEN
def trigger_scraper() -> str:
    """Startet den Bright Data Scraper und gibt die Job-ID zurück."""
    print("  Starte Bright Data Avidii Job...")
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
    if not raw:
        return None
    raw_lower = raw.lower()
    if "ausgebucht" in raw_lower:
        return "ausgebucht"
    if "wenige" in raw_lower:
        return "wenige"
    if "frei" in raw_lower or "plätze" in raw_lower:
        return "viele"
    return None


def transform_courses(data: list) -> list:
    """Transformiert die Bright Data JSON-Daten in das Supabase-Format."""
    courses = []

    for result in data:
        url = result.get("input", {}).get("url", "")
        course_type = "langgymi" if "langzeit" in url else "kurzgymi"

        # Preis aus Bright Data oder Fallback
        price_data = result.get("price", {})
        price_value = price_data.get("value") if price_data else None

        if price_value is None:
            price_value = FALLBACK_PRICES[course_type]
            print(f"    ⚠ Fallback-Preis verwendet ({course_type}): CHF {price_value}")

        course_name  = result.get("course_name", "")
        location     = result.get("location", "")
        weekday      = result.get("weekday", "")
        time_str     = result.get("time", "")
        availability = result.get("availability_status", "")

        is_einzelkurs = "einzel" in course_name.lower()
        final_price = None if is_einzelkurs else price_value

        title = (
            f"Gymivorbereitung "
            f"{'Langzeitgymnasium' if course_type == 'langgymi' else 'Kurzzeitgymnasium'}"
            f" | {course_name} | {weekday}"
        )

        courses.append({
            "provider_id":     PROVIDER_ID,
            "title":           title,
            "price_chf":       final_price,
            "location":        location or None,
            "occurrence":      f"{weekday}, {time_str}" if weekday and time_str else (weekday or None),
            "course_type":     course_type,
            "course_url":      url,
            "is_online":       False,
            "verfuegbarkeit":  clean_availability(availability),
            "start_date":      convert_date(result.get("start_date")),
            "end_date":        convert_date(result.get("end_date")),
            "last_scraped_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "scraper_method":  SCRAPER_METHOD,
        })

    return courses


# MAIN
def main():
    print(f"Starte {PROVIDER_NAME} Scraper (Bright Data)...")

    if not BRIGHT_DATA_API_TOKEN or not COLLECTOR_ID:
        print("  ✗ BRIGHT_DATA_API_TOKEN oder BRIGHT_DATA_COLLECTOR_ID_AVIDII fehlt in .env")
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