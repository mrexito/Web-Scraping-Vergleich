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

PROVIDER_ID   = 12 
PROVIDER_NAME = "LearningCube"
LOCATION      = "Meilen"
BASE_URL      = "https://www.learningcube.ch"

# Übersichtsseite und Kurs-URLs
OVERVIEW_URL = f"{BASE_URL}/gymivorbereitung/"

KNOWN_URLS = [
    {
        "url":         f"{BASE_URL}/courses/gymivorbereitung-deutsch-langgymi/",
        "course_type": "langgymi",
        "course_url":  f"{BASE_URL}/courses/gymivorbereitung-deutsch-langgymi/",
    },
    {
        "url":         f"{BASE_URL}/courses/gymivorbereitung-deutsch-kurzgymi/",
        "course_type": "kurzgymi",
        "course_url":  f"{BASE_URL}/courses/gymivorbereitung-deutsch-kurzgymi/",
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

PROMPT_OVERVIEW = """
Du bist ein Datenextraktions-Assistent.
Extrahiere Anbieter-Metadaten von dieser Gymivorbereitung-Übersichtsseite.
Interpretiere die Texte semantisch — es müssen nicht die exakten Begriffe vorkommen.

Gib zurück:
- aufsatzkorrektur: true wenn Aufsatztraining, Aufsatzkorrektur oder Schreibtraining erwähnt wird
- einstufungstest: true wenn Einstufungstest, Standortbestimmung, individuelle Beurteilung, Schwächen aufarbeiten, Lernstand ermitteln oder ähnliches erwähnt wird
- e_learning: true wenn Online-Kurs, E-Learning, digitale Lernmittel oder Distance Learning erwähnt wird
- pruefungsarchiv: true wenn alte Prüfungen, Prüfungsarchiv, Probeprüfungen, Prüfungssimulation, Simulationsprüfung oder Prüfungstraining erwähnt wird
- beratungsgespraech: true wenn Beratungsgespräch, Erstgespräch, Kontaktgespräch oder persönliche Beratung erwähnt wird
- lernunterlagen: true wenn Lernmaterial, Kursmaterial, Lehrmittel, Lehrwerk oder Unterlagen inbegriffen erwähnt wird
- pruefungssimulation: true wenn Simulationsprüfung, Probeprüfung, Prüfungssimulation oder Prüfungstraining erwähnt wird
- einzelkurse: true wenn Einzelunterricht, Privatunterricht oder Einzelkurse angeboten werden
- max_teilnehmer: maximale Gruppengrösse als Zahl (z.B. 3), falls genannt — null wenn nicht erwähnt
- standort: Kursort falls erwähnt (z.B. "Meilen")

Antworte NUR mit reinem JSON: {"metadata": {...}}
"""

PROMPT_COURSE = """
Du bist ein Datenextraktions-Assistent. Extrahiere ALLE Kursinformationen von dieser Kursseite.
Es können mehrere Kurstermine auf einer Seite sein (z.B. Mittwoch und Samstag).

Für jeden Kurs/Termin gib zurück:
- course_name: Name des Kurses (z.B. "Gymivorbereitung Langzeit-Gymi Mittwoch")
- course_type: "langgymi" oder "kurzgymi" (aus dem Seiteninhalt ableiten)
- weekday: Wochentag auf Deutsch (z.B. "Mittwoch", "Samstag")
- course_time: Kurszeit (z.B. "17:30-19:30")
- start_date: Startdatum im Format TT.MM.JJJJ
- end_date: Enddatum im Format TT.MM.JJJJ
- location: Kursort (z.B. "Meilen")
- price_chf: Preis in CHF als Zahl (z.B. 3200, 4500)
- max_teilnehmer: Maximale Teilnehmerzahl als Zahl (z.B. 3)
- availability: "ausgebucht" wenn ausgebucht, sonst "viele"

Gib ausserdem einmalig Anbieter-Metadaten zurück:
- aufsatzkorrektur: true wenn Aufsatztraining, Aufsatzkorrektur oder Schreibtraining erwähnt wird
- einstufungstest: true wenn Einstufungstest, individuelle Beurteilung, Schwächen aufarbeiten oder Lernstand ermitteln erwähnt wird
- e_learning: true wenn Online-Kurs, E-Learning oder digitale Lernmittel erwähnt wird
- pruefungsarchiv: true wenn alte Prüfungen, Probeprüfungen, Prüfungssimulation oder Prüfungstraining erwähnt wird
- beratungsgespraech: true wenn Beratungsgespräch, Erstgespräch oder persönliche Beratung erwähnt wird
- lernunterlagen: true wenn Lernmaterial, Kursmaterial, Lehrmittel oder Lehrwerk erwähnt wird
- pruefungssimulation: true wenn Simulationsprüfung, Probeprüfung oder Prüfungstraining erwähnt wird

Antworte NUR mit reinem JSON: {"courses": [{...}, {...}], "metadata": {...}}
"""


def clean_availability(raw: str) -> str | None:
    if not raw:
        return "viele"
    s = raw.strip().lower()
    if "ausgebucht" in s or "sold out" in s or "full" in s:
        return "ausgebucht"
    if "wenige" in s or "few" in s:
        return "wenige"
    return "viele"


def parse_price(raw) -> int | None:
    if raw is None:
        return None
    match = re.search(r"\d{3,5}", str(raw).replace("'", "").replace(" ", "").replace(",", ""))
    return int(match.group()) if match else None


def convert_date(raw) -> str | None:
    if not raw:
        return None
    raw = str(raw).strip()
    # TT.MM.JJJJ
    m = re.match(r"(\d{1,2})\.(\d{1,2})\.(\d{4})", raw)
    if m:
        return f"{m.group(3)}-{m.group(2).zfill(2)}-{m.group(1).zfill(2)}"
    # JJJJ-MM-TT
    m2 = re.match(r"(\d{4})-(\d{2})-(\d{2})", raw)
    if m2:
        return raw
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


def extract_json_from_string(raw: str) -> dict:
    """Extrahiert JSON aus einem String, auch wenn er Präfixe wie <|channel|> enthält."""
    # Suche nach dem ersten { und letzten }
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
        # ScrapeGraphAI wirft manchmal Exception obwohl JSON im Error-Text steckt
        error_str = str(e)
        print(f"  Warnung: ScrapeGraphAI Exception: {error_str[:100]}")
        extracted = extract_json_from_string(error_str)
        if extracted:
            print(f"  JSON aus Exception extrahiert: {json.dumps(extracted, ensure_ascii=False)[:200]}")
            return extracted
        return {}

    if isinstance(result, str):
        extracted = extract_json_from_string(result)
        if extracted:
            return extracted
        print(f"  Warnung: JSON-Parsing fehlgeschlagen. Rohtext: {result[:200]}")
        return {}

    return result if isinstance(result, dict) else {}


def discover_course_urls() -> list[dict]:
    """Gibt die bekannten Kurs-URLs zurück. Versucht zusätzlich die Übersichtsseite für Metadaten."""
    print(f"\n  Verwende bekannte Kurs-URLs ({len(KNOWN_URLS)})")
    for e in KNOWN_URLS:
        print(f"  -> {e['course_type']}: {e['url']}")
    return KNOWN_URLS


def transform_courses(result: dict, entry: dict) -> list:
    raw_courses = result.get("courses", [])
    
    if not raw_courses and result.get("course"):
        raw_courses = [result["course"]]

    if not raw_courses:
        print("  Warnung: Keine Kurse im Resultat.")
        return []

    transformed = []
    for course_data in raw_courses:
        name        = (course_data.get("course_name") or "Gymivorbereitung").strip()
        weekday     = (course_data.get("weekday") or "").strip()
        course_time = (course_data.get("course_time") or "").strip()
        location    = (course_data.get("location") or LOCATION).strip()
        ct          = course_data.get("course_type") or entry.get("course_type", "langgymi")

        if "kurz" in ct.lower():
            course_type = "kurzgymi"
        else:
            course_type = "langgymi"

        title = f"{name} | {weekday}".strip(" |") if weekday else name

        transformed.append({
            "provider_id":     PROVIDER_ID,
            "title":           title,
            "price_chf":       parse_price(course_data.get("price_chf")),
            "location":        location,
            "occurrence":      weekday or None,
            "course_time":     course_time or None,
            "start_date":      convert_date(course_data.get("start_date")),
            "end_date":        convert_date(course_data.get("end_date")),
            "course_type":     course_type,
            "course_url":      entry["course_url"],
            "is_online":       False,
            "verfuegbarkeit":  clean_availability(course_data.get("availability")),
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
    max_t_str = str(int(max_t)) if max_t and str(max_t).strip().isdigit() else None

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
        typed = [c for c in courses if c["course_type"] == course_type and c["price_chf"] is not None]
        if typed:
            avg = round(sum(c["price_chf"] for c in typed) / len(typed))
            supabase.table("price_history").insert({
                "provider_id": PROVIDER_ID,
                "course_type": course_type,
                "price_chf":   avg,
                "recorded_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            }).execute()
            print(f"  ✓ price_history: {course_type} | CHF {avg}")


def merge_metadata(base: dict, extra: dict) -> dict:
    """Mergt zwei Metadaten-Dicts — bei booleans gewinnt true, bei max_teilnehmer die höchste Zahl."""
    result = dict(base)
    for key, val in extra.items():
        if key not in result:
            result[key] = val
        elif isinstance(val, bool) and val:
            result[key] = True  # true gewinnt immer
        elif key == "max_teilnehmer" and val is not None:
            existing = result.get(key)
            try:
                existing_int = int(str(existing)) if existing else 0
                new_int = int(str(val))
                result[key] = max(existing_int, new_int)
            except (ValueError, TypeError):
                if result.get(key) is None:
                    result[key] = val
    return result


def main():
    print(f"Starte {PROVIDER_NAME} Scraper (ScrapeGraphAI + BFH LLM)...")
    start_time = time.time()

    if not test_bfh_connection():
        print("  Abbruch: BFH LLM nicht erreichbar.")
        return

    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

    # 1. Hauptseite scrapen für Metadaten
    print(f"\n  Schritt 1: Metadaten von Hauptseite ({OVERVIEW_URL})")
    last_metadata = {}
    try:
        overview_result = scrape_page(OVERVIEW_URL, PROMPT_OVERVIEW)
        last_metadata = overview_result.get("metadata", {})
        if last_metadata:
            print(f"  ✓ Metadaten Hauptseite: {json.dumps(last_metadata, ensure_ascii=False)}")
        else:
            print("  Warnung: Keine Metadaten auf Hauptseite gefunden.")
        time.sleep(2)
    except Exception as e:
        print(f"  Fehler beim Scrapen der Hauptseite: {e}")

    # 2. Kursseiten scrapen — Metadaten von allen Seiten mergen
    print(f"\n  Schritt 2: Kursseiten scrapen")
    entries = discover_course_urls()
    all_courses = []

    for entry in entries:
        try:
            result = scrape_page(entry["url"], PROMPT_COURSE)

            # Metadaten von Kursseite in Gesamt-Metadaten mergen
            course_meta = result.get("metadata", {})
            if course_meta:
                last_metadata = merge_metadata(last_metadata, course_meta)
                print(f"  Metadaten nach Merge: {json.dumps(last_metadata, ensure_ascii=False)}")

            # max_teilnehmer direkt aus Kursdaten holen
            course_max = result.get("courses", [{}])[0].get("max_teilnehmer") if result.get("courses") else None
            if course_max is not None:
                try:
                    last_metadata = merge_metadata(last_metadata, {"max_teilnehmer": int(str(course_max))})
                    print(f"  max_teilnehmer von Kursseite: {last_metadata.get('max_teilnehmer')}")
                except (ValueError, TypeError):
                    pass

            courses = transform_courses(result, entry)
            all_courses.extend(courses)

            for c in courses:
                print(f"  ✓ {c['course_type']} | {c['title'][:50]} | {c['occurrence']} {c['course_time']} | {c['start_date']} | CHF {c['price_chf']}")

            time.sleep(2)

        except Exception as e:
            print(f"  Fehler bei {entry['url']}: {e}")

    print(f"\n  Gesamt: {len(all_courses)} Kurse")

    save_metadata(supabase, last_metadata)
    save_courses(supabase, all_courses)

    elapsed = round(time.time() - start_time, 2)
    print(f"\n✓ {PROVIDER_NAME} abgeschlossen in {elapsed}s | {len(all_courses)} Kurse gespeichert")


if __name__ == "__main__":
    main()