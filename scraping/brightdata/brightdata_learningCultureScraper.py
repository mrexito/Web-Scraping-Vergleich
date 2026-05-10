"""
brightdata_learningCultureScraper.py
======================================
Bright Data Trigger-Skript für LearningCulture (PROVIDER_ID = 4).

Anbieter hat ZWEI separate Detail-Seiten:
  - https://www.learningculture.ch/kurse/langgymi-pruefung
  - https://www.learningculture.ch/kurse/kurzgymi-pruefung

Bright Data liefert pro URL ein Entry zurück.

Verarbeitung:
  1. course_type aus der Source-URL (eindeutig: langgymi/kurzgymi in URL)
  2. weekday wird direkt aus Bright Data übernommen
     (Format: "Samstag, 09:30 - 12:00" oder "Mo - Mi, 13:30 - 16:45")
  3. standorte werden NICHT aus dem Top-Level übernommen (enthält Volltext-Müll
     bei LearningCulture), sondern aus den einzelnen Kurs-Locations abgeleitet.
  4. Booleans werden mit ODER über beide Entries aggregiert (Anbieter-weite
     Eigenschaften — wenn Langgymi-Kurs Aufsatztraining hat, gilt das für
     den Anbieter als Ganzes).

Voraussetzung auf brightdata.com:
  - Data Collector mit Schema (10 Top-Level + 7 courses-Felder)
  - Collector-ID in .env als BRIGHT_DATA_COLLECTOR_ID_LEARNING_CULTURE
"""
import os
import re
import sys
import time
import requests
from dotenv import load_dotenv

_THIS_DIR = os.path.dirname(os.path.abspath(__file__))
_SGAI_DIR = os.path.normpath(os.path.join(_THIS_DIR, "..", "scrapeGraphAi"))
if _SGAI_DIR not in sys.path:
    sys.path.insert(0, _SGAI_DIR)

from scrape_utils import (
    supabase,
    parse_price,
    convert_date,
    record_price_history,
    log_scrape_error,
    ScrapeRun,
)

load_dotenv()


# =====================================================================
# KONFIGURATION
# =====================================================================
SCRAPER_METHOD = "brightdata"
PROVIDER_ID    = 4
PROVIDER_NAME  = "LearningCulture"

BRIGHT_DATA_API_TOKEN = os.getenv("BRIGHT_DATA_API_TOKEN")
COLLECTOR_ID          = os.getenv("BRIGHT_DATA_COLLECTOR_ID_LEARNING_CULTURE")

URLS = [
    {"url": "https://www.learningculture.ch/kurse/langgymi-pruefung"},
    {"url": "https://www.learningculture.ch/kurse/kurzgymi-pruefung"},
]


# =====================================================================
# BRIGHT DATA API
# =====================================================================
def trigger_scraper() -> str:
    print(f"  Starte Bright Data {PROVIDER_NAME} Job...")
    response = requests.post(
        f"https://api.brightdata.com/dca/trigger?collector={COLLECTOR_ID}&queue_next=1",
        headers={
            "Authorization": f"Bearer {BRIGHT_DATA_API_TOKEN}",
            "Content-Type": "application/json",
        },
        json=[{"url": entry["url"]} for entry in URLS],
        timeout=30,
    )
    response.raise_for_status()
    job_id = response.json().get("collection_id")
    print(f"  Job-ID: {job_id}")
    return job_id


def wait_for_results(job_id: str, max_wait: int = 180) -> list:
    print("  Warte auf Bright Data Ergebnisse...")
    elapsed = 0
    while elapsed < max_wait:
        time.sleep(10)
        elapsed += 10
        response = requests.get(
            f"https://api.brightdata.com/dca/dataset?id={job_id}&format=json",
            headers={"Authorization": f"Bearer {BRIGHT_DATA_API_TOKEN}"},
            timeout=30,
        )
        if response.status_code == 200:
            data = response.json()
            if data:
                print(f"  ✓ Ergebnisse erhalten nach {elapsed}s")
                return data
        print(f"  ... noch nicht fertig ({elapsed}s)")
    raise TimeoutError(f"Bright Data Job {job_id} hat nach {max_wait}s keine Ergebnisse geliefert.")


# =====================================================================
# HILFSFUNKTIONEN
# =====================================================================
def clean_string(s):
    """Entfernt Newlines/extra spaces."""
    if not s:
        return ""
    return re.sub(r"\s+", " ", str(s).replace("\n", " ")).strip()


def normalize_availability(raw):
    """Normalisiert availability_status auf viele/wenige/ausgebucht."""
    if not raw:
        return None
    s = str(raw).strip().lower()
    if "ausgebucht" in s or "voll" in s:
        return "ausgebucht"
    if "wenige" in s:
        return "wenige"
    if "viele" in s or "frei" in s or "verfügbar" in s:
        return "viele"
    return None


def normalize_location(loc):
    """Normalisiert location: 'Zu Hause'/'Online' → 'online'."""
    if not loc:
        return None
    s = str(loc).strip()
    sl = s.lower()
    if sl in ("zu hause", "zuhause", "online"):
        return "online"
    return s


def determine_course_type_from_url(url: str) -> str | None:
    """course_type aus der Source-URL ableiten."""
    if not url:
        return None
    url_lower = url.lower()
    if "/langgymi" in url_lower or "langgymi-pruefung" in url_lower:
        return "langgymi"
    if "/kurzgymi" in url_lower or "kurzgymi-pruefung" in url_lower:
        return "kurzgymi"
    return None


def looks_like_real_location(s: str) -> bool:
    """Filtert Volltext-Müll aus standorte-Array.

    LearningCulture-Bright-Data liefert in `standorte` u.a. Texte wie
    'Selbst erstellte Prüfung' oder 'Deutsch: Struktur der drei Aufsatztypen'.
    Wir filtern: echte Ortsnamen sind kurz, ohne Doppelpunkte/Kommas, und
    enthalten keine ganzen Sätze.
    """
    if not s:
        return False
    s = s.strip()
    if len(s) < 2 or len(s) > 50:
        return False
    if ":" in s or s.count(",") > 1 or "(" in s or ")" in s:
        return False
    # Häufige Ortskeywords zulassen
    if "online" in s.lower():
        return True
    # Verdächtige Schlüsselwörter (Kursinhalt, nicht Ort)
    bad_keywords = ["prüfung", "kurs", "aufsatz", "deutsch:", "mathematik:",
                    "wunsch", "lektion", "tag", "termumformung", "satzbau"]
    s_lower = s.lower()
    if any(b in s_lower for b in bad_keywords):
        return False
    return True


# =====================================================================
# METADATEN
# =====================================================================
def aggregate_metadata(entries: list) -> dict:
    """Konsolidiert Metadaten aus beiden Entries.

    Booleans: ODER (Anbieter-weite Eigenschaften)
    max_teilnehmer: erster nicht-null Wert
    standorte: aus EINZELNEN Kurs-Locations abgeleitet (nicht aus dem
               Top-Level standorte-Feld, das bei LearningCulture verseucht ist)
    """
    if not entries:
        return {}

    bool_fields = [
        "pruefungssimulation", "aufsatzkorrektur", "pruefungsarchiv",
        "e_learning", "einzelkurse", "lernunterlagen", "einstufungstest",
        "beratungsgespraech",
    ]

    aggregated = {}
    for f in bool_fields:
        aggregated[f] = any(bool(e.get(f)) for e in entries)

    aggregated["max_teilnehmer"] = None
    for e in entries:
        if e.get("max_teilnehmer") is not None:
            aggregated["max_teilnehmer"] = e["max_teilnehmer"]
            break

    # Standorte aus den einzelnen Kursen sammeln (robuster als das
    # Top-Level standorte-Feld bei LearningCulture)
    course_locations = set()
    for e in entries:
        for course in e.get("courses", []):
            loc = normalize_location(course.get("location"))
            if loc:
                course_locations.add(loc)

    # Falls aus Kursen nichts kommt, fallback auf gefiltertes Top-Level
    if not course_locations:
        for e in entries:
            for s in (e.get("standorte") or []):
                if looks_like_real_location(str(s)):
                    course_locations.add(normalize_location(s))

    aggregated["standorte"] = sorted(course_locations)

    return aggregated


def update_provider_metadata(metadata: dict, run_id: str):
    """Schreibt Stammdaten in GymiProviders und CourseDetails."""
    if not metadata:
        print("  ⚠ Keine Metadaten verfügbar — Schritt übersprungen")
        return

    max_t = metadata.get("max_teilnehmer")
    max_t_str = str(int(max_t)) if max_t and isinstance(max_t, (int, float)) else None

    standorte = metadata.get("standorte", [])
    if isinstance(standorte, list) and standorte:
        standort_str = ", ".join(str(s) for s in standorte if s)
    else:
        standort_str = "Zürich"

    try:
        supabase.table("GymiProviders").update({
            "E-Learning":                     bool(metadata.get("e_learning", False)),
            "Aufsatzkorrektur":               bool(metadata.get("aufsatzkorrektur", False)),
            "Einstufungstest":                bool(metadata.get("einstufungstest", False)),
            "Einzelkurse":                    bool(metadata.get("einzelkurse", False)),
            "Pruefungssimultaion":            bool(metadata.get("pruefungssimulation", False)),
            "Maximale Anzahl der Teilnehmer": max_t_str,
        }).eq("ID", PROVIDER_ID).execute()
        print("  ✓ GymiProviders aktualisiert")
    except Exception as e:
        msg = f"GymiProviders Update fehlgeschlagen: {e}"
        print(f"  ✗ {msg}")
        log_scrape_error(run_id, PROVIDER_ID, "METADATA_ERROR", msg)

    try:
        supabase.table("CourseDetails").update({
            "Pruefungsarchiv":       bool(metadata.get("pruefungsarchiv", False)),
            "Beratungsgespraech":    bool(metadata.get("beratungsgespraech", False)),
            "Eigene Lernunterlagen": bool(metadata.get("lernunterlagen", False)),
            "Standort":              standort_str,
        }).eq("ID", PROVIDER_ID).execute()
        print("  ✓ CourseDetails aktualisiert")
    except Exception as e:
        msg = f"CourseDetails Update fehlgeschlagen: {e}"
        print(f"  ✗ {msg}")
        log_scrape_error(run_id, PROVIDER_ID, "METADATA_ERROR", msg)


# =====================================================================
# KURSE-TRANSFORMATION
# =====================================================================
def transform_courses(entries: list) -> list:
    """Transformiert die Bright Data Entries in das Supabase-Format."""
    courses = []
    skipped = 0

    for entry in entries:
        if not isinstance(entry, dict):
            continue

        url = entry.get("input", {}).get("url", "")
        course_type = determine_course_type_from_url(url)

        if course_type is None:
            print(f"  ⚠ Entry ohne erkennbare URL übersprungen: {url}")
            continue

        for raw in entry.get("courses", []):
            if not isinstance(raw, dict):
                continue

            course_name = clean_string(raw.get("course_name"))
            if not course_name:
                skipped += 1
                continue

            weekday = clean_string(raw.get("weekday"))
            occurrence = weekday if weekday else None

            location = normalize_location(raw.get("location"))

            courses.append({
                "provider_id":     PROVIDER_ID,
                "title":           course_name,
                "price_chf":       parse_price(raw.get("price_chf")),
                "location":        location,
                "occurrence":      occurrence,
                "course_type":     course_type,
                "course_url":      url,
                "is_online":       location == "online" if location else False,
                "verfuegbarkeit":  normalize_availability(raw.get("availability_status")),
                "start_date":      convert_date(raw.get("start_date")),
                "end_date":        convert_date(raw.get("end_date")),
                "last_scraped_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                "scraper_method":  SCRAPER_METHOD,
            })

    if skipped:
        print(f"  ⚠ {skipped} Kurs(e) ohne Namen übersprungen")

    return courses


# =====================================================================
# MAIN
# =====================================================================
def main():
    print(f"Starte {PROVIDER_NAME} Scraper (Bright Data)...")

    if not BRIGHT_DATA_API_TOKEN or not COLLECTOR_ID:
        print(f"  ✗ BRIGHT_DATA_API_TOKEN oder BRIGHT_DATA_COLLECTOR_ID_LEARNING_CULTURE fehlt in .env")
        return

    with ScrapeRun(SCRAPER_METHOD, PROVIDER_ID) as run:
        try:
            job_id = trigger_scraper()
        except Exception as e:
            msg = f"Trigger fehlgeschlagen: {e}"
            print(f"  ✗ {msg}")
            log_scrape_error(run.id, PROVIDER_ID, "TRIGGER_ERROR", msg)
            run.error_count += 1
            return

        try:
            raw_data = wait_for_results(job_id)
        except Exception as e:
            msg = f"Warten auf Ergebnisse fehlgeschlagen: {e}"
            print(f"  ✗ {msg}")
            log_scrape_error(run.id, PROVIDER_ID, "TIMEOUT_ERROR", msg)
            run.error_count += 1
            return

        if not isinstance(raw_data, list) or not raw_data:
            msg = "Keine Entries im Bright Data Output."
            print(f"  ✗ {msg}")
            log_scrape_error(run.id, PROVIDER_ID, "NO_DATA", msg)
            run.error_count += 1
            return

        print(f"  → {len(raw_data)} Entry(s) erhalten")

        metadata = aggregate_metadata(raw_data)
        update_provider_metadata(metadata, run.id)

        try:
            courses = transform_courses(raw_data)
            print(f"  → {len(courses)} Kurs(e) transformiert")
        except Exception as e:
            msg = f"Transformation fehlgeschlagen: {e}"
            print(f"  ✗ {msg}")
            log_scrape_error(run.id, PROVIDER_ID, "TRANSFORM_ERROR", msg)
            run.error_count += 1
            return

        try:
            supabase.table("courses").delete() \
                .eq("provider_id", PROVIDER_ID) \
                .eq("scraper_method", SCRAPER_METHOD) \
                .execute()
            print("  Alte Bright-Data-Kurse gelöscht.")

            if courses:
                supabase.table("courses").insert(courses).execute()
                run.courses_found = len(courses)
                print(f"  ✓ {len(courses)} Kurs(e) gespeichert")

                for course_type in ("langgymi", "kurzgymi"):
                    typed = [c for c in courses
                             if c["course_type"] == course_type and c["price_chf"]]
                    if typed:
                        avg = round(sum(c["price_chf"] for c in typed) / len(typed))
                        record_price_history(PROVIDER_ID, course_type, avg)
                        print(f"  ✓ price_history {course_type}: avg CHF {avg}")
            else:
                log_scrape_error(run.id, PROVIDER_ID, "NO_COURSES_FOUND",
                                 "Keine Kurse von Bright Data erhalten.")
                run.error_count += 1

        except Exception as e:
            msg = f"DB-Insert fehlgeschlagen: {e}"
            print(f"  ✗ {msg}")
            log_scrape_error(run.id, PROVIDER_ID, "INSERT_ERROR", msg)
            run.error_count += 1

    print(f"\n✓ {PROVIDER_NAME} Bright Data abgeschlossen")


if __name__ == "__main__":
    main()