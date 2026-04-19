import os
import re
import json
import time
import requests
import io
from openai import OpenAI
from langchain_openai import ChatOpenAI
from dotenv import load_dotenv
from supabase import create_client
from scrapegraphai.graphs import SmartScraperGraph
from pypdf import PdfReader

load_dotenv("../../../.env")

SUPABASE_URL  = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_KEY  = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
BFH_API_KEY   = os.getenv("BFH_LLM_API_KEY")

PROVIDER_ID   = 7
PROVIDER_NAME = "Schule Zürich Nord"
BASE_URL      = "https://szn.ch"
OVERVIEW_URL  = f"{BASE_URL}/angebote/gymikurs/"
PDF_LANGGYMI  = f"{BASE_URL}/wp-content/uploads/2026/01/Ausschreibung-Gymikurs-Langzeit-26_27.pdf"
PDF_KURZGYMI  = f"{BASE_URL}/wp-content/uploads/2026/01/Gymikurs-Kurzzeit-26_27.pdf"
ANMELDUNG_URL = f"{BASE_URL}/angebote/gymikurs/"

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
Du bist ein Datenextraktions-Assistent. Extrahiere Anbieter-Metadaten von dieser Seite:

- aufsatzkorrektur: true wenn Aufsatzkorrektur erwähnt wird
- einstufungstest: true wenn Einstufungstest oder Standortbestimmung erwähnt wird
- e_learning: true wenn Online-Unterricht erwähnt wird
- pruefungsarchiv: true wenn alte Prüfungen verwendet werden
- beratungsgespraech: true wenn persönliche Beratung angeboten wird
- lernunterlagen: true wenn Dossiers oder Module inbegriffen sind
- pruefungssimulation: true wenn Simulationsprüfung erwähnt wird
- einzelkurse: true wenn Einzelunterricht angeboten wird
- max_teilnehmer: maximale Gruppengrösse als Zahl — sonst null
- standort: Adresse des Kursorts
- ausgebuchte_kurse: Liste der Kursnamen/Wochentage die als AUSGEBUCHT markiert sind (z.B. ["Kurs S", "Samstag"])

Antworte NUR mit reinem JSON: {"metadata": {...}}
"""

PROMPT_PDF_LANGGYMI = """
Du bist ein Datenextraktions-Assistent. Extrahiere alle Kursinformationen aus diesem PDF-Text.

Es gibt mehrere Kursvarianten (Kurs M = Mittwoch, Kurs S = Samstag, Kurs F = Ferienkurs).
Für jeden Kurs gib zurück:
- kurs_name: Kurzname des Kurses — NUR "Kurs M", "Kurs S" oder "Kurs F"
- course_type: "langgymi"
- weekday: Wochentag auf Deutsch (z.B. "Mittwoch", "Samstag", "Dienstag-Freitag")
- course_time: Kurszeit (z.B. "13:30-16:00")
- start_date: Startdatum im Format TT.MM.JJJJ
- end_date: Enddatum im Format TT.MM.JJJJ
- price_chf: Preis als Zahl (z.B. 2300, 420)
- availability: "ausgebucht" wenn AUSGEBUCHT erwähnt wird, sonst "viele"

Antworte NUR mit reinem JSON: {"courses": [...]}

PDF-Inhalt:
"""

PROMPT_PDF_KURZGYMI = """
Du bist ein Datenextraktions-Assistent. Extrahiere alle Kursinformationen aus diesem PDF-Text.

Für jeden Kurs gib zurück:
- kurs_name: Kurzname — verwende NUR "Kurzgymi Mittwoch" oder ähnlich kurze Bezeichnung, NICHT den langen Titel
- course_type: "kurzgymi"
- weekday: Wochentag auf Deutsch (z.B. "Mittwoch")
- course_time: Kurszeit (z.B. "13:45-17:00")
- start_date: Startdatum im Format TT.MM.JJJJ
- end_date: Enddatum im Format TT.MM.JJJJ
- price_chf: Preis als Zahl (z.B. 3200)
- availability: "ausgebucht" wenn ausgebucht, sonst "viele"

Antworte NUR mit reinem JSON: {"courses": [...]}

PDF-Inhalt:
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


def scrape_html(url: str, prompt: str) -> dict:
    """ScrapeGraphAI für HTML-Seiten."""
    print(f"\n  Scrapt HTML: {url}")
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


def fetch_pdf_text(url: str) -> str:
    """PDF via requests herunterladen und Text via pypdf extrahieren."""
    print(f"\n  Lade PDF: {url}")
    try:
        headers = {"User-Agent": "Mozilla/5.0"}
        response = requests.get(url, headers=headers, timeout=30)
        response.raise_for_status()
        reader = PdfReader(io.BytesIO(response.content))
        text = "\n".join(page.extract_text() or "" for page in reader.pages)
        print(f"  ✓ PDF gelesen: {len(text)} Zeichen, {len(reader.pages)} Seite(n)")
        return text
    except Exception as e:
        print(f"  ✗ PDF-Fehler: {e}")
        return ""


def query_bfh_llm(prompt_with_text: str) -> dict:
    """Direkte BFH LLM Anfrage mit PDF-Text."""
    try:
        client = OpenAI(
            base_url="https://inference.mlmp.ti.bfh.ch/api/v1",
            api_key=BFH_API_KEY,
        )
        response = client.chat.completions.create(
            model="gpt-oss:120b",
            messages=[{"role": "user", "content": prompt_with_text}],
            max_tokens=2000,
        )
        raw = response.choices[0].message.content.strip()
        print(f"  LLM Antwort: {raw[:300]}")
        return extract_json_from_string(raw)
    except Exception as e:
        print(f"  ✗ LLM-Fehler: {e}")
        return {}


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
        weekday     = (c.get("weekday") or "").strip()
        course_time = (c.get("course_time") or "").strip()
        kurs_name   = (c.get("kurs_name") or "").strip()
        title       = f"Gymivorbereitung {kurs_name} | {weekday}".strip(" |") if kurs_name else f"Gymivorbereitung | {weekday}"
        avail_raw   = str(c.get("availability", "")).lower()
        transformed.append({
            "provider_id":     PROVIDER_ID,
            "title":           title,
            "price_chf":       parse_price(c.get("price_chf")),
            "location":        "Max-Bill-Platz 11/13, 8050 Zürich",
            "occurrence":      weekday or None,
            "course_time":     course_time or None,
            "start_date":      convert_date(c.get("start_date")),
            "end_date":        convert_date(c.get("end_date")),
            "course_type":     course_type,
            "course_url":      ANMELDUNG_URL,
            "is_online":       False,
            "verfuegbarkeit":  "ausgebucht" if "ausgebucht" in avail_raw else "viele",
            "last_scraped_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "scraper_method":  "scrapegraphai",
        })
    return transformed


def save_metadata(supabase, metadata: dict) -> None:
    if not metadata:
        return
    max_t = metadata.get("max_teilnehmer")
    max_t_str = str(int(max_t)) if max_t and str(max_t).isdigit() else None
    standort = metadata.get("standort") or "Max-Bill-Platz 11/13, 8050 Zürich"
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
    all_courses = []

    # Schritt 1: Hauptseite — Metadaten via ScrapeGraphAI
    print(f"\n  Schritt 1: Hauptseite — Metadaten (ScrapeGraphAI)")
    overview_result = scrape_html(OVERVIEW_URL, PROMPT_OVERVIEW)
    metadata = overview_result.get("metadata", {})
    ausgebuchte = [k.lower() for k in metadata.get("ausgebuchte_kurse", [])]
    print(f"  Metadaten: {json.dumps(metadata, ensure_ascii=False)}")
    print(f"  Ausgebuchte Kurse: {ausgebuchte}")
    time.sleep(2)

    # Schritt 2: PDF Langgymi — pypdf + BFH LLM direkt
    print(f"\n  Schritt 2: PDF Langgymi (pypdf + BFH LLM)")
    pdf_text_lang = fetch_pdf_text(PDF_LANGGYMI)
    if pdf_text_lang:
        langgymi_result = query_bfh_llm(PROMPT_PDF_LANGGYMI + pdf_text_lang)
        if langgymi_result.get("metadata"):
            metadata = merge_metadata(metadata, langgymi_result["metadata"])
        langgymi_courses = transform_courses(langgymi_result.get("courses", []))
        all_courses.extend(langgymi_courses)
        print(f"  -> {len(langgymi_courses)} Langgymi-Kurse")
        for c in langgymi_courses:
            print(f"     {c['title']} | {c['course_time']} | {c['start_date']} | CHF {c['price_chf']} | {c['verfuegbarkeit']}")
    time.sleep(2)

    # Schritt 3: PDF Kurzgymi — pypdf + BFH LLM direkt
    print(f"\n  Schritt 3: PDF Kurzgymi (pypdf + BFH LLM)")
    pdf_text_kurz = fetch_pdf_text(PDF_KURZGYMI)
    if pdf_text_kurz:
        kurzgymi_result = query_bfh_llm(PROMPT_PDF_KURZGYMI + pdf_text_kurz)
        if kurzgymi_result.get("metadata"):
            metadata = merge_metadata(metadata, kurzgymi_result["metadata"])
        kurzgymi_courses = transform_courses(kurzgymi_result.get("courses", []))
        all_courses.extend(kurzgymi_courses)
        print(f"  -> {len(kurzgymi_courses)} Kurzgymi-Kurse")
        for c in kurzgymi_courses:
            print(f"     {c['title']} | {c['course_time']} | {c['start_date']} | CHF {c['price_chf']} | {c['verfuegbarkeit']}")

    # Verfügbarkeit anhand Hauptseiten-Info korrigieren
    # Kurs S = Samstag-Kurs ist ausgebucht wenn "samstag" oder "kurs s" in den ausgebuchten Kursen steht
    samstag_ausgebucht = any("samstag" in a or "kurs s" in a for a in ausgebuchte)
    if samstag_ausgebucht:
        for c in all_courses:
            occ_lower = (c["occurrence"] or "").lower()
            title_lower = c["title"].lower()
            if "samstag" in occ_lower or "kurs s" in title_lower:
                c["verfuegbarkeit"] = "ausgebucht"
                print(f"  → Als ausgebucht markiert: {c['title']}")

    print(f"\n  Gesamt: {len(all_courses)} Kurse")
    save_metadata(supabase, metadata)
    save_courses(supabase, all_courses)
    elapsed = round(time.time() - start_time, 2)
    print(f"\n✓ {PROVIDER_NAME} abgeschlossen in {elapsed}s | {len(all_courses)} Kurse gespeichert")


if __name__ == "__main__":
    main()