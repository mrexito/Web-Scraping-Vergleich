import requests
import time
import re
import os
from supabase import create_client
from dotenv import load_dotenv

load_dotenv()

# Konfiguration
BRIGHT_DATA_API_TOKEN = os.getenv("BRIGHT_DATA_API_TOKEN")
COLLECTOR_ID = os.getenv("BRIGHT_DATA_COLLECTOR_ID_GYMIZH")
SUPABASE_URL = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

PROVIDER_ID = 1

URLS = [
    {"url": "https://gymivorbereitung-zuerich.ch/langzeit/halbjahreskurs",  "course_type": "langgymi"},
    {"url": "https://gymivorbereitung-zuerich.ch/kurzzeit/halbjahreskurs", "course_type": "kurzgymi"},
]


def trigger_scraper() -> str:
    """Startet den Bright Data Scraper und gibt die Job-ID zurück."""
    print("Starte Bright Data Gymivorbereitung Zürich Scraper...")
    response = requests.post(
        f"https://api.brightdata.com/dca/trigger?collector={COLLECTOR_ID}&queue_next=1",
        headers={
            "Authorization": f"Bearer {BRIGHT_DATA_API_TOKEN}",
            "Content-Type": "application/json",
        },
        json=[{"url": entry["url"]} for entry in URLS],
    )
    response.raise_for_status()
    job_id = response.json().get("collection_id")
    print(f"Job gestartet: {job_id}")
    return job_id


def wait_for_results(job_id: str, max_wait: int = 120) -> list:
    """Wartet bis der Job fertig ist und gibt die Ergebnisse zurück."""
    print("Warte auf Ergebnisse...")
    elapsed = 0
    while elapsed < max_wait:
        time.sleep(10)
        elapsed += 10
        response = requests.get(
            f"https://api.brightdata.com/dca/dataset?id={job_id}&format=json",
            headers={"Authorization": f"Bearer {BRIGHT_DATA_API_TOKEN}"},
        )
        if response.status_code == 200:
            data = response.json()
            if data:
                print(f"Ergebnisse erhalten nach {elapsed}s")
                return data
        print(f"  Noch nicht fertig... ({elapsed}s)")
    raise TimeoutError("Scraper hat nach 120s keine Ergebnisse geliefert.")


def clean_availability(raw: str) -> str | None:
    """Bereinigt den availability_status — entfernt Link-Text."""
    if not raw:
        return None
    cleaned = re.sub(r'\s*link=.*$', '', raw).strip().lower()
    if 'ausgebucht' in cleaned:
        return 'ausgebucht'
    elif 'wenige' in cleaned:
        return 'wenige'
    elif 'frei' in cleaned or 'plätze' in cleaned:
        return 'viele'
    return None


def parse_price(raw: str) -> int | None:
    """Extrahiert die Zahl aus z.B. '3290 CHF'."""
    if not raw:
        return None
    match = re.search(r'\d+', raw.replace("'", "").replace(" ", ""))
    return int(match.group()) if match else None


def convert_date_py(raw: str) -> str | None:
    """Konvertiert '29.08.2026' → '2026-08-29'."""
    if not raw:
        return None
    parts = raw.strip().split('.')
    if len(parts) != 3:
        return None
    return f"{parts[2]}-{parts[1].zfill(2)}-{parts[0].zfill(2)}"


def transform_courses(data: list) -> list:
    """Transformiert die Bright Data JSON-Daten in das Supabase-Format."""
    courses = []
    for result in data:
        url = result.get("input", {}).get("url", "")
        course_type = "langgymi" if "langzeit" in url else "kurzgymi"

        for course in result.get("courses", []):
            courses.append({
                "provider_id":     PROVIDER_ID,
                "title":           f"{course.get('course_name', '')} | {course.get('weekday', '')}",
                "price_chf":       parse_price(course.get("price_chf")),
                "location":        course.get("location"),
                "occurrence":      course.get("weekday"),
                "course_type":     course_type,
                "course_url":      url,
                "is_online":       course.get("location", "").lower() == "online",
                "verfuegbarkeit":  clean_availability(course.get("availability_status", "")),
                "start_date":      convert_date_py(course.get("start_date")),
                "end_date":        convert_date_py(course.get("end_date")),
                "last_scraped_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                "scraper_method":  "brightdata",
            })
    return courses


def save_to_supabase(courses: list) -> None:
    """Löscht alte Kurse und speichert neue in Supabase."""
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

    # Nur eigene Kurse löschen (nicht die von anderen Scrapern)
    supabase.table("courses").delete()\
        .eq("provider_id", PROVIDER_ID)\
        .eq("scraper_method", "brightdata")\
        .execute()
    print("Alte Kurse gelöscht.")

    # Neue Kurse einfügen
    supabase.table("courses").insert(courses).execute()
    print(f"✓ {len(courses)} Kurse gespeichert")

    # Preisverlauf speichern
    for course_type in ["langgymi", "kurzgymi"]:
        typed = [c for c in courses if c["course_type"] == course_type and c["price_chf"]]
        if typed:
            avg_price = round(sum(c["price_chf"] for c in typed) / len(typed))
            supabase.table("price_history").insert({
                "provider_id": PROVIDER_ID,
                "course_type": course_type,
                "price_chf":   avg_price,
                "recorded_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            }).execute()
            print(f"✓ price_history: Provider {PROVIDER_ID} | {course_type} | CHF {avg_price}")


def main():
    try:
        job_id = trigger_scraper()
        raw_data = wait_for_results(job_id)
        courses = transform_courses(raw_data)
        print(f"  {len(courses)} Kurse transformiert")
        save_to_supabase(courses)
        print("\nBright Data Gymivorbereitung Zürich Scraping abgeschlossen!")

    except Exception as e:
        print(f"Fehler: {e}")


if __name__ == "__main__":
    main()