import os
import re
import json
import time
from openai import OpenAI
from langchain_openai import ChatOpenAI
from dotenv import load_dotenv
from supabase import create_client
from scrapegraphai.graphs import SmartScraperGraph

load_dotenv("../../../.env")

# Konfiguration
SUPABASE_URL = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
BFH_API_KEY  = os.getenv("BFH_LLM_API_KEY")

PROVIDER_ID   = 3
PROVIDER_NAME = "Avidii"

URLS = [
    {
        "url": "https://avidii.ch/gymivorbereitung-langzeitgymnasium",
        "course_type": "langgymi",
        "course_url": "https://avidii.ch/gymivorbereitung-langzeitgymnasium",
    },
    {
        "url": "https://avidii.ch/gymivorbereitung-kurzzeitgymnasium",
        "course_type": "kurzgymi",
        "course_url": "https://avidii.ch/gymivorbereitung-kurzzeitgymnasium",
    },
]

# LangChain Instanz für BFH LLM
llm_instance = ChatOpenAI(
    model="gpt-oss:120b",
    api_key=BFH_API_KEY,
    base_url="https://inference.mlmp.ti.bfh.ch/api/v1",
)

# ScrapeGraphAI Konfiguration
graph_config = {
    "llm": {
        "model_instance": llm_instance,
        "model_tokens": 32000,
    },
    "verbose": True,
    "headless": True,
}

PROMPT = """
Du bist ein Datenextraktions-Assistent. Extrahiere alle Kurszeilen aus dieser Webseite.

Für jeden Kurs gib folgende Felder zurück:
- course_name: Name des Kurses (z.B. "Gruppenkurs Mittwoch", "Einzelkurs")
- weekday: Wochentag und Uhrzeit (z.B. "Mittwoch, 14:00-17:30")
- location: Kursort (z.B. "Zürich", "Online")
- start_date: Startdatum im Format TT.MM.JJJJ (z.B. "27.08.2025")
- end_date: Enddatum im Format TT.MM.JJJJ falls vorhanden (z.B. "15.04.2026")
- price_chf: Gruppenpreis in CHF als Zahl (z.B. 2950). Nur Gruppenpreise, keine Einzelstundenpreise.
- availability: Verfügbarkeitsstatus (z.B. "Freie Plätze", "Wenige Plätze", "Ausgebucht")
- is_online: true wenn Kurs online stattfindet, sonst false

Gib auch folgende Anbieter-Metadaten zurück:
- aufsatzkorrektur: true wenn Aufsatztraining oder Aufsatzkorrektur erwähnt wird, sonst false
- einstufungstest: true wenn Standortbestimmung oder Einstufungstest erwähnt wird, sonst false
- e_learning: true wenn Lerncockpit, Google Classroom oder E-Learning erwähnt wird, sonst false
- pruefungsarchiv: true wenn alte Prüfungen oder Prüfungstraining erwähnt wird, sonst false
- beratungsgespraech: true wenn Erstgespräch oder Beratungsgespräch erwähnt wird, sonst false
- lernunterlagen: true wenn Kursmaterial oder Lernmaterial erwähnt wird, sonst false

Antworte NUR mit einem JSON-Objekt mit den Feldern "courses" (Liste) und "metadata" (Objekt).
"""


# Hilfsfunktionen
def clean_availability(raw: str) -> str | None:
    if not raw:
        return None
    cleaned = raw.strip().lower()
    if "ausgebucht" in cleaned:
        return "ausgebucht"
    elif "wenige" in cleaned:
        return "wenige"
    elif "frei" in cleaned or "plätze" in cleaned or "verfügbar" in cleaned:
        return "viele"
    return None


def parse_price(raw) -> int | None:
    if raw is None:
        return None
    match = re.search(r"\d{3,5}", str(raw).replace("'", "").replace(" ", ""))
    return int(match.group()) if match else None


def convert_date(raw: str) -> str | None:
    """Konvertiert '27.08.2025' → '2025-08-27'."""
    if not raw:
        return None
    parts = raw.strip().split(".")
    if len(parts) != 3:
        return None
    return f"{parts[2]}-{parts[1].zfill(2)}-{parts[0].zfill(2)}"


def test_bfh_connection() -> bool:
    """Testet ob die BFH LLM API erreichbar ist."""
    print("  Teste BFH LLM Verbindung...")
    try:
        client = OpenAI(
            base_url="https://inference.mlmp.ti.bfh.ch/api/v1",
            api_key=BFH_API_KEY,
        )
        response = client.chat.completions.create(
            model="gpt-oss:120b",
            messages=[{"role": "user", "content": "Antworte nur mit: OK"}],
        )
        answer = response.choices[0].message.content.strip()
        print(f"  ✓ BFH LLM erreichbar: {answer}")
        return True
    except Exception as e:
        print(f"  ✗ BFH LLM Verbindungsfehler: {e}")
        return False


# ScrapeGraphAI: Seite scrapen
def scrape_courses(entry: dict) -> dict:
    """Scrapt die Seite mit ScrapeGraphAI + BFH LLM."""
    print(f"\n  ScrapeGraphAI scrapt: {entry['url']} ({entry['course_type']})")

    scraper = SmartScraperGraph(
        prompt=PROMPT,
        source=entry["url"],
        config=graph_config,
    )

    result = scraper.run()
    print(f"  -> Resultat erhalten: {type(result)}")

    if isinstance(result, str):
        try:
            result = json.loads(result.strip().strip("```json").strip("```"))
        except json.JSONDecodeError as e:
            print(f"  Warnung: JSON-Parsing fehlgeschlagen: {e}")
            return {}

    return result if isinstance(result, dict) else {}


def transform_courses(result: dict, entry: dict) -> list:
    """Transformiert das geparste Resultat ins Supabase-Format."""
    courses = []

    raw_courses = result.get("courses", [])
    if not raw_courses:
        print(f"  Warnung: Keine Kurse im Resultat gefunden.")
        return courses

    for course in raw_courses:
        weekday  = course.get("weekday") or ""
        name     = course.get("course_name") or ""
        location = course.get("location") or ""

        is_online = course.get("is_online", False)
        if isinstance(is_online, str):
            is_online = is_online.lower() == "true"
        if "online" in location.lower():
            is_online = True

        is_einzelkurs = "einzel" in name.lower()
        price_raw = parse_price(course.get("price_chf"))

        if price_raw is not None:
            print(f"  ✓ Preis gefunden: CHF {price_raw}")

        final_price = None if is_einzelkurs else price_raw

        courses.append({
            "provider_id":     PROVIDER_ID,
            "title":           f"{name} | {weekday}".strip(" |"),
            "price_chf":       final_price,
            "location":        location or None,
            "occurrence":      weekday or None,
            "start_date":      convert_date(course.get("start_date") or ""),
            "end_date":        convert_date(course.get("end_date") or ""),
            "course_type":     entry["course_type"],
            "course_url":      entry["course_url"],
            "is_online":       is_online,
            "verfuegbarkeit":  clean_availability(course.get("availability") or ""),
            "last_scraped_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "scraper_method":  "scrapegraphai",
        })

    print(f"  -> {len(courses)} Kurs(e) transformiert")
    return courses


def save_metadata(supabase, metadata: dict) -> None:
    """Aktualisiert GymiProviders und CourseDetails mit Metadaten."""
    if not metadata:
        return

    supabase.table("GymiProviders").update({
        "Aufsatzkorrektur": metadata.get("aufsatzkorrektur", False),
        "Einstufungstest":  metadata.get("einstufungstest", False),
        "E-Learning":       metadata.get("e_learning", False),
    }).eq("ID", PROVIDER_ID).execute()
    print("  ✓ GymiProviders Metadaten aktualisiert")

    supabase.table("CourseDetails").update({
        "Pruefungsarchiv":       metadata.get("pruefungsarchiv", False),
        "Beratungsgespraech":    metadata.get("beratungsgespraech", False),
        "Eigene Lernunterlagen": metadata.get("lernunterlagen", False),
    }).eq("ID", PROVIDER_ID).execute()
    print("  ✓ CourseDetails Metadaten aktualisiert")


def save_to_supabase(supabase, courses: list) -> None:
    """Löscht nur eigene Kurse und speichert neue in Supabase."""
    supabase.table("courses").delete()\
        .eq("provider_id", PROVIDER_ID)\
        .eq("scraper_method", "scrapegraphai")\
        .execute()
    print("  Alte Kurse gelöscht.")

    if courses:
        supabase.table("courses").insert(courses).execute()
        print(f"  ✓ {len(courses)} Kurs(e) gespeichert")

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
                print(f"  ✓ price_history: {course_type} | CHF {avg_price}")


# Main
def main():
    print(f"Starte {PROVIDER_NAME} Scraper (ScrapeGraphAI + BFH LLM)...")
    start_time = time.time()

    if not test_bfh_connection():
        print("  Abbruch: BFH LLM nicht erreichbar. VPN aktiv? API-Key korrekt?")
        return

    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

    all_courses   = []
    last_metadata = {}

    for entry in URLS:
        try:
            result = scrape_courses(entry)

            if not last_metadata:
                last_metadata = result.get("metadata", {})

            courses = transform_courses(result, entry)
            all_courses.extend(courses)

        except Exception as e:
            print(f"  Fehler beim Scraping von {entry['url']}: {e}")

    save_metadata(supabase, last_metadata)
    save_to_supabase(supabase, all_courses)

    elapsed = round(time.time() - start_time, 2)
    print(f"\n✓ {PROVIDER_NAME} Scraping abgeschlossen in {elapsed}s")
    print(f"  Gesamt: {len(all_courses)} Kurse")


if __name__ == "__main__":
    main()