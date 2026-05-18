"""
demo_self_healing.py
=====================
Demo-Skript für die Verteidigung der Bachelorthesis.

Provoziert kontrolliert zwei Self-Healing-Fälle, um die Generizität
des Loops über beide Scraper-Methoden zu zeigen:

  1. Puppeteer-Selektor-Vorschlag (Avidii, Provider 3)
     → Loop schlägt neuen CSS-Selektor vor und schreibt ihn in
       scraper_registry. Die Integration des neuen Selektors in
       den Avidii-Scraper ist als Future Work skizziert.

  2. ScrapeGraphAI-Prompt heilen (Lern-Forum, Provider 2)
     → Vollständiger Roundtrip: Loop schreibt neuen Prompt in
       scraper_registry; der nächste sGAI_lernForumScraper-Lauf
       liest ihn beim Start aus.

Ablauf pro Demo:
  1. Vorher-Zustand sichern  → aktuellen "guten" Wert holen, dann
                               temporär durch kaputten Wert ersetzen
  2. Echtes HTML laden       → requests.get() auf die Anbieter-URL
  3. Fehler-Eintrag erzeugen → INSERT INTO scrape_errors mit dem
                               kaputten Selektor/Prompt + HTML-Snapshot
  4. Self-Healing-Loop       → self_healing_loop.run(limit=5)
                               (Gemini analysiert HTML, schlägt Reparatur vor,
                               schreibt sie in scraper_registry zurück)
  5. Vorher-Nachher zeigen   → Vergleich der drei Werte:
                               Original / kaputt / Gemini-Reparatur
  6. Cleanup-Frage           → DB-Zustand zurücksetzen oder belassen

Verwendung:
  python demo_self_healing.py              # beide Demos nacheinander
  python demo_self_healing.py --only puppeteer
  python demo_self_healing.py --only sgi
  python demo_self_healing.py --no-cleanup # ohne Cleanup-Prompt
"""

import os
import sys
import json
import argparse
import requests

# Pfad zum scrapegraphai-Ordner für scrape_utils-Import
_THIS_DIR = os.path.dirname(os.path.abspath(__file__))
_SGAI_DIR = os.path.normpath(os.path.join(_THIS_DIR, "..", "scrapegraphai"))
if _SGAI_DIR not in sys.path:
    sys.path.insert(0, _SGAI_DIR)

from scrape_utils import supabase  # noqa: E402
import self_healing_loop  # noqa: E402


# =====================================================================
# DEMO-KONFIGURATIONEN
# =====================================================================
# Provider 3 (Avidii) — Puppeteer-Pfad.
# Der Avidii-Puppeteer-Scraper liest seine Selektoren aktuell NICHT
# aus der scraper_registry (Future Work). Die Demo zeigt aber, wie
# der Loop einen Selektor-Vorschlag produziert und in die Registry
# schreibt — das ist die kritische Self-Healing-Mechanik.
DEMO_PUPPETEER = {
    "name":           "Puppeteer-Selektor heilen",
    "provider_id":    3,
    "provider_name":  "Avidii",
    "scraper_method": "puppeteer",
    "field_name":     "price_container",
    "broken_value":   ".pricing-OLD-broken-DEMO",
    "url":            "https://avidii.ch/gymivorbereitung-langzeitgymnasium",
    "error_type":     "PRICE_SELECTOR_FAILED",
    "error_message":  "_DEMO_ Selector .pricing-OLD-broken-DEMO findet keinen Preis-Container",
    "is_json_pattern": False,
}

# Provider 2 (Lern-Forum) — ScrapeGraphAI-Pfad, JSON-Pattern.
# Lern-Forum nutzt seit Wave 1 das 'prompts'-Pattern: current_value
# ist ein JSON-Objekt mit Sub-Keys ('meta' + 'courses'). Wir setzen
# als kaputten Wert ein JSON mit nutzlosen Prompts und lassen Gemini
# beide Sub-Prompts wiederherstellen.
DEMO_SGI = {
    "name":           "ScrapeGraphAI-Prompt heilen",
    "provider_id":    2,
    "provider_name":  "Lern-Forum",
    "scraper_method": "scrapegraphai",
    "field_name":     "prompts",
    "broken_value":   json.dumps({
        "meta":    "_DEMO_ Bitte hol mir was.",
        "courses": "_DEMO_ Bitte hol mir auch was."
    }),
    "url":            "https://www.lern-forum.ch/gymivorbereitung-zuerich",
    "error_type":     "NO_COURSES_FOUND",
    "error_message":  "_DEMO_ Prompt zu vage, LLM gab leere Liste zurück",
    "is_json_pattern": True,
}


# =====================================================================
# HELPER: Vorher-Zustand sichern, kaputten Wert eintragen
# =====================================================================
def save_original_and_break(cfg: dict) -> str:
    """Holt aktuellen 'guten' Wert aus Registry, ersetzt durch kaputten Demo-Wert.

    Returns:
        Der ursprüngliche 'gute' Wert (für späteres Cleanup).
    """
    print("\n┌─ SCHRITT 1: Vorher-Zustand vorbereiten ──────────────────────────")

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
            f"Bitte zuerst init_avidii_roundtrip.sql / init_roundtrip_wave1.sql "
            f"in Supabase ausführen."
        )

    original_value = result.data[0]["current_value"]
    print(f"│ Original-Wert (vorher):  {original_value[:80]}"
          f"{'...' if len(original_value) > 80 else ''}")

    # Durch kaputten Wert ersetzen
    supabase.table("scraper_registry") \
        .update({
            "current_value":   cfg["broken_value"],
            "last_updated_by": "manual",
            "notes":           "_DEMO_ kaputter Wert (Original wird beim Cleanup wiederhergestellt)",
        }) \
        .eq("provider_id", cfg["provider_id"]) \
        .eq("scraper_method", cfg["scraper_method"]) \
        .eq("field_name", cfg["field_name"]) \
        .execute()

    print(f"│ Kaputter Wert (jetzt):   {cfg['broken_value'][:80]}"
          f"{'...' if len(cfg['broken_value']) > 80 else ''}")
    print("└──────────────────────────────────────────────────────────────────")
    return original_value


# =====================================================================
# HELPER: HTML laden
# =====================================================================
def fetch_html(url: str) -> str:
    """Holt aktuelles HTML der Webseite."""
    print("\n┌─ SCHRITT 2: Echtes HTML laden ───────────────────────────────────")
    print(f"│ URL: {url}")
    try:
        response = requests.get(
            url,
            timeout=15,
            headers={"User-Agent": "Mozilla/5.0 Demo-Self-Healing"},
        )
        response.raise_for_status()
        html = response.text
        print(f"│ ✓ {len(html)} Bytes geladen")
        print("└──────────────────────────────────────────────────────────────────")
        return html
    except Exception as e:
        print(f"│ ⚠ Fehler beim HTML-Fetch: {e}")
        print("│   Loop wird trotzdem versuchen, mit leerem Snapshot zu heilen.")
        print("└──────────────────────────────────────────────────────────────────")
        return ""


# =====================================================================
# HELPER: Demo-Fehler in scrape_errors erzeugen
# =====================================================================
def create_demo_error(cfg: dict, html: str) -> str:
    """Erzeugt einen tagged Demo-Eintrag in scrape_errors.

    Returns:
        Die ID des erstellten Eintrags (für Cleanup).
    """
    print("\n┌─ SCHRITT 3: Demo-Fehler in scrape_errors einfügen ───────────────")

    insert_result = supabase.table("scrape_errors").insert({
        "provider_id":    cfg["provider_id"],
        "error_type":     cfg["error_type"],
        "message":        cfg["error_message"],
        "html_snapshot":  html[:50000] if html else None,
        "fixed_by_ai":    False,
    }).execute()

    error_id = insert_result.data[0]["id"]
    print(f"│ ✓ Demo-Fehler erstellt (ID: {error_id})")
    print(f"│   error_type:    {cfg['error_type']}")
    print(f"│   provider_id:   {cfg['provider_id']}")
    print(f"│   html_snapshot: {len(html) if html else 0} Bytes")
    print("└──────────────────────────────────────────────────────────────────")
    return error_id


# =====================================================================
# HELPER: Self-Healing-Loop triggern
# =====================================================================
def trigger_healing():
    """Ruft den Self-Healing-Loop auf."""
    print("\n┌─ SCHRITT 4: Self-Healing-Loop ausführen ─────────────────────────")
    print("│ Triggert self_healing_loop.run() ...")
    print("└──────────────────────────────────────────────────────────────────\n")

    # Limit 5 reicht: wir wollen nur unsere frischen Demo-Fehler heilen,
    # nicht alle alten Fehler.
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

    print("\n┌─ SCHRITT 5: Vorher-Nachher Vergleich ────────────────────────────")
    print(f"│ ★ Original (vor Demo):    {original[:80]}"
          f"{'...' if len(original) > 80 else ''}")
    print(f"│ ★ Kaputt (während Demo):  {cfg['broken_value'][:80]}"
          f"{'...' if len(cfg['broken_value']) > 80 else ''}")
    print(f"│ ★ Neu (von Gemini):       {new_value[:80]}"
          f"{'...' if len(new_value) > 80 else ''}")
    print("│")
    print(f"│ last_updated_by: {last_updated_by}")

    if last_updated_by == "self_healing_loop":
        print("│ ✓ Heilung erfolgreich — neuer Wert kommt vom Self-Healing-Loop")
    else:
        print("│ ⚠ Heilung nicht passiert — current_value wurde nicht durch Loop geändert")
    print("└──────────────────────────────────────────────────────────────────")
    return new_value


# =====================================================================
# HELPER: Cleanup
# =====================================================================
def cleanup(cfg: dict, original: str, error_id: str):
    """Setzt scraper_registry zurück, löscht Demo-Eintrag aus scrape_errors."""
    print("\n┌─ CLEANUP ─────────────────────────────────────────────────────────")

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
    print("│ ✓ scraper_registry auf Original zurückgesetzt")

    # 2. Demo-Fehler aus scrape_errors löschen
    if error_id:
        supabase.table("scrape_errors") \
            .delete() \
            .eq("id", error_id) \
            .execute()
        print(f"│ ✓ Demo-Fehler aus scrape_errors gelöscht ({error_id})")
    print("└──────────────────────────────────────────────────────────────────")


# =====================================================================
# DEMO-RUNNER: führt eine komplette Demo durch
# =====================================================================
def run_demo(cfg: dict, auto_cleanup: bool = False):
    """Führt eine komplette Demo für die gegebene Konfiguration durch."""
    print("\n" + "═" * 70)
    print(f"🎬 DEMO: {cfg['name']}")
    print(f"   Provider:        {cfg['provider_name']} (ID {cfg['provider_id']})")
    print(f"   Scraper-Methode: {cfg['scraper_method']}")
    print(f"   Feld:            {cfg['field_name']}")
    print("═" * 70)

    original_value = None
    error_id = None

    try:
        # 1. Vorher sichern + kaputt machen
        original_value = save_original_and_break(cfg)

        # 2. Echtes HTML laden (kann auch leer zurückkommen — Loop hat Live-Fetch-Fallback)
        html = fetch_html(cfg["url"])

        # 3. Demo-Fehler einfügen
        error_id = create_demo_error(cfg, html)

        # 4. Self-Healing-Loop triggern
        trigger_healing()

        # 5. Vorher-Nachher zeigen
        show_before_after(cfg, original_value)

    except Exception as e:
        print(f"\n✗ Fehler während Demo: {e}")

    # 6. Cleanup-Frage (optional automatisch)
    if original_value is not None:
        if auto_cleanup:
            cleanup(cfg, original_value, error_id)
            print("✓ Cleanup automatisch ausgeführt")
            return

        print()
        answer = input("➤ Demo-Daten zurücksetzen? [j/N] ").strip().lower()
        if answer in ("j", "y", "ja", "yes"):
            cleanup(cfg, original_value, error_id)
            print("✓ Cleanup abgeschlossen — DB ist im Ursprungszustand")
        else:
            print("ℹ Demo-Daten bleiben in der DB stehen.")
            print("  Manuelles Cleanup mit:")
            print(f"     UPDATE scraper_registry SET current_value = ... "
                  f"WHERE provider_id = {cfg['provider_id']} "
                  f"AND scraper_method = '{cfg['scraper_method']}' "
                  f"AND field_name = '{cfg['field_name']}';")
            if error_id:
                print(f"     DELETE FROM scrape_errors WHERE id = '{error_id}';")


# =====================================================================
# MAIN
# =====================================================================
if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Demo-Skript für Self-Healing-Loop")
    parser.add_argument(
        "--only",
        choices=["puppeteer", "sgi"],
        default=None,
        help="Nur eine der beiden Demos ausführen",
    )
    parser.add_argument(
        "--no-cleanup",
        action="store_true",
        help="DB-Zustand nach Demo belassen (für manuelle Inspektion)",
    )
    args = parser.parse_args()

    # auto_cleanup-Logik: --no-cleanup überspringt den Cleanup komplett,
    # ohne Default ist der Cleanup interaktiv abgefragt.
    auto_cleanup = False  # Cleanup-Prompt zeigen
    if args.no_cleanup:
        # Mit --no-cleanup zeigen wir den Prompt gar nicht und überspringen Cleanup
        # → die Demo-Daten bleiben in der DB als Defense-Beweis stehen
        def _noop_cleanup(_cfg, _original, _error_id):
            print("\nℹ --no-cleanup aktiv — DB-Zustand bleibt unverändert.")
        globals()["cleanup"] = _noop_cleanup
        auto_cleanup = True  # springt direkt zum noop-Cleanup ohne Prompt

    print("\n" + "█" * 70)
    print("█  BACHELOR-THESIS DEMO: AI-basierter Self-Healing-Loop          █")
    print("█  Demonstration der Self-Healing-Pipeline (Topic-Dokument S.4) █")
    print("█" * 70)

    if args.only == "puppeteer":
        run_demo(DEMO_PUPPETEER, auto_cleanup=auto_cleanup)
    elif args.only == "sgi":
        run_demo(DEMO_SGI, auto_cleanup=auto_cleanup)
    else:
        run_demo(DEMO_PUPPETEER, auto_cleanup=auto_cleanup)
        print("\n")
        run_demo(DEMO_SGI, auto_cleanup=auto_cleanup)

    print("\n" + "█" * 70)
    print("█  DEMO BEENDET                                                  █")
    print("█" * 70 + "\n")