"""
zap_info_scraper.py
====================
ScrapeGraphAI-basierter Scraper für die ZAP-Termine des Kantons Zürich.

Funktionalität:
  - Scrapt die offiziellen Termine für Langgymnasium und Kurzgymnasium
    direkt von zh.ch
  - Extrahiert: Anmeldefristen, Prüfungsdaten, Resultatbekanntgabe,
    Schulbeginn, Prüfungsfächer
  - Persistiert die Daten in der Supabase-Tabelle 'zap_info'

Topic-Anforderung F-8:
  «Addition of information pages to the portal, such as 'About us',
   a ZAP info page for the canton of Zurich and a contact page.
   The ZAP info page contains relevant information such as exam dates,
   requirements and guidelines. To ensure that this information remains
   up to date, I will regularly update it automatically using
   AI-supported web crawlers and scraping mechanisms.»

Architektur-Entscheidung:
  ScrapeGraphAI mit BFH-gehostetem gpt-oss:120b via ChatOpenAI-Instanz
  (gleicher Tech-Stack wie die Anbieter-Scraper).

Ausführung:
  python scraping/zap-info/zap_info_scraper.py

Frequenz:
  Einmal pro Schuljahr (Termine ändern sich nur jährlich).
"""

import os
import sys
import json
from datetime import datetime, timezone
from typing import Optional

from dotenv import load_dotenv
from langchain_openai import ChatOpenAI
from scrapegraphai.graphs import SmartScraperGraph
from supabase import create_client, Client

# =====================================================================
# KONFIGURATION
# =====================================================================

# .env aus dem Projekt-Root laden (gleicher Pfad wie andere Scraper)
_THIS_DIR = os.path.dirname(os.path.abspath(__file__))
_ENV_PATH = os.path.normpath(os.path.join(_THIS_DIR, '..', '..', '.env'))
load_dotenv(_ENV_PATH)

SUPABASE_URL = os.getenv('NEXT_PUBLIC_SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY')
BFH_API_KEY = os.getenv('BFH_LLM_API_KEY')

# BFH-LLM-Konfiguration (identisch zu scrape_utils.py)
BFH_BASE_URL = 'https://inference.mlmp.ti.bfh.ch/api/v1'
BFH_MODEL = 'gpt-oss:120b'

# Validierung
if not SUPABASE_URL or not SUPABASE_KEY:
    print('FEHLER: NEXT_PUBLIC_SUPABASE_URL oder SUPABASE_SERVICE_ROLE_KEY fehlt in .env')
    sys.exit(1)

if not BFH_API_KEY:
    print('FEHLER: BFH_LLM_API_KEY fehlt in .env')
    sys.exit(1)

# LLM-Instanz erzeugen (gleich wie scrape_utils.py)
llm_instance = ChatOpenAI(
    model=BFH_MODEL,
    api_key=BFH_API_KEY,
    base_url=BFH_BASE_URL,
)

# Graph-Config mit model_instance (gleiche Struktur wie scrape_utils.py)
graph_config = {
    'llm': {
        'model_instance': llm_instance,
        'model_tokens': 32000,
    },
    'verbose': False,
    'headless': True,
}

# Quellen-URLs für die zwei Topic-relevanten Bildungsgänge
SOURCES = [
    {
        'scope': 'langgymi',
        'url': 'https://www.zh.ch/de/bildung/schulen/maturitaetsschule/zentrale-aufnahmepruefung/pruefung-fuer-das-langgymnasium.html',
        'description': 'Langgymnasium (6 Jahre, Eintritt nach 6. Klasse Primar)',
    },
    {
        'scope': 'kurzgymi',
        'url': 'https://www.zh.ch/de/bildung/schulen/maturitaetsschule/zentrale-aufnahmepruefung/pruefung-fuer-das-kurzgymnasium.html',
        'description': 'Kurzgymnasium (4 Jahre, Eintritt nach 2./3. Sek)',
    },
]

# Prompt-Template für die LLM-Extraktion
PROMPT_TEMPLATE = """
Extrahiere aus dieser offiziellen ZAP-Webseite des Kantons Zürich
die wichtigsten Termine und Informationen für die aktuelle und kommende
Zentrale Aufnahmeprüfung.

Liefere die Daten als JSON in EXAKT diesem Format zurück (alle Felder
optional, null falls nicht vorhanden):

{
  "school_year": "<Schuljahr-String wie '2026/27'>",
  "registration_start": "<Datum der Anmeldebeginn als YYYY-MM-DD oder null>",
  "registration_end": "<Datum des Anmeldeschluss als YYYY-MM-DD oder null>",
  "exam_date": "<Datum der Pruefung als YYYY-MM-DD oder null>",
  "exam_time_info": "<Kurzbeschreibung der Pruefungszeiten oder null>",
  "result_announcement_date": "<Datum der Resultatbekanntgabe als YYYY-MM-DD oder null>",
  "school_start_date": "<Datum des Schulbeginns als YYYY-MM-DD oder null>",
  "exam_subjects": [
    {"name": "Mathematik", "duration": "<Dauer-String wie '60 Minuten'>"},
    {"name": "Deutsch", "duration": "<Dauer-String>"}
  ],
  "notes": "<Wichtige Hinweise oder Besonderheiten als Fliesstext oder null>"
}

WICHTIG:
- Daten im Format YYYY-MM-DD (z.B. 2027-03-08)
- Falls die Webseite mehrere Schuljahre listet, nimm das aktuell relevante
  (das naechste oder kommende Schuljahr)
- exam_subjects ist ein Array, nicht ein Object
- Wenn ein Feld nicht eindeutig auffindbar ist, setze es auf null
- Keine erfundenen Daten, lieber null als raten
"""


# =====================================================================
# HILFSFUNKTIONEN
# =====================================================================

def scrape_zap_source(source: dict) -> Optional[dict]:
    """Scrapt eine ZAP-Quelle und gibt die extrahierten Daten zurück."""
    print(f'  Scrape: {source["scope"]} ({source["description"]})')
    print(f'  URL: {source["url"]}')

    try:
        graph = SmartScraperGraph(
            prompt=PROMPT_TEMPLATE,
            source=source['url'],
            config=graph_config,
        )
        result = graph.run()

        if not result or not isinstance(result, dict):
            print(f'  WARNUNG: Leeres oder ungueltiges Resultat')
            return None

        
        # ScrapeGraphAI v1.59+ wickelt das Resultat in einen 'content'-Wrapper.
        # Der Wrapper kann sowohl ein Dict als auch ein JSON-String sein.
        # Wir packen ihn defensiv aus.
        if 'content' in result:
            content = result['content']
            if isinstance(content, dict):
                result = content
            elif isinstance(content, str):
                # JSON-String parsen
                try:
                    parsed = json.loads(content)
                    if isinstance(parsed, dict):
                        result = parsed
                except json.JSONDecodeError as e:
                    print(f'  WARNUNG: content ist ein String aber kein gueltiges JSON: {e}')

        print(f'  Erfolg: {len(str(result))} Zeichen extrahiert')
        return result

    except Exception as e:
        print(f'  FEHLER beim Scrapen: {e}')
        return None


def normalize_date(date_str: Optional[str]) -> Optional[str]:
    """Validiert und normalisiert ein Datum auf YYYY-MM-DD."""
    if not date_str or not isinstance(date_str, str):
        return None
    try:
        d = datetime.strptime(date_str.strip(), '%Y-%m-%d')
        return d.strftime('%Y-%m-%d')
    except ValueError:
        return None


def normalize_subjects(subjects) -> Optional[list]:
    """Validiert die Pruefungsfaecher-Liste."""
    if not subjects or not isinstance(subjects, list):
        return None
    normalized = []
    for s in subjects:
        if isinstance(s, dict) and 'name' in s and 'duration' in s:
            normalized.append({
                'name': str(s['name']).strip(),
                'duration': str(s['duration']).strip() if s['duration'] else '',
            })
    return normalized if normalized else None


def build_upsert_payload(source: dict, raw_data: dict) -> dict:
    """Baut den Insert-Payload für die zap_info-Tabelle."""
    return {
        'scope': source['scope'],
        'school_year': str(raw_data.get('school_year', '')).strip() or 'unknown',
        'registration_start': normalize_date(raw_data.get('registration_start')),
        'registration_end': normalize_date(raw_data.get('registration_end')),
        'exam_date': normalize_date(raw_data.get('exam_date')),
        'exam_time_info': raw_data.get('exam_time_info'),
        'result_announcement_date': normalize_date(raw_data.get('result_announcement_date')),
        'school_start_date': normalize_date(raw_data.get('school_start_date')),
        'exam_subjects': normalize_subjects(raw_data.get('exam_subjects')),
        'notes': raw_data.get('notes'),
        'source_url': source['url'],
        'last_verified_at': datetime.now(timezone.utc).isoformat(),
        'updated_by': 'zap_info_scraper',
    }


def upsert_zap_info(supabase: Client, payload: dict) -> bool:
    """Schreibt einen ZAP-Info-Eintrag in die Datenbank."""
    try:
        existing = supabase.table('zap_info').select('id').eq(
            'scope', payload['scope']
        ).eq('school_year', payload['school_year']).execute()

        if existing.data and len(existing.data) > 0:
            existing_id = existing.data[0]['id']
            supabase.table('zap_info').update(payload).eq('id', existing_id).execute()
            print(f'  Aktualisiert: zap_info[id={existing_id}] fuer {payload["scope"]} {payload["school_year"]}')
        else:
            result = supabase.table('zap_info').insert(payload).execute()
            new_id = result.data[0]['id'] if result.data else 'unbekannt'
            print(f'  Neu eingefuegt: zap_info[id={new_id}] fuer {payload["scope"]} {payload["school_year"]}')

        return True

    except Exception as e:
        print(f'  FEHLER beim Schreiben in Supabase: {e}')
        return False


# =====================================================================
# HAUPT-FUNKTION
# =====================================================================

def main():
    print('=' * 60)
    print('ZAP-Info Scraper - Kanton Zuerich')
    print(f'Start: {datetime.now().isoformat()}')
    print('=' * 60)

    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

    success_count = 0
    fail_count = 0

    for source in SOURCES:
        print(f'\n--- {source["scope"].upper()} ---')

        raw_data = scrape_zap_source(source)
        if not raw_data:
            fail_count += 1
            continue

        try:
            print(f'  Rohdaten: {json.dumps(raw_data, indent=2, ensure_ascii=False)[:500]}')
        except Exception:
            print(f'  Rohdaten: {str(raw_data)[:500]}')

        payload = build_upsert_payload(source, raw_data)

        if upsert_zap_info(supabase, payload):
            success_count += 1
        else:
            fail_count += 1

    print('\n' + '=' * 60)
    print(f'Fertig: {success_count} erfolgreich, {fail_count} fehlgeschlagen')
    print(f'Ende: {datetime.now().isoformat()}')
    print('=' * 60)

    return 0 if fail_count == 0 else 1


if __name__ == '__main__':
    sys.exit(main())