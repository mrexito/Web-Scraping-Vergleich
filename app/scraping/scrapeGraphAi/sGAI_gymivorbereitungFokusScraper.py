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

PROVIDER_ID        = 5
PROVIDER_NAME      = "Gymivorbereitung Fokus"
BASE_URL           = "https://www.gymivorbereitung-fokus.ch"
OVERVIEW_URL       = f"{BASE_URL}/"
LANGGYMI_MAIN_URL  = f"{BASE_URL}/langzeitgymnasium"
KURZGYMI_MAIN_URL  = f"{BASE_URL}/kurzzeitgymnasium"
PREISE_URL         = f"{BASE_URL}/kurse/gymivorbereitungskurs-langzeit"
LANGGYMI_URL       = f"{BASE_URL}/kurse/gymivorbereitungskurs-langzeit"
KURZGYMI_URL       = f"{BASE_URL}/kurse/gymivorbereitungskurs-kurzzeit"
ANMELDUNG_LANG_URL = f"{BASE_URL}/kurse/gymivorbereitungskurs-langzeit#form"
ANMELDUNG_KURZ_URL = f"{BASE_URL}/kurse/gymivorbereitungskurs-kurzzeit#form"

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

PROMPT_OVERVIEW = (
    "Du bist ein Datenextraktions-Assistent. Extrahiere Anbieter-Metadaten von dieser Seite:\n"
    "- aufsatzkorrektur: true wenn Aufsatzkorrektur oder Aufsatztraining erwaehnt wird\n"
    "- einstufungstest: true wenn Einstufungstest oder Standortbestimmung erwaehnt wird\n"
    "- e_learning: true wenn Online-Kurse oder digitale Lernplattform erwaehnt wird\n"
    "- pruefungsarchiv: true wenn alte Pruefungen erwaehnt werden\n"
    "- beratungsgespraech: true wenn Beratungsgespraech angeboten wird\n"
    "- lernunterlagen: true wenn Kursordner oder Dossiers inbegriffen sind\n"
    "- pruefungssimulation: true wenn Probeprüfung oder Simulationspruefung erwaehnt wird\n"
    "- einzelkurse: true wenn Einzelunterricht angeboten wird\n"
    "- max_teilnehmer: maximale Gruppengroesse als Zahl\n"
    "- standorte: Liste aller Kursstandorte\n"
    "Antworte NUR mit reinem JSON: {\"metadata\": {...}}"
)

PROMPT_PREISE = (
    "Du bist ein Datenextraktions-Assistent. Extrahiere die Kurspreise von dieser Seite.\n"
    "Gib zurueck:\n"
    "- price_chf: Preis fuer Kurse vor Ort als Zahl (z.B. 2450)\n"
    "- price_online_chf: Preis fuer Online-Kurse als Zahl (z.B. 2250)\n"
    "Antworte NUR mit reinem JSON: {\"price_chf\": ..., \"price_online_chf\": ...}"
)

PROMPT_LANGGYMI = (
    "Du bist ein Datenextraktions-Assistent. Extrahiere ALLE Kurse und Preise von dieser Seite.\n"
    "Fuer jeden Kurs gib zurueck:\n"
    "- kurs_id: Kurs-Buchstabe z.B. A, B, C\n"
    "- weekday: Wochentag auf Deutsch z.B. Mittwoch oder Samstag oder Dienstag oder Donnerstag\n"
    "- course_time: Kurszeit z.B. 09:30-11:00 oder 14:00-15:30\n"
    "- location: Exakter Standortname wie er in der Tabelle steht z.B. Zuerich HB, Buelach, Winterthur, Stadelhofen, Wetzikon, Uster, Meilen, Horgen, Wadenswil, Schaffhausen, Online. Schreib IMMER den echten Standortnamen, nie NA oder unbekannt.\n"
    "- is_online: true wenn Standort Online ist, sonst false\n"
    "Extrahiere auch allgemeine Kursinfos:\n"
    "- price_chf: Preis fuer Kurse vor Ort als Zahl (z.B. 2450)\n"
    "- price_online_chf: Preis fuer Online-Kurse als Zahl (z.B. 2250)\n"
    "- start_kw: Erste Kalenderwoche des Kurses als Zahl (z.B. 35)\n"
    "- end_kw: Letzte Kalenderwoche des Kurses als Zahl (z.B. 9)\n"
    "- num_kurstage: Anzahl Kurstage als Zahl (z.B. 20)\n"
    "Antworte NUR mit reinem JSON: {\"courses\": [...], \"price_chf\": ..., \"price_online_chf\": ..., \"start_kw\": ..., \"end_kw\": ..., \"num_kurstage\": ...}"
)

PROMPT_KURZGYMI = (
    "Du bist ein Datenextraktions-Assistent. Extrahiere ALLE Kurse aus der Kurstabelle auf dieser Seite.\n"
    "Fuer jeden Kurs gib zurueck:\n"
    "- kurs_id: Kurs-Buchstabe z.B. A, B, C, B2\n"
    "- weekday: Wochentag auf Deutsch z.B. Mittwoch oder Samstag oder Dienstag oder Donnerstag\n"
    "- course_time: Kurszeit z.B. 11:15-12:45 oder 15:45-17:15\n"
    "- location: Exakter Standortname wie er in der Tabelle steht z.B. Zuerich HB, Buelach, Winterthur, Stadelhofen, Wetzikon, Uster, Meilen, Horgen, Wadenswil, Schaffhausen, Online. Schreib IMMER den echten Standortnamen, nie NA oder unbekannt.\n"
    "- is_online: true wenn Standort Online ist, sonst false\n"
    "Extrahiere auch allgemeine Kursinfos:\n"
    "- start_kw: Erste Kalenderwoche des Kurses als Zahl (z.B. 35)\n"
    "- end_kw: Letzte Kalenderwoche des Kurses als Zahl (z.B. 9)\n"
    "- num_kurstage: Anzahl Kurstage als Zahl (z.B. 20)\n"
    "Antworte NUR mit reinem JSON: {\"courses\": [...], \"start_kw\": ..., \"end_kw\": ..., \"num_kurstage\": ...}"
)


def extract_json_from_string(raw: str) -> dict:
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


def kw_to_date(kw: int, weekday_name: str, year: int) -> str | None:
    """Kalenderwoche + Wochentag → YYYY-MM-DD"""
    WEEKDAY_MAP = {
        "montag": 0, "dienstag": 1, "mittwoch": 2, "donnerstag": 3,
        "freitag": 4, "samstag": 5, "sonntag": 6,
    }
    import datetime
    wd = WEEKDAY_MAP.get(weekday_name.lower(), 0)
    try:
        # ISO Woche: Jahr-W{kw}-{wochentag}
        date = datetime.datetime.strptime(f"{year}-W{kw:02d}-{wd+1}", "%Y-W%W-%w")
        return date.strftime("%Y-%m-%d")
    except Exception:
        return None


def transform_courses(raw_courses: list, course_type: str, price_chf: int, price_online: int, start_kw: int = None, end_kw: int = None, num_kurstage: int = None) -> list:
    if not raw_courses:
        return []
    transformed = []
    for c in raw_courses:
        kurs_id     = (c.get("kurs_id") or "").strip()
        weekday     = (c.get("weekday") or "").strip()
        course_time = (c.get("course_time") or "").strip()
        location    = (c.get("location") or "").strip()
        if location.upper() in ("NA", "N/A", "NONE", ""):
            location = "Diverse Standorte"
        is_online   = bool(c.get("is_online", False)) or "online" in location.lower()
        price       = price_online if is_online else price_chf
        anmeldung_url = ANMELDUNG_LANG_URL if course_type == "langgymi" else ANMELDUNG_KURZ_URL

        # Titel sauber und kurz
        titel_parts = [f"Kurs {kurs_id}" if kurs_id else "", weekday, course_time]
        title = " | ".join(p for p in titel_parts if p).strip(" |")

        # Datum aus Kalenderwoche berechnen
        # KW 35 2026 = Startdatum, KW 9 2027 = Enddatum
        start_date = kw_to_date(start_kw, weekday, 2026) if start_kw else None
        end_date   = kw_to_date(end_kw, weekday, 2027) if end_kw else None

        transformed.append({
            "provider_id":     PROVIDER_ID,
            "title":           title,
            "price_chf":       price,
            "location":        location or "Diverse Standorte",
            "occurrence":      weekday or None,
            "course_time":     course_time or None,
            "start_date":      start_date,
            "end_date":        end_date,
            "course_type":     course_type,
            "course_url":      anmeldung_url,
            "is_online":       is_online,
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
    standort_str = ", ".join(standorte) if standorte else "Zuerich HB, Winterthur, Buelach und weitere"

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
        "Unterstuezung ausserhalb Unterrichtszeit": True,
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
        typed = [c for c in courses if c["course_type"] == course_type and c["price_chf"] and not c["is_online"]]
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

    # Schritt 1: Hauptseite - Metadaten
    print(f"\n  Schritt 1: Hauptseite - Metadaten")
    overview_result = scrape_page(OVERVIEW_URL, PROMPT_OVERVIEW)
    metadata = overview_result.get("metadata", {})
    print(f"  Metadaten: {json.dumps(metadata, ensure_ascii=False)}")
    time.sleep(2)

    # Schritt 2: Langgymi Hauptseite - zusaetzliche Metadaten
    print(f"\n  Schritt 2: Langgymi Hauptseite - Metadaten")
    langgymi_main_result = scrape_page(LANGGYMI_MAIN_URL, PROMPT_OVERVIEW)
    if langgymi_main_result.get("metadata"):
        metadata = merge_metadata(metadata, langgymi_main_result["metadata"])
    time.sleep(2)

    # Schritt 3: Kurzgymi Hauptseite - zusaetzliche Metadaten
    print(f"\n  Schritt 3: Kurzgymi Hauptseite - Metadaten")
    kurzgymi_main_result = scrape_page(KURZGYMI_MAIN_URL, PROMPT_OVERVIEW)
    if kurzgymi_main_result.get("metadata"):
        metadata = merge_metadata(metadata, kurzgymi_main_result["metadata"])
    print(f"  Finale Metadaten: {json.dumps(metadata, ensure_ascii=False)}")
    time.sleep(2)

    # Schritt 4: Preise + Langgymi-Kurse (eine URL)
    print(f"\n  Schritt 4: Preise + Langgymi-Kursseite")
    langgymi_result = scrape_page(LANGGYMI_URL, PROMPT_LANGGYMI)
    price_chf = parse_price(langgymi_result.get("price_chf")) or 2450
    price_online = parse_price(langgymi_result.get("price_online_chf")) or 2250
    start_kw_lang = langgymi_result.get("start_kw")
    end_kw_lang   = langgymi_result.get("end_kw")
    num_kurstage_lang = langgymi_result.get("num_kurstage")
    print(f"  Preis vor Ort: CHF {price_chf} | Online: CHF {price_online}")
    print(f"  Start KW: {start_kw_lang} | Ende KW: {end_kw_lang} | Kurstage: {num_kurstage_lang}")
    langgymi_courses = transform_courses(langgymi_result.get("courses", []), "langgymi", price_chf, price_online, start_kw_lang, end_kw_lang, num_kurstage_lang)
    all_courses.extend(langgymi_courses)
    print(f"  -> {len(langgymi_courses)} Langgymi-Kurse")
    for c in langgymi_courses:
        print(f"     {c['title'][:50]} | {c['location']} | CHF {c['price_chf']}")
    time.sleep(2)

    # Schritt 5: Kurzgymi-Kurse
    print(f"\n  Schritt 5: Kurzgymi-Kursseite")
    kurzgymi_result = scrape_page(KURZGYMI_URL, PROMPT_KURZGYMI)
    start_kw_kurz = kurzgymi_result.get("start_kw") or start_kw_lang
    end_kw_kurz   = kurzgymi_result.get("end_kw") or end_kw_lang
    num_kurstage_kurz = kurzgymi_result.get("num_kurstage") or num_kurstage_lang
    print(f"  Start KW: {start_kw_kurz} | Ende KW: {end_kw_kurz} | Kurstage: {num_kurstage_kurz}")
    kurzgymi_courses = transform_courses(kurzgymi_result.get("courses", []), "kurzgymi", price_chf, price_online, start_kw_kurz, end_kw_kurz, num_kurstage_kurz)
    all_courses.extend(kurzgymi_courses)
    print(f"  -> {len(kurzgymi_courses)} Kurzgymi-Kurse")
    for c in kurzgymi_courses:
        print(f"     {c['title'][:50]} | {c['location']} | CHF {c['price_chf']}")

    print(f"\n  Gesamt: {len(all_courses)} Kurse")
    save_metadata(supabase, metadata)
    save_courses(supabase, all_courses)
    elapsed = round(time.time() - start_time, 2)
    print(f"\n✓ {PROVIDER_NAME} abgeschlossen in {elapsed}s | {len(all_courses)} Kurse gespeichert")


if __name__ == "__main__":
    main()