"""
demo_self_healing.py
=====================
Demo-Skript für die Verteidigung der Bachelorthesis.

Provoziert kontrolliert zwei Self-Healing-Fälle:
  1. Puppeteer-Selektor heilen (Avidii, Provider 3)
  2. ScrapeGraphAI-Prompt heilen (Lern-Forum, Provider 2)

Ablauf pro Demo:
  ┌──── 1. Vorher-Zustand ────────────────────────────────────────┐
  │ scraper_registry: aktuellen "guten" Wert zeigen               │
  │ Dann: temporär durch absichtlich kaputten Wert ersetzen       │
  └───────────────────────────────────────────────────────────────┘
                               ↓
  ┌──── 2. Echtes HTML laden ─────────────────────────────────────┐
  │ requests.get() auf Avidii / Lern-Forum                        │
  │ → echtes, aktuelles HTML als snapshot                         │
  └───────────────────────────────────────────────────────────────┘
                               ↓
  ┌──── 3. Fehler-Eintrag erzeugen ───────────────────────────────┐
  │ INSERT INTO scrape_errors mit:                                │
  │   - error_type: PRICE_SELECTOR_FAILED / NO_COURSES_FOUND      │
  │   - html_snapshot: echtes HTML                                │
  │   - message: "_DEMO_ ..."  ← Tag für Cleanup                  │
  └───────────────────────────────────────────────────────────────┘
                               ↓
  ┌──── 4. Self-Healing-Loop triggern ────────────────────────────┐
  │ self_healing_loop.run(limit=5)                                │
  │ → Gemini analysiert HTML, schlägt neuen Wert vor              │
  │ → schreibt in scraper_registry                                │
  └───────────────────────────────────────────────────────────────┘
                               ↓
  ┌──── 5. Vorher-Nachher zeigen ─────────────────────────────────┐
  │ SELECT current_value FROM scraper_registry                    │
  │ → Vergleich: kaputter alter Wert vs. neuer von Gemini         │
  └───────────────────────────────────────────────────────────────┘
                               ↓
  ┌──── 6. Cleanup-Frage ─────────────────────────────────────────┐
  │ "Demo-Daten zurücksetzen? [j/n]"                              │
  │   - 'j' → scraper_registry zurücksetzen, Demo-Fehler löschen  │
  │   - 'n' → alles bleibt für DB-Inspektion                      │
  └───────────────────────────────────────────────────────────────┘

Verwendung:
  python demo_self_healing.py              # beide Demos nacheinander
  python demo_self_healing.py --only puppeteer
  python demo_self_healing.py --only sgi
"""

import os
import sys
import argparse
import requests
from datetime import datetime, timezone

_THIS_DIR = os.path.dirname(os.path.abspath(__file__))
_SGAI_DIR = os.path.normpath(os.path.join(_THIS_DIR, "..", "scrapeGraphAi"))
if _SGAI_DIR not in sys.path:
    sys.path.insert(0, _SGAI_DIR)

from scrape_utils import supabase
import self_healing_loop


# =====================================================================
# DEMO-KONFIGURATIONEN
# =====================================================================
DEMO_PUPPETEER = {
    "name":           "Puppeteer-Selektor heilen",
    "provider_id":    3,
    "provider_name":  "Avidii",
    "scraper_method": "puppeteer",
    "field_name":     "price_container",
    "broken_value":   ".pricing-OLD-broken-DEMO",  # absichtlich kaputt
    "url":            "https://avidii.ch/gymivorbereitung-langzeitgymnasium",
    "error_type":     "PRICE_SELECTOR_FAILED",
    "error_message":  "_DEMO_ Selector .pricing-OLD-broken-DEMO findet keinen Preis-Container",
}

DEMO_SGI = {
    "name":           "ScrapeGraphAI-Prompt heilen",
    "provider_id":    2,
    "provider_name":  "Lern-Forum",
    "scraper_method": "scrapegraphai",
    "field_name":     "main_prompt",
    "broken_value":   "_DEMO_ Bitte hol mir Daten.",  # absichtlich nutzlos
    "url":            "https://www.lern-forum.ch/kurse/gymivorbereitungskurse",
    "error_type":     "NO_COURSES_FOUND",
    "error_message":  "_DEMO_ Prompt zu vage, LLM gab leere Liste zurück",
}


# =====================================================================
# HELPER: Vorher-Zustand sichern, kaputten Wert eintragen
# =====================================================================
def save_original_and_break(cfg: dict) -> str:
    """Holt aktuellen 'guten' Wert aus Registry, ersetzt durch kaputten Demo-Wert.

    Returns:
        Der ursprüngliche 'gute' Wert (für späteres Cleanup).
    """
    print(f"\n┌─ SCHRITT 1: Vorher-Zustand vorbereiten ─────────────────────")

    # Aktuellen Wert aus Registry holen
    result = supabase.table("scraper_registry") \
        .select("current_value") \
        .eq("provider_id", cfg["provider_id"]) \
        .eq("scraper_method", cfg["scraper_method"]) \
        .eq("field_name", cfg["field_name"]) \
        .limit(1) \
        .execute()

    if not result.data:
        raise RuntimeError(
            f"Kein Eintrag in scraper_registry für "
            f"({cfg['provider_id']}, {cfg['scraper_method']}, {cfg['field_name']}).\n"
            f"Bitte zuerst Migration 001_scraper_registry.sql ausführen."
        )

    original_value = result.data[0]["current_value"]
    print(f"│ Original-Wert (vorher):  {original_value[:80]}{'...' if len(original_value) > 80 else ''}")

    # Durch kaputten Wert ersetzen
    supabase.table("scraper_registry") \
        .update({
            "current_value":   cfg["broken_value"],
            "last_updated_by": "manual",
            "notes":           f"_DEMO_ kaputter Wert (Original wird beim Cleanup wiederhergestellt)",
        }) \
        .eq("provider_id", cfg["provider_id"]) \
        .eq("scraper_method", cfg["scraper_method"]) \
        .eq("field_name", cfg["field_name"]) \
        .execute()

    print(f"│ Kaputter Wert (jetzt):   {cfg['broken_value']}")
    print(f"└─────────────────────────────────────────────────────────────")
    return original_value


# =====================================================================
# HELPER: HTML laden
# =====================================================================
def fetch_html(url: str) -> str:
    """Holt aktuelles HTML der Webseite."""
    print(f"\n┌─ SCHRITT 2: Echtes HTML laden ──────────────────────────────")
    print(f"│ URL: {url}")
    try:
        response = requests.get(url, timeout=15, headers={"User-Agent": "Mozilla/5.0 Demo-Self-Healing"})
        response.raise_for_status()
        html = response.text
        print(f"│ ✓ {len(html)} Bytes geladen")
        print(f"└─────────────────────────────────────────────────────────────")
        return html
    except Exception as e:
        print(f"│ ✗ Fehler: {e}")
        print(f"└─────────────────────────────────────────────────────────────")
        return ""


# =====================================================================
# HELPER: Demo-Fehler in scrape_errors erzeugen
# =====================================================================
def create_demo_error(cfg: dict, html: str) -> str:
    """Erzeugt einen tagged Demo-Eintrag in scrape_errors.

    Returns:
        Die ID des erstellten Eintrags (für Cleanup).
    """
    print(f"\n┌─ SCHRITT 3: Demo-Fehler in scrape_errors einfügen ──────────")

    insert_result = supabase.table("scrape_errors").insert({
        "provider_id":    cfg["provider_id"],
        "error_type":     cfg["error_type"],
        "message":        cfg["error_message"],
        "html_snapshot":  html[:50000],  # auf 50KB begrenzen (Token-Schutz)
        "fixed_by_ai":    False,
    }).execute()

    error_id = insert_result.data[0]["id"]
    print(f"│ ✓ Demo-Fehler erstellt (ID: {error_id})")
    print(f"│   error_type:    {cfg['error_type']}")
    print(f"│   provider_id:   {cfg['provider_id']}")
    print(f"│   html_snapshot: {len(html)} Bytes")
    print(f"└─────────────────────────────────────────────────────────────")
    return error_id


# =====================================================================
# HELPER: Self-Healing-Loop triggern
# =====================================================================
def trigger_healing():
    """Ruft den Self-Healing-Loop auf."""
    print(f"\n┌─ SCHRITT 4: Self-Healing-Loop ausführen ────────────────────")
    print(f"│ Triggert self_healing_loop.run() ...")
    print(f"└─────────────────────────────────────────────────────────────\n")

    # Limit 5 reicht: wir wollen nur unsere frischen Demo-Fehler heilen,
    # nicht alle alten 20+
    self_healing_loop.run(limit=5, dry_run=False)


# =====================================================================
# HELPER: Vorher-Nachher zeigen
# =====================================================================
def show_before_after(cfg: dict, original: str):
    """Liest neuen Wert aus Registry und zeigt Vorher-Nachher."""
    result = supabase.table("scraper_registry") \
        .select("current_value, last_updated_by, last_updated_at, notes") \
        .eq("provider_id", cfg["provider_id"]) \
        .eq("scraper_method", cfg["scraper_method"]) \
        .eq("field_name", cfg["field_name"]) \
        .limit(1) \
        .execute()

    if not result.data:
        print("│ ⚠ Eintrag verschwunden — sollte nicht passieren")
        return None

    new_value = result.data[0]["current_value"]
    last_updated_by = result.data[0]["last_updated_by"]

    print(f"\n┌─ SCHRITT 5: Vorher-Nachher Vergleich ───────────────────────")
    print(f"│ ✦ Original (vor Demo):    {original[:80]}{'...' if len(original) > 80 else ''}")
    print(f"│ ✦ Kaputt (während Demo):  {cfg['broken_value']}")
    print(f"│ ✦ Neu (von Gemini):       {new_value[:80]}{'...' if len(new_value) > 80 else ''}")
    print(f"│")
    print(f"│ last_updated_by: {last_updated_by}")

    if last_updated_by == "self_healing_loop":
        print(f"│ ✓ Heilung erfolgreich — neuer Wert kommt vom Self-Healing-Loop")
    else:
        print(f"│ ⚠ Heilung nicht passiert — current_value wurde nicht durch Loop geändert")
    print(f"└─────────────────────────────────────────────────────────────")
    return new_value


# =====================================================================
# HELPER: Cleanup
# =====================================================================
def cleanup(cfg: dict, original: str, error_id: str):
    """Setzt scraper_registry zurück, löscht Demo-Eintrag aus scrape_errors."""
    print(f"\n┌─ CLEANUP ───────────────────────────────────────────────────")

    # 1. Scraper-Registry zurücksetzen
    supabase.table("scraper_registry") \
        .update({
            "current_value":   original,
            "last_updated_by": "manual",
            "notes":           "Initial-Eintrag (manuell). Demo-Cleanup zurückgesetzt.",
        }) \
        .eq("provider_id", cfg["provider_id"]) \
        .eq("scraper_method", cfg["scraper_method"]) \
        .eq("field_name", cfg["field_name"]) \
        .execute()
    print(f"│ ✓ scraper_registry auf Original zurückgesetzt")

    # 2. Demo-Fehler aus scrape_errors löschen
    supabase.table("scrape_errors") \
        .delete() \
        .eq("id", error_id) \
        .execute()
    print(f"│ ✓ Demo-Fehler aus scrape_errors gelöscht ({error_id})")
    print(f"└─────────────────────────────────────────────────────────────")


# =====================================================================
# DEMO-RUNNER: führt eine komplette Demo durch
# =====================================================================
def run_demo(cfg: dict):
    """Führt eine komplette Demo für die gegebene Konfiguration durch."""
    print(f"\n{'═' * 70}")
    print(f"🎬 DEMO: {cfg['name']}")
    print(f"   Provider:        {cfg['provider_name']} (ID {cfg['provider_id']})")
    print(f"   Scraper-Methode: {cfg['scraper_method']}")
    print(f"   Feld:            {cfg['field_name']}")
    print(f"{'═' * 70}")

    original_value = None
    error_id = None

    try:
        # 1. Vorher sichern + kaputt machen
        original_value = save_original_and_break(cfg)

        # 2. Echtes HTML laden
        html = fetch_html(cfg["url"])
        if not html:
            print("\n✗ HTML konnte nicht geladen werden — Demo abgebrochen")
            return

        # 3. Demo-Fehler einfügen
        error_id = create_demo_error(cfg, html)

        # 4. Self-Healing-Loop triggern
        trigger_healing()

        # 5. Vorher-Nachher zeigen
        show_before_after(cfg, original_value)

    except Exception as e:
        print(f"\n✗ Fehler während Demo: {e}")

    # 6. Cleanup-Frage
    if original_value is not None:
        print()
        answer = input("➤ Demo-Daten zurücksetzen? [j/N] ").strip().lower()
        if answer in ("j", "y", "ja", "yes"):
            cleanup(cfg, original_value, error_id)
            print("✓ Cleanup abgeschlossen — DB ist im Ursprungszustand")
        else:
            print("ℹ Demo-Daten bleiben in der DB stehen.")
            print(f"  Manuelles Cleanup mit:")
            print(f"     UPDATE scraper_registry SET current_value = '{original_value[:40]}...' "
                  f"WHERE provider_id = {cfg['provider_id']};")
            if error_id:
                print(f"     DELETE FROM scrape_errors WHERE id = '{error_id}';")


# =====================================================================
# MAIN
# =====================================================================
if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Demo-Skript für Self-Healing-Loop")
    parser.add_argument("--only", choices=["puppeteer", "sgi"], default=None,
                        help="Nur eine der beiden Demos ausführen")
    args = parser.parse_args()

    print("\n" + "█" * 70)
    print("█  BACHELOR-THESIS DEMO: AI-basierter Self-Healing-Loop          █")
    print("█  Demonstration der Anforderung 10 (Self-Healing) der Thesis    █")
    print("█" * 70)

    if args.only == "puppeteer":
        run_demo(DEMO_PUPPETEER)
    elif args.only == "sgi":
        run_demo(DEMO_SGI)
    else:
        run_demo(DEMO_PUPPETEER)
        print("\n")
        run_demo(DEMO_SGI)

    print("\n" + "█" * 70)
    print("█  DEMO BEENDET                                                  █")
    print("█" * 70 + "\n")