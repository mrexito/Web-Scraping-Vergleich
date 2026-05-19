"""
init_registry.py
=================
Einmaliges Initialisierungs-Skript: legt für alle 12 Provider
Initial-Einträge in scraper_registry an.

Gedacht als Vorbereitung für den Self-Healing-Loop. Nach dem Lauf
hat JEDER Provider einen Registry-Eintrag — auch wenn noch nie ein
Fehler aufgetreten ist.

Verwendung:
    python init_registry.py            # Initial-Einträge anlegen (skip wenn vorhanden)
    python init_registry.py --reset    # Bestehende Einträge überschreiben
"""

import os
import sys
import argparse

_THIS_DIR = os.path.dirname(os.path.abspath(__file__))
_SGAI_DIR = os.path.normpath(os.path.join(_THIS_DIR, "..", "scrapegraphai"))
if _SGAI_DIR not in sys.path:
    sys.path.insert(0, _SGAI_DIR)

from scrape_utils import supabase


# =====================================================================
# STANDARD-PROMPT für ScrapeGraphAI
# =====================================================================
# Dieser Prompt fungiert als generischer Initial-Wert. Sobald ein Fehler auftritt
# und der Self-Healing-Loop einen besseren Prompt vorschlägt, wird er durch den
# providerspezifischen ersetzt.
GENERIC_SGI_PROMPT = """Du bist ein Datenextraktions-Assistent. Extrahiere alle Gymi-Vorbereitungskurse von dieser Webseite.

Für jeden Kurs gib folgende Felder zurück:
- title: Name des Kurses (z.B. "Schulbegleitender Kurs", "Ferienkurs Herbst", "Intensivkurs")
- weekday: Wochentag auf Deutsch (z.B. "Mittwoch", "Samstag", "Montag-Freitag")
- course_time: Kurszeit (z.B. "09:00-12:00") falls vorhanden
- location: Kursort (z.B. "Zürich") oder "Online"
- start_date: Startdatum im Format TT.MM.JJJJ falls vorhanden
- end_date: Enddatum im Format TT.MM.JJJJ falls vorhanden
- price_chf: Gruppenpreis in CHF als Zahl (z.B. 2950). Keine Einzelstundenpreise.
- course_type: "langgymi" oder "kurzgymi" je nach Zielgymnasium
- is_online: true wenn Online-Kurs, sonst false
- availability: "ausgebucht" wenn ausgebucht, "wenige" wenn fast voll, sonst "viele"

Antworte NUR mit reinem JSON-Objekt: {"courses": [...]}"""


# =====================================================================
# PROVIDER-LISTE: alle 12 Anbieter
# =====================================================================
# Aus der GymiProviders-Tabelle ermittelt:
# 1=Gymivorbereitung Zürich, 2=Lern-Forum, 3=Avidii, 4=Learning Culture,
# 5=Gymivorbereitung Fokus, 6=Nachhilfe Akademie, 7=Schule Zürich Nord,
# 8=Open Learning Space, 9=Schlaumacher, 10=Logos Lehrerteam,
# 11=Lern Terrasse, 12=LearningCube

PROVIDERS_WITH_SGI = list(range(1, 13))  # alle 12 Provider haben SGI-Scraper

# Provider mit auch Puppeteer-Support (haben CSS-Selektoren).
# Stand: alle 5 Puppeteer-Scraper fertig (siehe scraping/puppeteer/*.ts).
PROVIDERS_WITH_PUPPETEER = [1, 2, 3, 4, 6]


# =====================================================================
# Standard-Selektoren für Puppeteer (fungieren als Initial-Werte)
# =====================================================================
# Diese Selektoren werden vom Self-Healing-Loop ersetzt, sobald
# Layout-Änderungen einen Fehler verursachen. Die hier eingetragenen
# Werte spiegeln den Stand der jeweiligen Scraper-Skripte zum Zeitpunkt
# des Refactorings wider.
PUPPETEER_FIELDS = {
    1: {  # Gymivorbereitung Zürich
        "course_list":            ".kurs-tabelle tr",
        "price_container":        ".preis",
        "availability_container": ".verfuegbarkeit",
    },
    2: {  # Lern-Forum
        "course_list":            "table.kurstbl tbody tr",
        "price_container":        "table.kurstbl",       # Preis steht in derselben Tabelle
        "availability_container": "table.kurstbl",       # Verfuegbarkeit ebenfalls
    },
    3: {  # Avidii
        "course_list":            ".course-card",
        "price_container":        ".pricing-box",
        "availability_container": ".availability-status",
    },
    4: {  # Learning Culture
        "course_list":            ".div-table-row",
        "price_container":        "button.add-to-cart",
        "availability_container": ".course-location",
    },
    6: {  # Nachhilfe Akademie
        "course_list":            ".vc_tta-panel",
        "price_container":        ".feature_info",
        "availability_container": ".vc_tta-panel-body",
    },
}


# =====================================================================
# UPSERT helper
# =====================================================================
def upsert_entry(
    provider_id: int,
    scraper_method: str,
    field_name: str,
    value: str,
    overwrite: bool = False,
    note_suffix: str = "",
):
    """Legt einen Eintrag an, oder überschreibt ihn falls --reset."""
    # Existiert schon?
    existing = supabase.table("scraper_registry") \
        .select("id, last_updated_by") \
        .eq("provider_id", provider_id) \
        .eq("scraper_method", scraper_method) \
        .eq("field_name", field_name) \
        .execute()

    if existing.data and len(existing.data) > 0:
        if not overwrite:
            print(f"  ⏭  ({provider_id}, {scraper_method}, {field_name}) existiert — übersprungen")
            return

        # Mit --reset überschreiben
        supabase.table("scraper_registry") \
            .update({
                "current_value":   value,
                "fallback_value":  value,
                "last_updated_by": "manual",
                "notes":           f"Initial-Eintrag (init_registry.py --reset). {note_suffix}",
            }) \
            .eq("id", existing.data[0]["id"]) \
            .execute()
        print(f"  ↻  ({provider_id}, {scraper_method}, {field_name}) überschrieben")
        return

    # Neu anlegen
    supabase.table("scraper_registry").insert({
        "provider_id":     provider_id,
        "scraper_method":  scraper_method,
        "field_name":      field_name,
        "current_value":   value,
        "fallback_value":  value,
        "last_updated_by": "manual",
        "notes":           f"Initial-Eintrag (init_registry.py). {note_suffix}",
    }).execute()
    print(f"  ✓  ({provider_id}, {scraper_method}, {field_name}) angelegt")


# =====================================================================
# MAIN
# =====================================================================
def run(reset: bool = False):
    print("=" * 70)
    print("📦 INIT REGISTRY — lege Initial-Einträge in scraper_registry an")
    if reset:
        print("   ⚠ --reset aktiv: bestehende Einträge werden überschrieben")
    print("=" * 70)

    # 1. Provider-Namen für hübschen Output laden
    providers = supabase.table("GymiProviders") \
        .select('"ID", "Name"') \
        .order('"ID"') \
        .execute()
    provider_names = {p["ID"]: p["Name"] for p in (providers.data or [])}

    # 2. SGI für alle 12 Provider
    print("\n--- ScrapeGraphAI: main_prompt für alle 12 Provider ---")
    for pid in PROVIDERS_WITH_SGI:
        name = provider_names.get(pid, f"Provider {pid}")
        print(f"\n[{pid}] {name}")
        upsert_entry(
            provider_id=pid,
            scraper_method="scrapegraphai",
            field_name="main_prompt",
            value=GENERIC_SGI_PROMPT,
            overwrite=reset,
            note_suffix="Generischer SGI-Prompt — Self-Healing kann pro Provider verfeinern.",
        )

    # 3. Puppeteer-Felder für die 5 Provider mit Puppeteer
    print("\n--- Puppeteer: Selektoren für vorhandene Puppeteer-Scraper ---")
    for pid, fields in PUPPETEER_FIELDS.items():
        name = provider_names.get(pid, f"Provider {pid}")
        print(f"\n[{pid}] {name}")
        for field_name, selector in fields.items():
            upsert_entry(
                provider_id=pid,
                scraper_method="puppeteer",
                field_name=field_name,
                value=selector,
                overwrite=reset,
                note_suffix=f"Standard-Selektor für {field_name}.",
            )

    # 4. Bericht
    print("\n" + "=" * 70)
    final_count = supabase.table("scraper_registry").select("id", count="exact").execute()
    print(f"✓ scraper_registry enthält jetzt {final_count.count} Einträge")
    print("=" * 70)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Initial-Einträge für scraper_registry")
    parser.add_argument("--reset", action="store_true",
                        help="Bestehende Einträge überschreiben")
    args = parser.parse_args()
    run(reset=args.reset)