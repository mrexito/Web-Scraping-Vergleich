import os
import re
import json
import time
import requests
from bs4 import BeautifulSoup
from openai import OpenAI
from langchain_openai import ChatOpenAI
from dotenv import load_dotenv
from supabase import create_client
from scrapegraphai.graphs import SmartScraperGraph

load_dotenv("../../../.env")

SUPABASE_URL = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
BFH_API_KEY  = os.getenv("BFH_LLM_API_KEY")

PROVIDER_ID        = 2
PROVIDER_NAME      = "Lern-Forum.ch"
BASE_URL           = "https://www.lern-forum.ch"
MAIN_URL           = f"{BASE_URL}/gymivorbereitung-zuerich"
LANGGYMI_URL       = f"{BASE_URL}/gymivorbereitung-zuerich/langgymnasium"
KURZGYMI_URL       = f"{BASE_URL}/gymivorbereitung-zuerich/kurzgymnasium"

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

PROMPT_META = (
    "Du bist ein Datenextraktions-Assistent. Extrahiere NUR Metadaten von dieser Seite:\n"
    "- aufsatzkorrektur: true wenn Aufsatztraining oder Aufsatzkorrektur erwaehnt wird\n"
    "- einstufungstest: true wenn Einstufungstest oder Standortbestimmung erwaehnt wird\n"
    "- e_learning: true wenn Online-Unterricht oder Online-Kurs erwaehnt wird\n"
    "- pruefungsarchiv: true wenn Pruefungsarchiv oder alte Pruefungen erwaehnt werden\n"
    "- beratungsgespraech: true wenn Beratung oder Beratungsgespraech angeboten wird\n"
    "- lernunterlagen: true wenn Kursmaterial oder Lernunterlagen erwaehnt werden\n"
    "- pruefungssimulation: true wenn Simulationspruefung oder Pruefungssimulation erwaehnt wird\n"
    "- einzelkurse: true wenn Einzelunterricht oder Privatunterricht angeboten wird\n"
    "- max_teilnehmer: maximale Gruppengroesse als Zahl falls erwaehnt\n"
    "- standorte: Liste aller Standorte\n"
    "Antworte NUR mit reinem JSON: {\"metadata\": {...}}"
)

PROMPT_LANGGYMI = (
    "Du bist ein Datenextraktions-Assistent. Extrahiere ALLE Kurstermine fuer das Langgymnasium von dieser Seite.\n"
    "Fuer jeden Kurstermin gib zurueck:\n"
    "- title: Kursname z.B. Schulbegleitender Kurs, Ferienkurs Herbst, Ferienkurs Winter, Intensivkurs\n"
    "- weekday: Wochentag auf Deutsch z.B. Mittwoch, Samstag, Montag-Freitag\n"
    "- course_time: Kurszeit z.B. 09:00-12:00\n"
    "- location: Standort z.B. Zuerich\n"
    "- start_date: Startdatum im Format TT.MM.JJJJ falls vorhanden\n"
    "- end_date: Enddatum im Format TT.MM.JJJJ falls vorhanden\n"
    "- price_chf: Preis als Zahl z.B. 2500\n"
    "- availability: ausgebucht wenn ausgebucht, sonst viele\n"
    "- is_online: true wenn Online-Kurs, sonst false\n"
    "Antworte NUR mit reinem JSON: {\"courses\": [...]}"
)

PROMPT_KURZGYMI = (
    "Du bist ein Datenextraktions-Assistent. Extrahiere ALLE Kurstermine fuer das Kurzgymnasium und HMS von dieser Seite.\n"
    "Fuer jeden Kurstermin gib zurueck:\n"
    "- title: Kursname z.B. Schulbegleitender Kurs, Ferienkurs Herbst, Ferienkurs Winter, Intensivkurs\n"
    "- weekday: Wochentag auf Deutsch z.B. Mittwoch, Samstag, Montag-Freitag\n"
    "- course_time: Kurszeit z.B. 09:00-12:00\n"
    "- location: Standort z.B. Zuerich\n"
    "- start_date: Startdatum im Format TT.MM.JJJJ falls vorhanden\n"
    "- end_date: Enddatum im Format TT.MM.JJJJ falls vorhanden\n"
    "- price_chf: Preis als Zahl z.B. 2500\n"
    "- availability: ausgebucht wenn ausgebucht, sonst viele\n"
    "- is_online: true wenn Online-Kurs, sonst false\n"
    "Antworte NUR mit reinem JSON: {\"courses\": [...]}"
)


def extract_json_from_string(raw: str) -> dict:
    raw = re.sub(r':\s*NA\b', ': null', raw)
    start = raw.find("{")
    end = raw.rfind("}")
    if start != -1 and end != -1 and end > start:
        try:
            return json.loads(raw[start:end+1])
        except json.JSONDecodeError:
            pass
    return {}


def fetch_clean_text(url: str) -> str:
    """Seite laden, Navigation/Header/Footer entfernen, reinen Text zurueckgeben."""
    headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
    r = requests.get(url, headers=headers, timeout=20)
    r.raise_for_status()
    soup = BeautifulSoup(r.text, "html.parser")
    # Navigation, Header, Footer, Scripts entfernen
    for tag in soup.find_all(["nav", "header", "footer", "script", "style", "noscript"]):
        tag.decompose()
    # Gesamten body-Text nehmen
    body = soup.body or soup
    text = body.get_text(separator="\n", strip=True)
    # Leerzeilen bereinigen
    lines = [l.strip() for l in text.splitlines() if l.strip() and len(l.strip()) > 3]
    clean = "\n".join(lines)
    return clean


def call_bfh_llm(prompt: str, text: str) -> dict:
    """Bereinigten Text direkt ans BFH LLM schicken."""
    full_prompt = f"{prompt}\n\nSeiteninhalt:\n{text}"
    client = OpenAI(
        base_url="https://inference.mlmp.ti.bfh.ch/api/v1",
        api_key=BFH_API_KEY,
    )
    response = client.chat.completions.create(
        model="gpt-oss:120b",
        messages=[{"role": "user", "content": full_prompt}],
    )
    raw = response.choices[0].message.content.strip()
    return extract_json_from_string(raw)


def scrape_page(url: str, prompt: str) -> dict:
    print(f"\n  Scrapt: {url}")
    try:
        full_text = fetch_clean_text(url)
        print(f"  HTML bereinigt: {len(full_text)} Zeichen")
        if len(full_text) > 100:
            print(f"  Vorschau: {full_text[:200]}...")
    except Exception as e:
        print(f"  ⚠ HTML-Fetch fehlgeschlagen: {e}")
        return {}

    # Text in Chunks à 15000 Zeichen aufteilen
    chunk_size = 15000
    overlap = 500
    chunks = []
    start = 0
    while start < len(full_text):
        end = min(start + chunk_size, len(full_text))
        chunks.append(full_text[start:end])
        if end == len(full_text):
            break
        start = end - overlap
    print(f"  Verarbeite {len(chunks)} Chunk(s) via BFH LLM...")

    all_courses = []
    metadata = {}
    for i, chunk in enumerate(chunks):
        print(f"  Chunk {i+1}/{len(chunks)} ({len(chunk)} Zeichen)...")
        try:
            result = call_bfh_llm(prompt, chunk)
            if isinstance(result, dict):
                all_courses.extend(result.get("courses", []))
                if result.get("metadata"):
                    metadata = result["metadata"]
        except Exception as e:
            print(f"  ⚠ Chunk {i+1} Fehler: {str(e)[:100]}")

    return {"courses": all_courses, "metadata": metadata}


def convert_date(raw) -> str | None:
    if not raw:
        return None
    raw_str = str(raw).strip()
    # ISO Format: YYYY-MM-DD
    iso = re.match(r"(\d{4})-(\d{2})-(\d{2})", raw_str)
    if iso:
        year_int = int(iso.group(1))
        if year_int not in (2025, 2026, 2027):
            year_int = 2026
        return f"{year_int}-{iso.group(2)}-{iso.group(3)}"
    # Schweizer Format: TT.MM.JJJJ oder TT.MM.JJ
    m = re.match(r"(\d{1,2})\.(\d{1,2})\.(\d{2,4})", raw_str)
    if m:
        year = m.group(3)
        if len(year) == 2:
            year = "20" + year
        year_int = int(year)
        if year_int not in (2025, 2026, 2027):
            year_int = 2026
        return f"{year_int}-{m.group(2).zfill(2)}-{m.group(1).zfill(2)}"
    return None


def parse_price(raw) -> int | None:
    if raw is None:
        return None
    try:
        return int(str(raw).replace("'", "").replace(" ", "").replace(",", "").replace(".-", "").strip())
    except (ValueError, TypeError):
        m = re.search(r"\d{3,5}", str(raw).replace("'", ""))
        return int(m.group()) if m else None


def transform_courses(raw_courses: list, course_type: str) -> list:
    if not raw_courses:
        return []
    anmeldung_url = LANGGYMI_URL if course_type == "langgymi" else KURZGYMI_URL
    transformed = []
    for c in raw_courses:
        title       = (c.get("title") or "").strip()
        weekday     = (c.get("weekday") or "").strip()
        course_time = (c.get("course_time") or "").strip()
        location    = (c.get("location") or "Zürich").strip()
        if weekday.upper() == "NA":
            weekday = ""
        if course_time.upper() == "NA":
            course_time = ""
        avail_raw = str(c.get("availability", "")).lower()
        verfueg   = "ausgebucht" if "ausgebucht" in avail_raw else "viele"
        is_online = bool(c.get("is_online", False)) or "online" in location.lower()

        transformed.append({
            "provider_id":     PROVIDER_ID,
            "title":           f"{title} | {weekday} {course_time}".strip(" |") if title else f"{weekday} {course_time}",
            "price_chf":       parse_price(c.get("price_chf")),
            "location":        location,
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
    standort_str = ", ".join(standorte) if standorte else "Zürich"

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
        typed = [c for c in courses if c["course_type"] == course_type and c["price_chf"]]
        if typed:
            prices = [c["price_chf"] for c in typed]
            avg = round(sum(prices) / len(prices))
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

    # Schritt 1: Hauptseite — Metadaten
    print(f"\n  Schritt 1: Hauptseite — Metadaten")
    meta_result = scrape_page(MAIN_URL, PROMPT_META)
    metadata = meta_result.get("metadata", {})
    print(f"  Metadaten: {json.dumps(metadata, ensure_ascii=False)}")
    time.sleep(2)

    # Schritt 2: Langgymnasium — Kurse
    print(f"\n  Schritt 2: Langgymnasium")
    lang_result = scrape_page(LANGGYMI_URL, PROMPT_LANGGYMI)
    langgymi_courses = transform_courses(lang_result.get("courses", []), "langgymi")
    all_courses.extend(langgymi_courses)
    print(f"  -> {len(langgymi_courses)} Langgymi-Kurse")
    for c in langgymi_courses:
        print(f"     {c['title'][:55]} | {c['location']} | {c['start_date']} | CHF {c['price_chf']} | {c['verfuegbarkeit']}")
    time.sleep(2)

    # Schritt 3: Kurzgymnasium — Kurse
    print(f"\n  Schritt 3: Kurzgymnasium")
    kurz_result = scrape_page(KURZGYMI_URL, PROMPT_KURZGYMI)
    kurzgymi_courses = transform_courses(kurz_result.get("courses", []), "kurzgymi")
    all_courses.extend(kurzgymi_courses)
    print(f"  -> {len(kurzgymi_courses)} Kurzgymi-Kurse")
    for c in kurzgymi_courses:
        print(f"     {c['title'][:55]} | {c['location']} | {c['start_date']} | CHF {c['price_chf']} | {c['verfuegbarkeit']}")

    print(f"\n  Gesamt: {len(all_courses)} Kurse")
    save_metadata(supabase, metadata)
    save_courses(supabase, all_courses)
    elapsed = round(time.time() - start_time, 2)
    print(f"\n✓ {PROVIDER_NAME} abgeschlossen in {elapsed}s | {len(all_courses)} Kurse gespeichert")


if __name__ == "__main__":
    main()