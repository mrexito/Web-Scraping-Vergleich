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

PROVIDER_ID        = 6
PROVIDER_NAME      = "Nachhilfe Akademie"
BASE_URL           = "https://nachhilfeakademie.ch"
OVERVIEW_URL       = f"{BASE_URL}/gymivorbereitung-kanton-zuerich/"
PREISE_LANG_URL    = f"{BASE_URL}/preise-gymivorbereitung-langgymnasium/"
PREISE_KURZ_URL    = f"{BASE_URL}/preise-gymivorbereitung-kurzgymnasium/"
ANMELDUNG_LANG_URL = f"{BASE_URL}/anmeldung-langzeitgymnasium/"
ANMELDUNG_KURZ_URL = f"{BASE_URL}/anmeldung-kurzgymnasium/"

llm_instance = ChatOpenAI(
    model="gpt-oss:120b",
    api_key=BFH_API_KEY,
    base_url="https://inference.mlmp.ti.bfh.ch/api/v1",
)

graph_config = {
    "llm": {"model_instance": llm_instance, "model_tokens": 32000},
    "verbose": True,
    "headless": True,
}

PROMPT_OVERVIEW = """
Du bist ein Datenextraktions-Assistent für eine Vergleichsplattform von Gymi-Vorbereitungskursen.

Extrahiere ALLE Kurse (Langzeit- und Kurzzeitgymnasium, schulbegleitend und Ferienkurse) aus der Übersichtstabelle auf dieser Seite.
Für jeden Kurs gib zurück:
- course_type: "langgymi" oder "kurzgymi" (LG = langgymi, KG = kurzgymi)
- title: Kurzname des Kurses (z.B. "Gymivorbereitung Mittwoch", "Intensivkurs Herbstferien 1")
- weekday: Wochentag auf Deutsch (z.B. "Mittwoch", "Samstag", "Montag-Freitag")
- course_time: Kurszeit (z.B. "14:00-17:15")
- start_date: Startdatum im Format TT.MM.JJJJ
- end_date: Enddatum im Format TT.MM.JJJJ (leer lassen wenn nicht vorhanden)
- location: Kursort (z.B. "Zürich Oerlikon", "Winterthur")
- kursart: "schulbegleitend" oder "ferienkurs"
- availability: "viele"

Extrahiere zusätzlich Anbieter-Metadaten:
- aufsatzkorrektur: true wenn Aufsatztraining oder Aufsatzkorrektur erwähnt wird
- einstufungstest: true wenn Einstufungstest oder Online-Test angeboten wird
- e_learning: true wenn Online-Unterricht oder Hybrid-Unterricht erwähnt wird
- pruefungsarchiv: true wenn alte Prüfungen oder externe Prüfungslinks vorhanden sind
- beratungsgespraech: true wenn Beratungsgespräch angeboten wird
- lernunterlagen: true wenn Kursmaterial oder Lehrmittel inbegriffen oder käuflich erhältlich sind
- pruefungssimulation: true wenn Simulationsprüfung erwähnt wird
- einzelkurse: true wenn Einzelunterricht angeboten wird
- max_teilnehmer: maximale Gruppengrösse als Zahl (z.B. 4)
- standorte: Liste aller Standorte

Antworte NUR mit reinem JSON: {"courses": [...], "metadata": {...}}
"""

PROMPT_PREISE_LANG = """
Du bist ein Datenextraktions-Assistent. Extrahiere die Preise für Gymivorbereitungskurse Langgymnasium.

Gib zurück:
- preis_4er_gruppe_gesamt: Gesamtpreis für 4er-Gruppe (Deutsch + Mathe, wöchentlich) als Zahl in CHF
- preis_2er_gruppe_gesamt: Gesamtpreis für 2er-Gruppe als Zahl in CHF
- preis_privat_gesamt: Gesamtpreis für Einzelunterricht als Zahl in CHF
- preis_ferienkurs_gruppe: Preis Intensivkurs/Ferienkurs Gruppe als Zahl in CHF
- preis_ferienkurs_privat: Preis Intensivkurs/Ferienkurs Privat als Zahl in CHF
- anmeldegebuehr: Anmeldegebühr als Zahl in CHF

Antworte NUR mit reinem JSON: {"preise": {...}}
"""

PROMPT_PREISE_KURZ = """
Du bist ein Datenextraktions-Assistent. Extrahiere die Preise für Gymivorbereitungskurse Kurzgymnasium.

Gib zurück:
- preis_4er_gruppe_gesamt: Gesamtpreis für 4er-Gruppe (Deutsch + Mathe, wöchentlich) als Zahl in CHF
- preis_2er_gruppe_gesamt: Gesamtpreis für 2er-Gruppe als Zahl in CHF
- preis_privat_gesamt: Gesamtpreis für Einzelunterricht als Zahl in CHF
- preis_ferienkurs_gruppe: Preis Intensivkurs/Ferienkurs Gruppe als Zahl in CHF
- preis_ferienkurs_privat: Preis Intensivkurs/Ferienkurs Privat als Zahl in CHF
- anmeldegebuehr: Anmeldegebühr als Zahl in CHF

Antworte NUR mit reinem JSON: {"preise": {...}}
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
        scraper = SmartScraperGraph(prompt=prompt, source=url, config=graph_config)
        result = scraper.run()
    except Exception as e:
        error_str = str(e)
        print(f"  Warnung: {error_str[:120]}")
        extracted = extract_json_from_string(error_str)
        return extracted if extracted else {}
    if isinstance(result, str):
        return extract_json_from_string(result)
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


def transform_courses(raw_courses: list, preise_lang: dict, preise_kurz: dict) -> list:
    if not raw_courses:
        return []
    transformed = []
    for c in raw_courses:
        course_type_raw = (c.get("course_type") or "langgymi").lower()
        course_type = "kurzgymi" if "kurz" in course_type_raw else "langgymi"
        kursart = (c.get("kursart") or "schulbegleitend").lower()
        is_ferienkurs = "ferienkurs" in kursart or "intensiv" in kursart

        # Preis: 4er-Gruppe als Standardpreis, Ferienkurs separat
        if course_type == "langgymi":
            p = preise_lang
            anmeldung_url = ANMELDUNG_LANG_URL
        else:
            p = preise_kurz
            anmeldung_url = ANMELDUNG_KURZ_URL

        if is_ferienkurs:
            price = parse_price(p.get("preis_ferienkurs_gruppe"))
        else:
            price = parse_price(p.get("preis_4er_gruppe_gesamt"))

        weekday = (c.get("weekday") or "").strip()
        course_time = (c.get("course_time") or "").strip()
        title = (c.get("title") or f"Gymivorbereitung | {weekday}").strip()
        location = (c.get("location") or "Zürich Oerlikon").strip()

        transformed.append({
            "provider_id":     PROVIDER_ID,
            "title":           title,
            "price_chf":       price,
            "location":        location,
            "occurrence":      weekday or None,
            "course_time":     course_time or None,
            "start_date":      convert_date(c.get("start_date")),
            "end_date":        convert_date(c.get("end_date")),
            "course_type":     course_type,
            "course_url":      anmeldung_url,
            "is_online":       False,
            "verfuegbarkeit":  "viele",
            "last_scraped_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "scraper_method":  "scrapegraphai",
        })
    return transformed


def save_metadata(supabase, metadata: dict) -> None:
    if not metadata:
        return
    max_t = metadata.get("max_teilnehmer")
    max_t_str = str(int(max_t)) if max_t and str(max_t).isdigit() else None
    standorte = metadata.get("standorte", [])
    standort_str = ", ".join(standorte) if standorte else "Zürich Oerlikon, Winterthur"

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

    # Schritt 1: Übersichtsseite — Kurse + Metadaten
    print(f"\n  Schritt 1: Übersichtsseite (Kurse + Metadaten)")
    overview_result = scrape_page(OVERVIEW_URL, PROMPT_OVERVIEW)
    metadata = overview_result.get("metadata", {})
    raw_courses = overview_result.get("courses", [])
    print(f"  Metadaten: {json.dumps(metadata, ensure_ascii=False)}")
    print(f"  Kurse gefunden: {len(raw_courses)}")
    time.sleep(2)

    # Schritt 2: Preise Langgymi
    print(f"\n  Schritt 2: Preise Langgymi")
    preise_lang_result = scrape_page(PREISE_LANG_URL, PROMPT_PREISE_LANG)
    preise_lang = preise_lang_result.get("preise", {})
    print(f"  Preise Langgymi: {json.dumps(preise_lang, ensure_ascii=False)}")
    time.sleep(2)

    # Schritt 3: Preise Kurzgymi
    print(f"\n  Schritt 3: Preise Kurzgymi")
    preise_kurz_result = scrape_page(PREISE_KURZ_URL, PROMPT_PREISE_KURZ)
    preise_kurz = preise_kurz_result.get("preise", {})
    print(f"  Preise Kurzgymi: {json.dumps(preise_kurz, ensure_ascii=False)}")

    # Kurse transformieren
    all_courses = transform_courses(raw_courses, preise_lang, preise_kurz)
    print(f"\n  Gesamt: {len(all_courses)} Kurse")
    for c in all_courses:
        print(f"  ✓ {c['course_type']} | {c['title'][:50]} | {c['occurrence']} | {c['start_date']} | {c['location']} | CHF {c['price_chf']}")

    save_metadata(supabase, metadata)
    save_courses(supabase, all_courses)
    elapsed = round(time.time() - start_time, 2)
    print(f"\n✓ {PROVIDER_NAME} abgeschlossen in {elapsed}s | {len(all_courses)} Kurse gespeichert")


if __name__ == "__main__":
    main()