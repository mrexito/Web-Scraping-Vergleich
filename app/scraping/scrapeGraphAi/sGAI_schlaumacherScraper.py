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

PROVIDER_ID   = 9 
PROVIDER_NAME = "Schlaumacher"
BASE_URL      = "https://www.schlaumacher.ch"
OVERVIEW_URL  = f"{BASE_URL}/gymivorbereitung-zuerich/"

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

PROMPT_OVERVIEW = """
Du bist ein Datenextraktions-Assistent für eine Vergleichsplattform von Gymi-Vorbereitungskursen.

Extrahiere ALLE Kurse von dieser Seite. Für jeden Kurs gib zurück:
- title: Kursname (z.B. "Langzeitgymnasium: Vorbereitung Start September: Mittwoch")
- course_type: "langgymi" oder "kurzgymi"
- weekday: Wochentag(e) auf Deutsch (z.B. "Mittwoch", "Samstag", "Montag–Freitag")
- course_time: Kurszeit (z.B. "13:30-16:30")
- start_date: Startdatum im Format TT.MM.JJJJ
- end_date: Enddatum im Format TT.MM.JJJJ
- price_chf: Gesamtpreis als Zahl (z.B. 2940, 980)
- location: Kursort (z.B. "Schifflände 26, 8001 Zürich")
- course_url: URL des Kurses falls vorhanden
- availability: "ausgebucht" wenn ausgebucht, sonst "viele"

Extrahiere ausserdem Anbieter-Metadaten:
- aufsatzkorrektur: true wenn Aufsatzschreiben oder Aufsatztraining erwähnt wird
- einstufungstest: true wenn Einstufungstest oder Standortbestimmung erwähnt wird
- e_learning: true wenn Online-Unterricht oder E-Learning erwähnt wird
- pruefungsarchiv: true wenn Prüfungsarchiv oder alte Prüfungen erwähnt werden
- beratungsgespraech: true wenn Beratungsgespräch oder Erstgespräch angeboten wird
- lernunterlagen: true wenn Kursunterlagen oder Lernmaterial inbegriffen sind
- pruefungssimulation: true wenn Prüfungssimulation oder Simulationsprüfung erwähnt wird
- einzelkurse: true wenn Einzelkurse oder Einzelunterricht angeboten werden
- max_teilnehmer: maximale Teilnehmerzahl als Zahl (z.B. 8)
- standort: Kursort (z.B. "Schifflände 26, 8001 Zürich")

Antworte NUR mit reinem JSON: {"courses": [...], "metadata": {...}}
"""


def extract_json_from_string(raw: str) -> dict:
    start = raw.find('{')
    end = raw.rfind('}')
    if start != -1 and end != -1 and end > start:
        try:
            return json.loads(raw[start:end+1])
        except json.JSONDecodeError:
            pass
    return {}


def scrape_page(url: str, prompt: str) -> dict:
    print(f"\n  Scrapt: {url}")
    try:
        scraper = SmartScraperGraph(
            prompt=prompt,
            source=url,
            config=graph_config,
        )
        result = scraper.run()
    except Exception as e:
        error_str = str(e)
        print(f"  Warnung: Exception: {error_str[:120]}")
        extracted = extract_json_from_string(error_str)
        if extracted:
            print(f"  JSON aus Exception extrahiert.")
            return extracted
        return {}

    if isinstance(result, str):
        extracted = extract_json_from_string(result)
        if extracted:
            return extracted
        print(f"  Warnung: JSON-Parsing fehlgeschlagen. Rohtext: {result[:200]}")
        return {}

    return result if isinstance(result, dict) else {}


def convert_date(raw) -> str | None:
    if not raw:
        return None
    m = re.match(r"(\d{1,2})\.(\d{1,2})\.(\d{4})", str(raw).strip())
    if m:
        return f"{m.group(3)}-{m.group(2).zfill(2)}-{m.group(1).zfill(2)}"
    return None


def parse_price(raw) -> int | None:
    if raw is None:
        return None
    try:
        return int(str(raw).replace("'", "").replace(" ", "").replace(",", "").strip())
    except (ValueError, TypeError):
        m = re.search(r"\d{3,5}", str(raw).replace("'", ""))
        return int(m.group()) if m else None


def transform_courses(result: dict) -> list:
    raw_courses = result.get("courses", [])
    if not raw_courses:
        print("  Warnung: Keine Kurse im Resultat.")
        return []

    transformed = []
    for c in raw_courses:
        course_type_raw = (c.get("course_type") or "").lower()
        if "kurz" in course_type_raw:
            course_type = "kurzgymi"
        else:
            course_type = "langgymi"

        transformed.append({
            "provider_id":     PROVIDER_ID,
            "title":           (c.get("title") or "Gymivorbereitung").strip(),
            "price_chf":       parse_price(c.get("price_chf")),
            "location":        (c.get("location") or "Zürich").strip(),
            "occurrence":      (c.get("weekday") or "").strip() or None,
            "course_time":     (c.get("course_time") or "").strip() or None,
            "start_date":      convert_date(c.get("start_date")),
            "end_date":        convert_date(c.get("end_date")),
            "course_type":     course_type,
            "course_url":      c.get("course_url") or OVERVIEW_URL,
            "is_online":       False,
            "verfuegbarkeit":  "ausgebucht" if "ausgebucht" in str(c.get("availability", "")).lower() else "viele",
            "last_scraped_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "scraper_method":  "scrapegraphai",
        })

    print(f"  -> {len(transformed)} Kurs(e) transformiert")
    return transformed


def save_metadata(supabase, metadata: dict) -> None:
    if not metadata:
        print("  Keine Metadaten — überspringe.")
        return

    max_t = metadata.get("max_teilnehmer")
    max_t_str = str(int(max_t)) if max_t and str(max_t).isdigit() else None
    standort = metadata.get("standort") or "Zürich"

    supabase.table("GymiProviders").update({
        "E-Learning":                     bool(metadata.get("e_learning", False)),
        "Aufsatzkorrektur":               bool(metadata.get("aufsatzkorrektur", False)),
        "Einstufungstest":                bool(metadata.get("einstufungstest", False)),
        "Einzelkurse":                    bool(metadata.get("einzelkurse", False)),
        "Onlinepruefung":                 False,
        "Pruefungssimultaion":            bool(metadata.get("pruefungssimulation", False)),
        "Maximale Anzahl der Teilnehmer": max_t_str,
    }).eq("ID", PROVIDER_ID).execute()
    print("  ✓ GymiProviders aktualisiert")

    supabase.table("CourseDetails").update({
        "Pruefungsarchiv":                          bool(metadata.get("pruefungsarchiv", False)),
        "Beratungsgespraech":                       bool(metadata.get("beratungsgespraech", False)),
        "Eigene Lernunterlagen":                    bool(metadata.get("lernunterlagen", False)),
        "Unterstuezung ausserhalb Unterrichtszeit": False,
        "info freien Plaetze?":                     False,
        "Standort":                                 standort,
        "Kursart (Intensiv- oder Langzeitkurs)":    "Beides",
        "Qualitaetsbewertung":                      None,
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
        typed = [c for c in courses if c["course_type"] == course_type and c["price_chf"]]
        if typed:
            avg = round(sum(c["price_chf"] for c in typed) / len(typed))
            supabase.table("price_history").insert({
                "provider_id": PROVIDER_ID,
                "course_type": course_type,
                "price_chf":   avg,
                "recorded_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            }).execute()
            print(f"  ✓ price_history: {course_type} | CHF {avg}")


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


def main():
    print(f"Starte {PROVIDER_NAME} Scraper (ScrapeGraphAI + BFH LLM)...")
    start_time = time.time()

    if not test_bfh_connection():
        print("  Abbruch: BFH LLM nicht erreichbar.")
        return

    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

    # Alles von der Hauptseite scrapen — Kurse + Metadaten in einem Request
    print(f"\n  Scrapt Hauptseite: {OVERVIEW_URL}")
    result = scrape_page(OVERVIEW_URL, PROMPT_OVERVIEW)

    metadata = result.get("metadata", {})
    print(f"  Metadaten: {json.dumps(metadata, ensure_ascii=False)}")

    courses = transform_courses(result)

    print(f"\n  Gesamt: {len(courses)} Kurse")
    for c in courses:
        print(f"  ✓ {c['course_type']} | {c['title'][:55]} | {c['occurrence']} {c['course_time'] or ''} | {c['start_date']} | CHF {c['price_chf']}")

    save_metadata(supabase, metadata)
    save_courses(supabase, courses)

    elapsed = round(time.time() - start_time, 2)
    print(f"\n✓ {PROVIDER_NAME} abgeschlossen in {elapsed}s | {len(courses)} Kurse gespeichert")


if __name__ == "__main__":
    main()