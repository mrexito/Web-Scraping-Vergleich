import requests
import time
import re
import os
from supabase import create_client

# KONFIGURATION — hier deine Keys eintragen
BRIGHT_DATA_API_TOKEN = "e528d843-2cd5-4e10-b012-451c6fac02a8"
COLLECTOR_ID = "c_mnc5bs391jflo7pyot"
SUPABASE_URL = "https://huxheggwzhfswlqsacag.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1eGhlZ2d3emhmc3dscXNhY2FnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjIxNjY0MSwiZXhwIjoyMDg3NzkyNjQxfQ.EojZO40Z_1RFhx2CZoNarSGzMu_kW2v9yniJUKdidWM"

PROVIDER_ID = 14  # Avidii

URLS = [
    {"url": "https://avidii.ch/gymivorbereitung-langzeitgymnasium",  "course_type": "langgymi"},
    {"url": "https://avidii.ch/gymivorbereitung-kurzzeitgymnasium", "course_type": "kurzgymi"},
]

# Bekannte Fallback-Preise von Avidii
FALLBACK_PRICES = {
    "langgymi": 2950,
    "kurzgymi": 3650,
}


def trigger_scraper() -> str:
    """Startet den Bright Data Scraper und gibt die Job-ID zurück."""
    print("Starte Bright Data Avidii Scraper...")
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
    """Normalisiert den Verfügbarkeitsstatus."""
    if not raw:
        return None
    raw_lower = raw.lower()
    if 'ausgebucht' in raw_lower:
        return 'ausgebucht'
    elif 'wenige' in raw_lower:
        return 'wenige'
    elif 'frei' in raw_lower or 'plätze' in raw_lower:
        return 'viele'
    return None


def convert_date_py(raw: str) -> str | None:
    """Konvertiert ISO-Datum oder None."""
    if not raw:
        return None
    if 'T' in raw:
        return raw[:10]
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

        # Fallback: bekannte Preise von Avidii
        if price_value is None:
            price_value = FALLBACK_PRICES[course_type]
            print(f"  Fallback-Preis verwendet für {course_type}: CHF {price_value}")

        # Start- und Enddatum
        start_date = convert_date_py(result.get("start_date"))
        end_date = convert_date_py(result.get("end_date"))

        # Kursname aus Bright Data
        course_name = result.get("course_name", "")
        location = result.get("location", "")
        weekday = result.get("weekday", "")
        time_str = result.get("time", "")
        availability = result.get("availability_status", "")

        # Einzelkurs bekommt keinen Gruppenpreis
        is_einzelkurs = "einzel" in course_name.lower()
        final_price = None if is_einzelkurs else price_value

        courses.append({
            "provider_id": PROVIDER_ID,
            "title": f"Gymivorbereitung {'Langzeitgymnasium' if course_type == 'langgymi' else 'Kurzzeitgymnasium'} | {course_name} | {weekday}",
            "price_chf": final_price,
            "location": location,
            "occurrence": f"{weekday}, {time_str}" if weekday and time_str else weekday,
            "course_type": course_type,
            "course_url": url,
            "is_online": False,
            "verfuegbarkeit": clean_availability(availability),
            "start_date": start_date,
            "end_date": end_date,
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

        print("\nAvidii Bright Data Scraping abgeschlossen!")

    except Exception as e:
        print(f"Fehler: {e}")


if __name__ == "__main__":
    main()