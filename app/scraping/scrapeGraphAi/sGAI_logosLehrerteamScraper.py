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

PROVIDER_ID   = 10 
PROVIDER_NAME = "Logos Lehrerteam"
BASE_URL      = "https://www.logos-lehrerteam.ch"
ANMELDUNG_URL = f"{BASE_URL}/kurse-gymivorbereitung-zap-anmeldung"

KURSTYPEN = ["langgymi", "kurzgymi"]

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

PROMPT_METADATA = """
Du bist ein Datenextraktions-Assistent für eine Vergleichsplattform von Gymi-Vorbereitungskursen.
Analysiere diese Seite semantisch und beantworte folgende Fragen:

- aufsatzkorrektur: true wenn Aufsatztraining, Aufsatzkurs oder Schreibtraining erwähnt wird
- einstufungstest: true wenn Einstufungstest, Standortbestimmung, individuelle Beurteilung, Minimalnoten oder Aufnahmevoraussetzungen erwähnt werden
- e_learning: true wenn digitales Lehrmittel, E-Learning, Online-Plattform (z.B. edulo) oder digitaler Unterricht erwähnt wird
- pruefungsarchiv: true wenn Probeprüfungen, Simulationsprüfungen oder Prüfungstraining erwähnt wird
- beratungsgespraech: true wenn Beratung, Schulberatung, Kontakt oder persönliche Beratung angeboten wird
- lernunterlagen: true wenn Lehrmittel, Arbeitsheft, Kursmaterial oder Lernmaterial inbegriffen erwähnt wird
- pruefungssimulation: true wenn Simulationsprüfung oder simulierte Prüfung explizit erwähnt wird
- einzelkurse: true wenn Einzelunterricht, Privatunterricht oder Einzelkurse angeboten werden
- max_teilnehmer: maximale Gruppengrösse als Zahl (z.B. 6). Bei "maximal 6 Schüler:innen" → 6
- standorte: Liste aller Kursorte (z.B. ["Zürich-City", "Winterthur", "Uster"])

Antworte NUR mit reinem JSON: {"metadata": {...}}
"""

PROMPT_KURSDATEN = """
Du bist ein Datenextraktions-Assistent. Extrahiere alle Kursinformationen von dieser Seite.

Die Kurse sind in 3 Teile aufgeteilt (Teil 1, Teil 2, Teil 3) und finden an Mittwoch oder Samstag statt.
Es gibt auch Ferienkurse (Intensivkurse).

Für jeden Kursabschnitt gib zurück:
- kursabschnitt: "Teil 1", "Teil 2", "Teil 3", "Herbstferienkurs 1", "Herbstferienkurs 2", "Weihnachtsferienkurs" oder "Sportferienkurs"
- kurstyp_intern: "schulbegleitend" oder "ferienkurs"
- weekdays: Liste der Wochentage (z.B. ["Mittwoch", "Samstag"])
- start_date_mi: Startdatum Mittwochkurse im Format TT.MM.JJJJ
- end_date_mi: Enddatum Mittwochkurse im Format TT.MM.JJJJ
- start_date_sa: Startdatum Samstagkurse im Format TT.MM.JJJJ
- end_date_sa: Enddatum Samstagkurse im Format TT.MM.JJJJ
- dauer_wochen: Anzahl Wochen als Zahl (z.B. 6, 8, 5)

Kurszeiten (diese sind fix für alle Teile):
- Mittwoch Nachmittag: 13:30-15:10 und 15:30-17:10
- Samstag Vormittag: 8:30-10:10 und 10:30-12:10
- Samstag Nachmittag (nur ZH-City): 13:00-14:40 und 15:00-16:40

Antworte NUR mit reinem JSON: {"kurse": [...]}
"""

PROMPT_KOSTEN = """
Du bist ein Datenextraktions-Assistent. Extrahiere die Preisinformationen von dieser Seite.

Gib zurück:
- preis_gesamt: Gesamtpreis für alle 3 Teile bei Frühbuchung als Zahl in CHF (z.B. 2950)
- preis_regulaer: Regulärpreis ohne Rabatt als Zahl in CHF, falls erwähnt
- fruehbucher_rabatt_prozent: Frühbucherrabatt in Prozent als Zahl (z.B. 19)
- lehrmittel_inbegriffen: true wenn Lehrmittel im Preis inbegriffen

Antworte NUR mit reinem JSON: {"kosten": {...}}
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


def build_courses(kursdaten: dict, kosten: dict, metadata: dict) -> list:
    """Baut Kurs-Objekte aus den gescrapten Daten."""
    courses = []
    kurse = kursdaten.get("kurse", [])
    preis = kosten.get("kosten", {}).get("preis_gesamt")
    standorte = metadata.get("standorte", [])
    location = ", ".join(standorte) if standorte else "Zürich und Umgebung"

    for kurs in kurse:
        abschnitt     = kurs.get("kursabschnitt", "")
        kurstyp_int   = kurs.get("kurstyp_intern", "schulbegleitend")
        weekdays      = kurs.get("weekdays", [])
        dauer         = kurs.get("dauer_wochen")

        # Für schulbegleitende Kurse: je ein Eintrag pro Wochentag
        if kurstyp_int == "schulbegleitend":
            for wochentag in weekdays:
                if wochentag.lower() == "mittwoch":
                    start = convert_date(kurs.get("start_date_mi"))
                    end   = convert_date(kurs.get("end_date_mi"))
                    course_time = "13:30-15:10 / 15:30-17:10"
                else:
                    start = convert_date(kurs.get("start_date_sa"))
                    end   = convert_date(kurs.get("end_date_sa"))
                    course_time = "8:30-10:10 / 10:30-12:10"

                for kurstyp in KURSTYPEN:
                    title = f"Gymivorbereitung {abschnitt} | {wochentag}"
                    courses.append({
                        "provider_id":     PROVIDER_ID,
                        "title":           title,
                        "price_chf":       preis,
                        "location":        location,
                        "occurrence":      wochentag,
                        "course_time":     course_time,
                        "start_date":      start,
                        "end_date":        end,
                        "course_type":     kurstyp,
                        "course_url":      ANMELDUNG_URL,
                        "is_online":       False,
                        "verfuegbarkeit":  "viele",
                        "last_scraped_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                        "scraper_method":  "scrapegraphai",
                    })
        else:
            # Ferienkurs
            start = convert_date(kurs.get("start_date_mi") or kurs.get("start_date_sa"))
            end   = convert_date(kurs.get("end_date_mi") or kurs.get("end_date_sa"))
            for kurstyp in KURSTYPEN:
                title = f"Ferienkurs {abschnitt}"
                courses.append({
                    "provider_id":     PROVIDER_ID,
                    "title":           title,
                    "price_chf":       preis,
                    "location":        "Zürich-City",
                    "occurrence":      "Mo–Fr",
                    "course_time":     "Vormittag",
                    "start_date":      start,
                    "end_date":        end,
                    "course_type":     kurstyp,
                    "course_url":      ANMELDUNG_URL,
                    "is_online":       False,
                    "verfuegbarkeit":  "viele",
                    "last_scraped_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                    "scraper_method":  "scrapegraphai",
                })

    print(f"  -> {len(courses)} Kurs-Objekte generiert")
    return courses


def save_metadata(supabase, metadata: dict, kosten: dict) -> None:
    if not metadata:
        return

    max_t = metadata.get("max_teilnehmer")
    max_t_str = str(int(max_t)) if max_t and str(max_t).isdigit() else None
    standorte = metadata.get("standorte", [])
    standort_str = ", ".join(standorte) if standorte else "Zürich und Umgebung"

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
        "Eigene Lernunterlagen":                  bool(kosten.get("kosten", {}).get("lehrmittel_inbegriffen", False)),
        "Unterstuezung ausserhalb Unterrichtszeit": False,
        "info freien Plaetze?":                   False,
        "Standort":                               standort_str,
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


def main():
    print(f"Starte {PROVIDER_NAME} Scraper (ScrapeGraphAI + BFH LLM)...")
    start_time = time.time()

    if not test_bfh_connection():
        print("  Abbruch: BFH LLM nicht erreichbar.")
        return

    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

    # Schritt 1: Metadaten von Übersichtsseite
    print(f"\n  Schritt 1: Metadaten scrapen")
    metadata_result = scrape_page(f"{BASE_URL}/kurse-gymivorbereitung-zap-uebersicht", PROMPT_METADATA)
    metadata = metadata_result.get("metadata", {})
    print(f"  Metadaten: {json.dumps(metadata, ensure_ascii=False)}")
    time.sleep(2)

    # Schritt 2: Kursdaten
    print(f"\n  Schritt 2: Kursdaten scrapen")
    kursdaten_result = scrape_page(f"{BASE_URL}/kurse-gymivorbereitung-zap-kursdaten", PROMPT_KURSDATEN)
    time.sleep(2)

    # Schritt 3: Kosten
    print(f"\n  Schritt 3: Kosten scrapen")
    kosten_result = scrape_page(f"{BASE_URL}/kurse-gymivorbereitung-zap-kosten", PROMPT_KOSTEN)
    print(f"  Kosten: {json.dumps(kosten_result, ensure_ascii=False)}")
    time.sleep(2)

    # Kurse aufbauen
    print(f"\n  Kurse aufbauen...")
    courses = build_courses(kursdaten_result, kosten_result, metadata)

    print(f"\n  Gesamt: {len(courses)} Kurse")
    for c in courses[:5]:
        print(f"  {c['course_type']} | {c['title'][:55]} | {c['occurrence']} {c['course_time'] or ''} | {c['start_date']} | CHF {c['price_chf']}")
    if len(courses) > 5:
        print(f"  ... und {len(courses) - 5} weitere")

    save_metadata(supabase, metadata, kosten_result)
    save_courses(supabase, courses)

    elapsed = round(time.time() - start_time, 2)
    print(f"\n✓ {PROVIDER_NAME} abgeschlossen in {elapsed}s | {len(courses)} Kurse gespeichert")


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


if __name__ == "__main__":
    main()