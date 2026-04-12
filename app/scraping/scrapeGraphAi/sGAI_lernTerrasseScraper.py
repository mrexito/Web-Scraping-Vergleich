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

SUPABASE_URL  = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_KEY  = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
BFH_API_KEY   = os.getenv("BFH_LLM_API_KEY")

PROVIDER_ID   = 11
PROVIDER_NAME = "Lernterrasse"
LOCATION      = "Zürich Wollishofen"

URLS = [
    {
        "url":         "https://lernterrasse.ch/6-klasse-gymi-kurs/",
        "course_type": "langgymi",
        "course_url":  "https://lernterrasse.ch/6-klasse-gymi-kurs/",
        "stufe":       "6. Klasse",
    },
    {
        "url":         "https://lernterrasse.ch/5-klasse-progymi-kurs/",
        "course_type": "langgymi",
        "course_url":  "https://lernterrasse.ch/5-klasse-progymi-kurs/",
        "stufe":       "5. Klasse",
    },
    {
        "url":         "https://lernterrasse.ch/2-oder-3-sekundarstufe-gymi-kurs/",
        "course_type": "kurzgymi",
        "course_url":  "https://lernterrasse.ch/2-oder-3-sekundarstufe-gymi-kurs/",
        "stufe":       "2./3. Sek",
    },
    {
        "url":         "https://lernterrasse.ch/1-oder-2-sekundarstufe-progymi-kurs/",
        "course_type": "kurzgymi",
        "course_url":  "https://lernterrasse.ch/1-oder-2-sekundarstufe-progymi-kurs/",
        "stufe":       "1./2. Sek",
    },
]

llm_instance = ChatOpenAI(
    model="gpt-oss:120b",
    api_key=BFH_API_KEY,
    base_url="https://inference.mlmp.ti.bfh.ch/api/v1",
)

graph_config = {
    "llm": {
        "model_instance": llm_instance,
        "model_tokens": 32000,
    },
    "verbose": True,
    "headless": True,
}

PROMPT = """
Du bist ein Datenextraktions-Assistent. Extrahiere alle Kurszeilen aus den Tabellen auf dieser Webseite.

Jede Tabelle hat Spalten wie: Kurs, Stufe, Kurstag, Beginn am, Preis (Fr.), Anmeldung.

Für jeden Kurs (jede Tabellenzeile) gib zurück:
- course_name: Name und Zeitraum des Kurses (z.B. "Kurs A August-Februar", "Kurs B Oktober-Dezember")
- stufe: Schulstufe aus der Tabelle (z.B. "6. Klasse", "2./3. Sekundarstufe")
- weekday: Nur der Wochentag (z.B. "Mittwoch", "Samstag", "Di & Do")
- course_time: Nur die Uhrzeit (z.B. "14:00-16:55", "8:30-11:25", "17:00-18:20")
- start_date: Startdatum im Format TT.MM.JJJJ (z.B. "19.08.2026")
- end_date: Enddatum des Kursabschnitts im Format TT.MM.JJJJ falls erkennbar, sonst null
- price_chf: Preis in CHF als Zahl (z.B. 4080, 1365, 1755, 1180)
- availability: "ausgebucht" wenn AUSGEBUCHT steht, sonst "viele"
- kursabschnitt: Welcher Abschnitt (z.B. "Teil I-III", "Teil I", "Teil II", "Teil III")

Gib ausserdem einmalig Anbieter-Metadaten aus dem gesamten Seitentext zurück:
- aufsatzkorrektur: true wenn Aufsatztraining erwähnt wird
- einstufungstest: true wenn Einstufungstest oder Standortbestimmung erwähnt wird, sonst false
- e_learning: true wenn Online-Kurs oder E-Learning erwähnt wird
- pruefungsarchiv: true wenn Simulationsprüfung oder Probeprüfungen erwähnt werden
- beratungsgespraech: true wenn Beratungsgespräch oder Beratung erwähnt wird
- lernunterlagen: true wenn Lernmittel oder Kursmaterial inbegriffen erwähnt wird
- pruefungssimulation: true wenn Simulationsprüfung erwähnt wird
- max_teilnehmer: maximale Gruppengrösse als Zahl (z.B. 8), falls genannt

Antworte NUR mit reinem JSON ohne Markdown. Format: {"courses": [...], "metadata": {...}}
"""


def clean_availability(raw: str) -> str | None:
    if not raw:
        return "viele"
    s = raw.strip().lower()
    if "ausgebucht" in s:
        return "ausgebucht"
    if "wenige" in s:
        return "wenige"
    return "viele"


def parse_price(raw) -> int | None:
    if raw is None:
        return None
    match = re.search(r"\d{3,5}", str(raw).replace("'", "").replace(" ", ""))
    return int(match.group()) if match else None


def convert_date(raw) -> str | None:
    if not raw:
        return None
    m = re.match(r"(\d{1,2})\.(\d{1,2})\.(\d{4})", str(raw).strip())
    if m:
        return f"{m.group(3)}-{m.group(2).zfill(2)}-{m.group(1).zfill(2)}"
    return None


def test_bfh_connection() -> bool:
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
        print(f"  ✓ BFH LLM erreichbar: {response.choices[0].message.content.strip()}")
        return True
    except Exception as e:
        print(f"  ✗ BFH LLM Verbindungsfehler: {e}")
        return False


def scrape_page(entry: dict) -> dict:
    print(f"\n  Scrapt: {entry['url']} ({entry['course_type']}, {entry['stufe']})")
    scraper = SmartScraperGraph(
        prompt=PROMPT,
        source=entry["url"],
        config=graph_config,
    )
    result = scraper.run()

    if isinstance(result, str):
        cleaned = result.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
        try:
            result = json.loads(cleaned)
        except json.JSONDecodeError as e:
            print(f"  Warnung: JSON-Parsing fehlgeschlagen: {e}")
            print(f"  Rohtext (erste 300 Zeichen): {result[:300]}")
            return {}

    return result if isinstance(result, dict) else {}


def transform_courses(result: dict, entry: dict) -> list:
    courses = []
    raw_courses = result.get("courses", [])
    if not raw_courses:
        print("  Warnung: Keine Kurse im Resultat.")
        return courses

    for course in raw_courses:
        name          = (course.get("course_name") or "").strip()
        stufe         = (course.get("stufe") or entry["stufe"]).strip()
        weekday       = (course.get("weekday") or "").strip()
        course_time   = (course.get("course_time") or "").strip()
        kursabschnitt = (course.get("kursabschnitt") or "").strip()

        title_parts = [p for p in [name, stufe, kursabschnitt] if p]
        title = " | ".join(title_parts) or "Kurs"

        courses.append({
            "provider_id":     PROVIDER_ID,
            "title":           title,
            "price_chf":       parse_price(course.get("price_chf")),
            "location":        LOCATION,
            "occurrence":      weekday or None,
            "course_time":     course_time or None,
            "start_date":      convert_date(course.get("start_date")),
            "end_date":        convert_date(course.get("end_date")),
            "course_type":     entry["course_type"],
            "course_url":      entry["course_url"],
            "is_online":       False,
            "verfuegbarkeit":  clean_availability(course.get("availability")),
            "last_scraped_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "scraper_method":  "scrapegraphai",
        })

    print(f"  -> {len(courses)} Kurs(e) transformiert")
    return courses


def save_metadata(supabase, metadata: dict) -> None:
    if not metadata:
        print("  Keine Metadaten — überspringe.")
        return

    max_teilnehmer = metadata.get("max_teilnehmer")

    supabase.table("GymiProviders").update({
        "E-Learning":                     bool(metadata.get("e_learning", False)),
        "Aufsatzkorrektur":               bool(metadata.get("aufsatzkorrektur", False)),
        "Einstufungstest":                bool(metadata.get("einstufungstest", False)),
        "Einzelkurse":                    False,
        "Onlinepruefung":                 False,
        "Pruefungssimultaion":            bool(metadata.get("pruefungssimulation", False)),
        "Maximale Anzahl der Teilnehmer": str(int(max_teilnehmer)) if max_teilnehmer else None,
    }).eq("ID", PROVIDER_ID).execute()
    print("  ✓ GymiProviders aktualisiert")

    supabase.table("CourseDetails").update({
        "Pruefungsarchiv":                        bool(metadata.get("pruefungsarchiv", False)),
        "Beratungsgespraech":                     bool(metadata.get("beratungsgespraech", False)),
        "Eigene Lernunterlagen":                  bool(metadata.get("lernunterlagen", False)),
        "Unterstuezung ausserhalb Unterrichtszeit": False,
        "info freien Plaetze?":                   False,
        "Standort":                               LOCATION,
        "Kursart (Intensiv- oder Langzeitkurs)":  "Beides",
        "Qualitaetsbewertung":                    None,
    }).eq("ID", PROVIDER_ID).execute()
    print("  ✓ CourseDetails aktualisiert")


def save_courses(supabase, courses: list) -> None:
    supabase.table("courses").delete()\
        .eq("provider_id", PROVIDER_ID)\
        .eq("scraper_method", "scrapegraphai")\
        .execute()
    print("  Alte Kurse gelöscht.")

    if not courses:
        print("  Keine Kurse zum Speichern.")
        return

    supabase.table("courses").insert(courses).execute()
    print(f"  ✓ {len(courses)} Kurs(e) gespeichert")

    for course_type in ["langgymi", "kurzgymi"]:
        typed = [c for c in courses if c["course_type"] == course_type
                 and c["price_chf"] is not None and c["price_chf"] >= 3000]
        if typed:
            avg = round(sum(c["price_chf"] for c in typed) / len(typed))
            supabase.table("price_history").insert({
                "provider_id": PROVIDER_ID,
                "course_type": course_type,
                "price_chf":   avg,
                "recorded_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            }).execute()
            print(f"  ✓ price_history: {course_type} | CHF {avg}")


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
            result = scrape_page(entry)

            if not last_metadata and result.get("metadata"):
                last_metadata = result["metadata"]
                print(f"  Metadaten: {json.dumps(last_metadata, ensure_ascii=False)}")

            courses = transform_courses(result, entry)
            all_courses.extend(courses)
            time.sleep(2)

        except Exception as e:
            print(f"  Fehler bei {entry['url']}: {e}")

    # Duplikate entfernen
    seen = set()
    unique = []
    for c in all_courses:
        key = (c["title"], c["start_date"], c["course_type"])
        if key not in seen:
            seen.add(key)
            unique.append(c)

    print(f"\n  {len(all_courses)} Kurse → {len(unique)} nach Deduplizierung")

    save_metadata(supabase, last_metadata)
    save_courses(supabase, unique)

    elapsed = round(time.time() - start_time, 2)
    print(f"\n✓ {PROVIDER_NAME} abgeschlossen in {elapsed}s | {len(unique)} Kurse gespeichert")

    for c in unique[:5]:
        print(f"  {c['course_type']} | {c['title'][:50]} | {c['occurrence']} {c['course_time']} | {c['start_date']} | CHF {c['price_chf']} | {c['verfuegbarkeit']}")
    if len(unique) > 5:
        print(f"  ... und {len(unique) - 5} weitere")


if __name__ == "__main__":
    main()