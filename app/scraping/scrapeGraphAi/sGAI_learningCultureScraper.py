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

PROVIDER_ID        = 4
PROVIDER_NAME      = "Learning Culture"
BASE_URL           = "https://www.learningculture.ch"
LANGGYMI_URL       = f"{BASE_URL}/kurse/langgymi-pruefung"
KURZGYMI_URL       = f"{BASE_URL}/kurse/kurzgymi-pruefung"
PROBEZEIT_URL      = f"{BASE_URL}/kurse/gymi-probezeit"
ANMELDUNG_LANG_URL = LANGGYMI_URL
ANMELDUNG_KURZ_URL = KURZGYMI_URL
ANMELDUNG_PROB_URL = PROBEZEIT_URL

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

PROMPT_LANGGYMI_META = (
    "Du bist ein Datenextraktions-Assistent. Extrahiere NUR die Metadaten von dieser Seite (keine Kurse):\n"
    "- aufsatzkorrektur: true wenn Aufsatztraining oder Aufsatzkorrektur erwaehnt wird\n"
    "- einstufungstest: true wenn Einstufungstest erwaehnt wird\n"
    "- e_learning: true wenn Online-Unterricht erwaehnt wird\n"
    "- pruefungsarchiv: true wenn alte Pruefungen erwaehnt werden\n"
    "- beratungsgespraech: true wenn Beratung angeboten wird\n"
    "- lernunterlagen: true wenn Lehrmittel inklusive sind\n"
    "- pruefungssimulation: true wenn Simulationspruefung erwaehnt wird\n"
    "- einzelkurse: true wenn Einzelunterricht angeboten wird\n"
    "- max_teilnehmer: maximale Gruppengroesse als Zahl z.B. 7\n"
    "- standorte: Liste aller Standorte\n"
    "Antworte NUR mit reinem JSON: {\"metadata\": {...}}"
)

PROMPT_KURSE_TEIL1PLUS = (
    "Du bist ein Datenextraktions-Assistent. Extrahiere ALLE Kurstermine von dieser Seite.\n"
    "Die Seite hat folgende Abschnitte mit Kursterminen:\n"
    "- Teil 1+ (ab Maerz): Preis CHF 3190\n"
    "- Teil 1 (ab Mai, ab Juni, ab August): Preis CHF 1890\n"
    "- Teil 2: Preis CHF 2110\n"
    "- Themenkurse / Ferienkurse: verschiedene Preise\n"
    "- Intensivkurse Sportferien: ca. CHF 980\n"
    "- Simulationspruefung: ca. CHF 290\n"
    "Fuer JEDEN Kurstermin gib zurueck:\n"
    "- title: Kursname z.B. Teil 1+, Teil 1, Teil 2, Themenkurs, Intensivkurs Sportferien, Simulationspruefung\n"
    "- weekday: Wochentag z.B. Mittwoch, Samstag, Sonntag, Montag-Freitag, Di und Do\n"
    "- course_time: Kurszeit z.B. 09:30-12:00\n"
    "- location: Standort z.B. Zuerich Stadelhofen, Zuerich Seefeld, Zuerich HB\n"
    "- start_date: Startdatum TT.MM.JJJJ\n"
    "- end_date: Enddatum TT.MM.JJJJ\n"
    "- price_chf: Preis als Zahl\n"
    "- availability: ausgebucht wenn Ausgebucht steht, sonst viele\n"
    "Antworte NUR mit reinem JSON: {\"courses\": [...]}"
)

PROMPT_KURSE_TEIL1_2 = PROMPT_KURSE_TEIL1PLUS  # Gleicher Prompt, gleiche URL

PROMPT_KURZGYMI_TEIL1PLUS = (
    "Du bist ein Datenextraktions-Assistent. Extrahiere ALLE Teil 1+ und Teil 1 Kurstermine von dieser Seite.\n"
    "Es gibt viele Termine — extrahiere JEDEN einzelnen davon.\n"
    "Teil 1+ Kurse starten im Maerz oder April, Teil 1 Kurse starten ab Mai, Juni oder August.\n"
    "Fuer jeden einzelnen Kurs gib zurueck:\n"
    "- title: Teil 1+ oder Teil 1\n"
    "- weekday: Wochentag z.B. Mittwoch, Samstag, Sonntag, Di und Do, Mo-Fr\n"
    "- course_time: Kurszeit z.B. 09:30-12:00\n"
    "- location: Standort z.B. Zuerich Stadelhofen, Zuerich Seefeld, Winterthur, Horgen\n"
    "- start_date: Startdatum TT.MM.JJJJ\n"
    "- end_date: Enddatum TT.MM.JJJJ\n"
    "- price_chf: Preis als Zahl — Teil 1+: 3190, Teil 1: 1890\n"
    "- availability: ausgebucht wenn Ausgebucht steht, sonst viele\n"
    "Antworte NUR mit reinem JSON: {\"courses\": [...]}"
)

PROMPT_KURZGYMI_TEIL2 = (
    "Du bist ein Datenextraktions-Assistent. Extrahiere die Teil 2 Kurstermine dieser Seite.\n"
    "Fuer jeden Kurs gib zurueck:\n"
    "- title: Teil 2\n"
    "- weekday: Wochentag z.B. Mittwoch, Samstag, Sonntag, Di und Do\n"
    "- course_time: Kurszeit z.B. 13:30-16:45\n"
    "- location: Standort z.B. Zuerich Stadelhofen, Zuerich Seefeld, Winterthur\n"
    "- start_date: Startdatum TT.MM.JJJJ\n"
    "- end_date: Enddatum TT.MM.JJJJ\n"
    "- price_chf: Preis als Zahl z.B. 2110\n"
    "- availability: ausgebucht wenn Ausgebucht steht, sonst viele\n"
    "Antworte NUR mit reinem JSON: {\"courses\": [...]}"
)

PROMPT_PROBEZEIT = (
    "Du bist ein Datenextraktions-Assistent. Extrahiere ALLE Probezeit-Kurse von dieser Seite.\n"
    "Fuer jeden Kurs gib zurueck:\n"
    "- title: Kursname z.B. Langgymi Latein, Langgymi Mathematik, Kurzgymi Latein, Kurzgymi Mathematik\n"
    "- course_type: langgymi wenn Langgymi, kurzgymi wenn Kurzgymi\n"
    "- weekday: Wochentag auf Deutsch z.B. Mittwoch, Samstag, Montag-Freitag\n"
    "- course_time: Kurszeit z.B. 08:45-12:00\n"
    "- location: Standort z.B. Zuerich Stadelhofen, Zuerich Seefeld\n"
    "- start_date: Startdatum im Format TT.MM.JJJJ\n"
    "- end_date: Enddatum im Format TT.MM.JJJJ\n"
    "- price_chf: Preis als Zahl z.B. 980\n"
    "- availability: ausgebucht wenn Ausgebucht steht, sonst viele\n"
    "- is_online: false\n"
    "Antworte NUR mit reinem JSON: {\"courses\": [...]}"
)


def extract_json_from_string(raw: str) -> dict:
    # NA ist kein gültiges JSON — ersetzen
    raw = re.sub(r':\s*NA\b', ': null', raw)
    start = raw.find("{")
    end = raw.rfind("}")
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


def transform_courses(raw_courses: list) -> list:
    if not raw_courses:
        return []
    transformed = []
    for c in raw_courses:
        course_type_raw = (c.get("course_type") or "langgymi").lower()
        course_type = "kurzgymi" if "kurz" in course_type_raw else "langgymi"
        title       = (c.get("title") or "").strip()
        weekday     = (c.get("weekday") or "").strip()
        course_time = (c.get("course_time") or "").strip()
        location    = (c.get("location") or "").strip()
        if "ort wie" in location.lower():
            location = "Gemäss Teil 1"
        elif location.upper() in ("NA", "N/A", "NONE", ""):
            location = ""
        # Bereinige NA in weekday/course_time
        if weekday.upper() == "NA":
            weekday = ""
        if course_time.upper() == "NA":
            course_time = ""
        avail_raw   = str(c.get("availability", "")).lower()
        verfueg     = "ausgebucht" if "ausgebucht" in avail_raw else "viele"
        is_online   = bool(c.get("is_online", False))

        if course_type == "langgymi":
            anmeldung_url = ANMELDUNG_LANG_URL
        elif "probezeit" in title.lower() or "latein" in title.lower() or "probezeit" in (c.get("title") or "").lower():
            anmeldung_url = ANMELDUNG_PROB_URL
        else:
            anmeldung_url = ANMELDUNG_KURZ_URL

        transformed.append({
            "provider_id":     PROVIDER_ID,
            "title":           f"{title} | {weekday} {course_time}".strip(" |") if title else f"{weekday} {course_time}",
            "price_chf":       parse_price(c.get("price_chf")),
            "location":        location or "Zürich",
            "occurrence":      weekday or None,
            "course_time":     course_time or None,
            "start_date":      convert_date(c.get("start_date")),
            "end_date":        convert_date(c.get("end_date")),
            "course_type":     course_type,
            "course_url":      anmeldung_url,
            "is_online":       is_online,
            "verfuegbarkeit":  verfueg,
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
    standort_str = ", ".join(standorte) if standorte else "Zürich Stadelhofen, Zürich Seefeld"

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
        "info freien Plaetze?":                     True,
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
    print("  Alte Kurse geloescht.")
    if not courses:
        print("  Keine Kurse zum Speichern.")
        return
    supabase.table("courses").insert(courses).execute()
    print(f"  ✓ {len(courses)} Kurs(e) gespeichert")
    for course_type in ["langgymi", "kurzgymi"]:
        # Nur Hauptkurse (Teil 1, Teil 2) fuer price_history — keine Probezeit-Kurse
        typed = [c for c in courses if c["course_type"] == course_type
                 and c["price_chf"]
                 and not any(x in (c.get("title") or "") for x in ["Latein", "Mathe", "Probezeit", "Simulationspruefung"])]
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

    # Schritt 1: Langgymi — Metadaten
    print(f"\n  Schritt 1: Langgymi — Metadaten")
    meta_result = scrape_page(LANGGYMI_URL, PROMPT_LANGGYMI_META)
    metadata = meta_result.get("metadata", {})
    print(f"  Metadaten: {json.dumps(metadata, ensure_ascii=False)}")
    time.sleep(2)

    # Schritt 2: Langgymi — alle Kurse
    print(f"\n  Schritt 2: Langgymi — alle Kurse")
    lang_result = scrape_page(LANGGYMI_URL, PROMPT_KURSE_TEIL1PLUS)
    for c in lang_result.get("courses", []):
        c["course_type"] = "langgymi"
    langgymi_courses = transform_courses(lang_result.get("courses", []))
    all_courses.extend(langgymi_courses)
    print(f"  -> {len(langgymi_courses)} Langgymi-Kurse")
    for c in langgymi_courses:
        print(f"     {c['title'][:50]} | {c['location']} | {c['start_date']} | CHF {c['price_chf']} | {c['verfuegbarkeit']}")
    time.sleep(2)

    # Schritt 3: Kurzgymi — Teil 1+ und Teil 1
    print(f"\n  Schritt 3: Kurzgymi — Teil 1+ und Teil 1")
    kurz_t1 = scrape_page(KURZGYMI_URL, PROMPT_KURZGYMI_TEIL1PLUS)
    for c in kurz_t1.get("courses", []):
        c["course_type"] = "kurzgymi"
    kurz_t1_courses = transform_courses(kurz_t1.get("courses", []))
    all_courses.extend(kurz_t1_courses)
    print(f"  -> {len(kurz_t1_courses)} Kurzgymi Teil 1+/1 Kurse")
    for c in kurz_t1_courses:
        print(f"     {c['title'][:50]} | {c['location']} | {c['start_date']} | CHF {c['price_chf']} | {c['verfuegbarkeit']}")
    time.sleep(2)

    # Schritt 3b: Kurzgymi — Teil 2
    print(f"\n  Schritt 3b: Kurzgymi — Teil 2")
    kurz_t2 = scrape_page(KURZGYMI_URL, PROMPT_KURZGYMI_TEIL2)
    for c in kurz_t2.get("courses", []):
        c["course_type"] = "kurzgymi"
    kurz_t2_courses = transform_courses(kurz_t2.get("courses", []))
    all_courses.extend(kurz_t2_courses)
    print(f"  -> {len(kurz_t2_courses)} Kurzgymi Teil 2 Kurse")
    for c in kurz_t2_courses:
        print(f"     {c['title'][:50]} | {c['location']} | {c['start_date']} | CHF {c['price_chf']} | {c['verfuegbarkeit']}")
    time.sleep(2)

    # Schritt 4: Probezeit
    print(f"\n  Schritt 4: Probezeit")
    probezeit_result = scrape_page(PROBEZEIT_URL, PROMPT_PROBEZEIT)
    probezeit_courses = transform_courses(probezeit_result.get("courses", []))
    all_courses.extend(probezeit_courses)
    print(f"  -> {len(probezeit_courses)} Probezeit-Kurse")
    print(f"\n  Gesamt: {len(all_courses)} Kurse")
    save_metadata(supabase, metadata)
    save_courses(supabase, all_courses)
    elapsed = round(time.time() - start_time, 2)
    print(f"\n✓ {PROVIDER_NAME} abgeschlossen in {elapsed}s | {len(all_courses)} Kurse gespeichert")


if __name__ == "__main__":
    main()