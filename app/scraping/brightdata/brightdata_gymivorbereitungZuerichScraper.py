import requests
import time
import re
import os
from supabase import create_client

# KONFIGURATION — hier deine Keys eintragen
BRIGHT_DATA_API_TOKEN = "e528d843-2cd5-4e10-b012-451c6fac02a8"  
COLLECTOR_ID = "c_mnbxlqtt1hmzxtsf4g"
SUPABASE_URL = "https://huxheggwzhfswlqsacag.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1eGhlZ2d3emhmc3dscXNhY2FnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjIxNjY0MSwiZXhwIjoyMDg3NzkyNjQxfQ.EojZO40Z_1RFhx2CZoNarSGzMu_kW2v9yniJUKdidWM"

PROVIDER_ID = 13  # Gymivorbereitung Zürich

URLS = [
    {"url": "https://gymivorbereitung-zuerich.ch/langzeit/halbjahreskurs",  "course_type": "langgymi"},
    {"url": "https://gymivorbereitung-zuerich.ch/kurzzeit/halbjahreskurs", "course_type": "kurzgymi"},
]


def trigger_scraper() -> str:
    """Startet den Bright Data Scraper und gibt die Job-ID zurück."""
    print("Starte Bright Data Scraper...")
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


def convert_date(raw: str) -> str | None:
    """Konvertiert '29.08.2026' → '2026-08-29'."""
    if not raw:
        return None
    parts = raw.strip().split('.')
    if len(parts) != 3:
        return None
    return f"{parts[2]}-{parts[1].padStart(2, '0')}-{parts[0].padStart(2, '0')}"


def convert_date_py(raw: str) -> str | None:
    """Konvertiert '29.08.2026' → '2026-08-29' (Python-Version)."""
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
        # Kurstyp aus der URL ableiten
        url = result.get("input", {}).get("url", "")
        course_type = "langgymi" if "langzeit" in url else "kurzgymi"

        for course in result.get("courses", []):
            courses.append({
                "provider_id": PROVIDER_ID,
                "title": f"{course.get('course_name', '')} | {course.get('weekday', '')}",
                "price_chf": parse_price(course.get("price_chf")),
                "location": course.get("location"),
                "occurrence": course.get("weekday"),
                "course_type": course_type,
                "course_url": url,
                "is_online": course.get("location", "").lower() == "online",
                "verfuegbarkeit": clean_availability(course.get("availability_status", "")),
                "start_date": convert_date_py(course.get("start_date")),
                "end_date": convert_date_py(course.get("end_date")),
                "last_scraped_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            })
    return courses


def save_to_supabase(courses: list) -> None:
    """Löscht alte Kurse und speichert neue in Supabase."""
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

    # Alte Kurse löschen
    supabase.table("courses").delete().eq("provider_id", PROVIDER_ID).execute()
    print(f"Alte Kurse gelöscht.")

    # Neue Kurse einfügen
    result = supabase.table("courses").insert(courses).execute()
    print(f"✓ {len(courses)} Kurse gespeichert")

    # Preisverlauf speichern
    for course_type in ["langgymi", "kurzgymi"]:
        typed = [c for c in courses if c["course_type"] == course_type and c["price_chf"]]
        if typed:
            avg_price = round(sum(c["price_chf"] for c in typed) / len(typed))
            supabase.table("price_history").insert({
                "provider_id": PROVIDER_ID,
                "course_type": course_type,
                "price_chf": avg_price,
                "recorded_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            }).execute()
            print(f"✓ price_history: Provider {PROVIDER_ID} | {course_type} | CHF {avg_price}")


def main():
    try:
        # Scraper starten
        job_id = trigger_scraper()

        # Warten bis Daten bereit sind
        raw_data = wait_for_results(job_id)

        # Daten transformieren
        courses = transform_courses(raw_data)
        print(f"  {len(courses)} Kurse transformiert")

        # In Supabase speichern
        save_to_supabase(courses)

        print("\nBright Data Scraping abgeschlossen!")

    except Exception as e:
        print(f"Fehler: {e}")


if __name__ == "__main__":
    main()