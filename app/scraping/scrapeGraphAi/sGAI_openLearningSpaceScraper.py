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

PROVIDER_ID   = 8  # "Open Learning Space" in GymiProviders + CourseDetails
PROVIDER_NAME = "Open Learning Space"
BASE_URL      = "https://www.ols-zuerich.ch"
ANMELDUNG_URL = f"{BASE_URL}/anmeldeformular-gymikurse/"

URLS = [
    {
        "url":     f"{BASE_URL}/vorbereitungskurse-aufnahmepruefung-gymnasium/",
        "purpose": "overview",  # Metadaten + alle Kurse
    },
    {
        "url":     f"{BASE_URL}/vorbereitungskurs-primar/",
        "purpose": "langgymi",  # Langgymi Kursdetails
    },
    {
        "url":     f"{BASE_URL}/vorbereitungskurs-sek/",
        "purpose": "kurzgymi",  # Kurzgymi Kursdetails
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
        "model_tokens":   32000,
    },
    "verbose": True,
    "headless": True,
}

PROMPT_OVERVIEW = """
Du bist ein Datenextraktions-Assistent für eine Vergleichsplattform von Gymi-Vorbereitungskursen.

Extrahiere ALLE Kurse (Langzeit- und Kurzzeitgymnasium) von dieser Seite.
Für jeden Kurs gib zurück:
- course_type: "langgymi" oder "kurzgymi"
- weekday: Wochentag auf Deutsch (z.B. "Mittwoch", "Samstag")
- course_time: Kurszeit (z.B. "14:00-16:45", "09:00-11:45")
- start_date: Startdatum im Format TT.MM.JJJJ
- end_date: Enddatum im Format TT.MM.JJJJ
- price_chf: Preis als Zahl (z.B. 2690)
- location: Kursort (z.B. "Seefeld oder Wiedikon")
- max_teilnehmer: maximale Teilnehmerzahl als Zahl

Extrahiere zusätzlich Anbieter-Metadaten:
- aufsatzkorrektur: true wenn Aufsatzkorrektur oder Aufsätze korrigiert werden
- einstufungstest: true wenn Einstufungstest, Standortbestimmung oder individuelle Beurteilung erwähnt wird
- e_learning: true wenn Online-Unterricht oder E-Learning erwähnt wird
- pruefungsarchiv: true wenn alte Prüfungen oder Originalprüfungen verwendet werden
- beratungsgespraech: true wenn Beratung oder persönliche Vorstellung angeboten wird
- lernunterlagen: true wenn Kursordner oder Lernmaterial inbegriffen ist
- pruefungssimulation: true wenn Simulationsprüfungen durchgeführt werden
- einzelkurse: true wenn Einzelunterricht angeboten wird
- max_teilnehmer: maximale Gruppengrösse als Zahl
- standorte: Liste der Kursstandorte

Antworte NUR mit reinem JSON: {"courses": [...], "metadata": {...}}
"""

PROMPT_KURSSEITE = """
Du bist ein Datenextraktions-Assistent. Extrahiere alle Kurse von dieser Seite.

Für jeden Kurs gib zurück:
- course_type: "langgymi" oder "kurzgymi" (aus dem Seiteninhalt ableiten)
- weekday: Wochentag auf Deutsch (z.B. "Mittwoch", "Samstag")
- course_time: Kurszeit (z.B. "14:00-16:45")
- start_date: Startdatum im Format TT.MM.JJJJ
- end_date: Enddatum im Format TT.MM.JJJJ
- price_chf: Preis als Zahl (z.B. 2690)
- location: Kursort (z.B. "Seefeld oder Wiedikon")
- max_teilnehmer: maximale Teilnehmerzahl als Zahl
- availability: "ausgebucht" wenn ausgebucht, sonst "viele"

Extrahiere zusätzlich Metadaten:
- aufsatzkorrektur: true wenn Aufsätze korrigiert werden oder Aufsatztraining erwähnt wird
- lernunterlagen: true wenn Kursordner, Lernmaterial oder Unterlagen inbegriffen sind
- pruefungsarchiv: true wenn alte Prüfungen oder Originalprüfungen verwendet werden
- pruefungssimulation: true wenn Simulationsprüfungen durchgeführt werden
- einzelkurse: true wenn Einzelunterricht angeboten wird
- einstufungstest: true wenn Standortbestimmung oder Zwischenprüfungen erwähnt werden
- beratungsgespraech: true wenn Beratung angeboten wird

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
    m = re.match(r"(\d{1,2})\.(\d{1,2})\.(\d{2,4})", str(raw).strip())
    if m:
        year = m.group(3)
        if len(year) == 2:
            year = "20" + year
        return f"{year}-{m.group(2).zfill(2)}-{m.group(1).zfill(2)}"
    return None


def parse_price(raw) -> int | None:
    if raw is None:
        return None
    try:
        return int(str(raw).replace("'", "").replace(" ", "").replace(",", "").replace(".-", "").strip())
    except (ValueError, TypeError):
        m = re.search(r"\d{3,5}", str(raw).replace("'", ""))
        return int(m.group()) if m else None


def merge_metadata(base: dict, extra: dict) -> dict:
    result = dict(base)
    for key, val in extra.items():
        if key not in result:
            result[key] = val
        elif isinstance(val, bool) and val:
            result[key] = True
        elif key == "max_teilnehmer" and val is not None:
            try:
                existing = int(str(result.get(key, 0) or 0))
                new = int(str(val))
                result[key] = max(existing, new)
            except (ValueError, TypeError):
                if result.get(key) is None:
                    result[key] = val
    return result


def transform_courses(raw_courses: list, fallback_type: str = "langgymi") -> list:
    if not raw_courses:
        return []

    transformed = []
    for c in raw_courses:
        course_type_raw = (c.get("course_type") or fallback_type).lower()
        if "kurz" in course_type_raw:
            course_type = "kurzgymi"
        else:
            course_type = "langgymi"

        weekday = (c.get("weekday") or "").strip()
        course_time = (c.get("course_time") or "").strip()
        title = f"Vorbereitungskurs | {weekday} {course_time}".strip(" |")

        transformed.append({
            "provider_id":     PROVIDER_ID,
            "title":           title,
            "price_chf":       parse_price(c.get("price_chf")),
            "location":        (c.get("location") or "Zürich Seefeld / Wiedikon").strip(),
            "occurrence":      weekday or None,
            "course_time":     course_time or None,
            "start_date":      convert_date(c.get("start_date")),
            "end_date":        convert_date(c.get("end_date")),
            "course_type":     course_type,
            "course_url":      ANMELDUNG_URL,
            "is_online":       False,
            "verfuegbarkeit":  "ausgebucht" if "ausgebucht" in str(c.get("availability", "")).lower() else "viele",
            "last_scraped_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "scraper_method":  "scrapegraphai",
        })

    return transformed


def deduplicate_courses(courses: list) -> list:
    """Entfernt doppelte Kurse (gleicher Typ, Wochentag, Zeit, Startdatum)."""
    seen = set()
    unique = []
    for c in courses:
        key = (c["course_type"], c["occurrence"], c["course_time"], c["start_date"])
        if key not in seen:
            seen.add(key)
            unique.append(c)
    return unique


def save_metadata(supabase, metadata: dict) -> None:
    if not metadata:
        print("  Keine Metadaten — überspringe.")
        return

    max_t = metadata.get("max_teilnehmer")
    max_t_str = str(int(max_t)) if max_t and str(max_t).isdigit() else None
    standorte = metadata.get("standorte", [])
    standort_str = ", ".join(standorte) if standorte else "Zürich Seefeld / Wiedikon"

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
        "Standort":                                 standort_str,
        "Kursart (Intensiv- oder Langzeitkurs)":    "Lang",
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
    all_courses = []
    metadata = {}

    # Schritt 1: Übersichtsseite — Metadaten + alle Kurse
    print(f"\n  Schritt 1: Übersichtsseite (Metadaten + alle Kurse)")
    overview_result = scrape_page(URLS[0]["url"], PROMPT_OVERVIEW)
    metadata = overview_result.get("metadata", {})
    print(f"  Metadaten: {json.dumps(metadata, ensure_ascii=False)}")
    overview_courses = transform_courses(overview_result.get("courses", []))
    all_courses.extend(overview_courses)
    print(f"  -> {len(overview_courses)} Kurse von Übersichtsseite")
    time.sleep(2)

    # Schritt 2: Langgymi-Seite
    print(f"\n  Schritt 2: Langgymi-Unterseite")
    langgymi_result = scrape_page(URLS[1]["url"], PROMPT_KURSSEITE)
    langgymi_meta = langgymi_result.get("metadata", {})
    if langgymi_meta:
        metadata = merge_metadata(metadata, langgymi_meta)
    langgymi_courses = transform_courses(langgymi_result.get("courses", []), fallback_type="langgymi")
    all_courses.extend(langgymi_courses)
    print(f"  -> {len(langgymi_courses)} Kurse von Langgymi-Seite")
    time.sleep(2)

    # Schritt 3: Kurzgymi-Seite
    print(f"\n  Schritt 3: Kurzgymi-Unterseite")
    kurzgymi_result = scrape_page(URLS[2]["url"], PROMPT_KURSSEITE)
    kurzgymi_meta = kurzgymi_result.get("metadata", {})
    if kurzgymi_meta:
        metadata = merge_metadata(metadata, kurzgymi_meta)
    kurzgymi_courses = transform_courses(kurzgymi_result.get("courses", []), fallback_type="kurzgymi")
    all_courses.extend(kurzgymi_courses)
    print(f"  -> {len(kurzgymi_courses)} Kurse von Kurzgymi-Seite")

    # Deduplizieren
    all_courses = deduplicate_courses(all_courses)
    print(f"\n  Gesamt nach Deduplizierung: {len(all_courses)} Kurse")
    for c in all_courses:
        print(f"  ✓ {c['course_type']} | {c['occurrence']} {c['course_time']} | {c['start_date']} | CHF {c['price_chf']}")

    save_metadata(supabase, metadata)
    save_courses(supabase, all_courses)

    elapsed = round(time.time() - start_time, 2)
    print(f"\n✓ {PROVIDER_NAME} abgeschlossen in {elapsed}s | {len(all_courses)} Kurse gespeichert")


if __name__ == "__main__":
    main()